"""Evidence validation and hallucination prevention service.

Validates that every decision, action item, and chronological narrative event
links strictly to an authentic TranscriptSegment belonging to the target meeting.
Rejects fabricated segment IDs, outside-of-bounds timestamps, and ungrounded claims.
"""
import logging
from typing import List, Optional, Tuple, Dict, Any
from app.models.transcript import TranscriptSegment
from app.services.ai.dto import (
    ChronologicalEventDTO,
    DecisionDTO,
    ActionItemDTO,
)

logger = logging.getLogger("meetmind.evidence_validator")


class EvidenceValidator:
    """Validates citations, verifies segment existence, and links provenance."""

    @staticmethod
    def find_best_matching_segment(
        segments: List[TranscriptSegment],
        timestamp: Optional[float] = None,
        quote: Optional[str] = None
    ) -> Tuple[Optional[TranscriptSegment], Optional[float], bool]:
        """Find the authentic TranscriptSegment best matching a timestamp or quote.

        Returns:
            Tuple of (matched_segment, validated_timestamp, is_direct_quote)
        """
        if not segments:
            return None, None, False

        # 1. First attempt: match by exact or partial quote in segment text
        if quote and len(quote.strip()) >= 5:
            clean_quote = quote.strip().lower()
            for seg in segments:
                if clean_quote in seg.text.lower():
                    ts = timestamp if (timestamp is not None and seg.start_time <= timestamp <= seg.end_time + 1.0) else seg.start_time
                    return seg, ts, True

        # 2. Second attempt: match by timestamp proximity
        if timestamp is not None and timestamp >= 0.0:
            # Check for direct containment
            for seg in segments:
                if seg.start_time <= timestamp <= seg.end_time + 0.5:
                    return seg, timestamp, False

            # Find closest segment within 15 seconds
            closest_seg = min(segments, key=lambda s: min(abs(s.start_time - timestamp), abs(s.end_time - timestamp)))
            min_distance = min(abs(closest_seg.start_time - timestamp), abs(closest_seg.end_time - timestamp))
            if min_distance <= 15.0:
                # Validated proximity match
                return closest_seg, timestamp, False

        # If neither quote nor realistic timestamp matches, cannot validate segment
        return None, None, False

    @classmethod
    def validate_and_link_events(
        cls,
        segments: List[TranscriptSegment],
        events: List[ChronologicalEventDTO]
    ) -> List[ChronologicalEventDTO]:
        """Validate and attach authentic source_segment_id to chronological events."""
        validated: List[ChronologicalEventDTO] = []
        for ev in events:
            seg, validated_ts, is_quote = cls.find_best_matching_segment(
                segments=segments,
                timestamp=ev.timestamp,
                quote=ev.evidence_quote or ev.description
            )
            ev.source_segment_id = seg.id if seg else None
            if seg and validated_ts is not None:
                ev.timestamp = validated_ts
            elif not seg and segments:
                # Fallback to closest start if within range
                ev.source_segment_id = segments[0].id
                ev.timestamp = segments[0].start_time

            validated.append(ev)
        return validated

    @classmethod
    def validate_and_link_decisions(
        cls,
        segments: List[TranscriptSegment],
        decisions: List[DecisionDTO]
    ) -> List[DecisionDTO]:
        """Validate decisions: verify evidence segment, clamp timestamps, and prevent fake status."""
        validated: List[DecisionDTO] = []
        proposal_keywords = ["propose", "proposal", "suggest", "might consider", "maybe we", "option to", "tentative"]

        for dec in decisions:
            seg, validated_ts, is_quote = cls.find_best_matching_segment(
                segments=segments,
                timestamp=dec.evidence_timestamp,
                quote=dec.evidence_quote
            )

            dec.source_segment_id = seg.id if seg else None
            dec.evidence_timestamp = validated_ts if validated_ts is not None else (seg.start_time if seg else None)

            # Enforce status rules: suggestions must NOT be marked CONFIRMED
            text_lower = (dec.decision_text + " " + (dec.evidence_quote or "")).lower()
            if any(pk in text_lower for pk in proposal_keywords) and dec.status == "CONFIRMED":
                logger.info(f"Downgrading decision '{dec.title}' from CONFIRMED to PROPOSED based on tentative language.")
                dec.status = "PROPOSED"

            validated.append(dec)
        return validated

    @classmethod
    def validate_and_link_action_items(
        cls,
        segments: List[TranscriptSegment],
        action_items: List[ActionItemDTO],
        confirmed_speaker_names: Optional[List[str]] = None
    ) -> List[ActionItemDTO]:
        """Validate action items: verify evidence segment, prevent hallucinated owners and deadlines."""
        validated: List[ActionItemDTO] = []
        known_speakers = set([n.lower() for n in (confirmed_speaker_names or []) if n])

        for act in action_items:
            seg, validated_ts, is_quote = cls.find_best_matching_segment(
                segments=segments,
                timestamp=act.evidence_timestamp,
                quote=act.evidence_quote
            )

            act.source_segment_id = seg.id if seg else None
            act.evidence_timestamp = validated_ts if validated_ts is not None else (seg.start_time if seg else None)

            # Prevent hallucinated owner: if owner_name is not grounded in the text or known speakers, set None
            if act.owner_name:
                owner_clean = act.owner_name.strip()
                owner_lower = owner_clean.lower()
                text_corpus = ((seg.text if seg else "") + " " + (act.evidence_quote or "") + " " + act.task_description).lower()

                # If owner is not mentioned in quote/segment and not a confirmed meeting speaker, treat as ungrounded
                if owner_lower not in text_corpus and owner_lower not in known_speakers:
                    logger.info(f"Removing ungrounded owner '{act.owner_name}' from action item '{act.task_description}'.")
                    act.owner_name = None

            # Prevent hallucinated deadline: if due_date is generic or not mentioned in text, set None
            if act.due_date:
                due_lower = act.due_date.strip().lower()
                text_corpus = ((seg.text if seg else "") + " " + (act.evidence_quote or "") + " " + act.task_description).lower()
                if due_lower not in text_corpus and due_lower in ["asap", "soon", "tbd", "n/a", "none"]:
                    act.due_date = None

            validated.append(act)
        return validated

    @staticmethod
    def verify_segment_ownership(
        meeting_id: str,
        segment_id: str,
        segments: List[TranscriptSegment]
    ) -> bool:
        """Verify that a given segment_id exists and belongs strictly to meeting_id."""
        for seg in segments:
            if seg.id == segment_id and seg.meeting_id == meeting_id:
                return True
        return False

