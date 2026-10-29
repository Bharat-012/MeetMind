import os
"""Idempotent Background Pipeline Orchestrator for MeetMind."""
import logging
from typing import Optional, List
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.models.meeting import Meeting, MediaAsset, ProcessingJob, ProcessingStatus
from app.models.transcript import TranscriptSegment, Speaker
from app.models.intelligence import (
    MeetingSummary,
    ShortTranscript,
    Decision,
    ActionItem,
    Priority,
    DecisionStatus,
    ActionItemStatus
)
from app.models.knowledge import VoiceEmotionAnnotation
from app.services.media_service import MediaService
from app.services.rag_service import RAGService
from app.services.evidence_validator import EvidenceValidator
from app.services.ai.factory import (
    get_asr_provider,
    get_diarization_provider,
    get_llm_provider,
    get_voice_emotion_provider
)

logger = logging.getLogger("meetmind.pipeline")


class PipelineService:
    """Manages idempotent meeting processing across all ingestion, AI, and indexing stages."""

    def __init__(self, session_factory=None):
        self._custom_session_factory = session_factory
        self.media_service = MediaService()
        self.rag_service = RAGService()
        self.asr = get_asr_provider()
        self.diarizer = get_diarization_provider()
        self.llm = get_llm_provider()
        self.emotion = get_voice_emotion_provider()

    @property
    def session_factory(self):
        if self._custom_session_factory is not None:
            return self._custom_session_factory
        from app.core.database import AsyncSessionLocal
        return AsyncSessionLocal

    async def run_pipeline(self, meeting_id: str, db: Optional[AsyncSession] = None) -> bool:
        """Run the complete pipeline from media extraction to indexing in background."""
        if db is not None:
            return await self._execute_pipeline(meeting_id, db)

        async with self.session_factory() as session:
            return await self._execute_pipeline(meeting_id, session)

    async def _execute_pipeline(self, meeting_id: str, db: AsyncSession) -> bool:
        meeting_stmt = select(Meeting).where(Meeting.id == meeting_id)
        res = await db.execute(meeting_stmt)
        meeting = res.scalar_one_or_none()
        if not meeting:
            logger.error(f"Meeting {meeting_id} not found.")
            return False

        try:
            # Stage 1: VALIDATING
            await self._update_status(db, meeting, ProcessingStatus.VALIDATING, 10)

            asset_stmt = select(MediaAsset).where(MediaAsset.meeting_id == meeting_id)
            asset_res = await db.execute(asset_stmt)
            media_asset = asset_res.scalar_one_or_none()

            # Stage 2: EXTRACTING_MEDIA
            await self._update_status(db, meeting, ProcessingStatus.EXTRACTING_MEDIA, 25)
            audio_path = None
            duration = 60.0

            if media_asset:
                if media_asset.audio_path and os.path.exists(media_asset.audio_path) and os.path.getsize(media_asset.audio_path) > 100:
                    audio_path = media_asset.audio_path
                    duration = self.media_service.probe_audio_duration(audio_path)
                elif media_asset.file_path and os.path.exists(media_asset.file_path):
                    audio_path, duration = self.media_service.extract_audio(media_asset.file_path, meeting_id)
                    media_asset.audio_path = audio_path

                if duration:
                    meeting.duration_seconds = duration
                db.add(media_asset)
                await db.commit()

            # Stage 3: TRANSCRIBING
            await self._update_status(db, meeting, ProcessingStatus.TRANSCRIBING, 40)
            transcript_segments_dto = await self.asr.transcribe(audio_path or "dummy.wav")

            # Stage 4: DIARIZING
            await self._update_status(db, meeting, ProcessingStatus.DIARIZING, 55)
            diarization_turns_dto = await self.diarizer.diarize(audio_path or "dummy.wav")

            # Stage 5: ALIGNING_SPEAKERS
            await self._update_status(db, meeting, ProcessingStatus.ALIGNING_SPEAKERS, 70)
            await self._persist_speakers_and_segments(db, meeting_id, transcript_segments_dto, diarization_turns_dto)

            # Stage 6: GENERATING_SUMMARY
            await self._update_status(db, meeting, ProcessingStatus.GENERATING_SUMMARY, 85)
            transcript_text = " ".join([s.text for s in transcript_segments_dto])

            # Query persisted segments and speakers with genuine DB IDs
            seg_stmt = select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id).order_by(TranscriptSegment.start_time.asc())
            seg_res = await db.execute(seg_stmt)
            persisted_segments = list(seg_res.scalars().all())

            spk_stmt = select(Speaker).where(Speaker.meeting_id == meeting_id)
            spk_res = await db.execute(spk_stmt)
            persisted_speakers = list(spk_res.scalars().all())
            confirmed_speakers = [s.confirmed_name or s.speaker_label for s in persisted_speakers if (s.confirmed_name or s.speaker_label)]

            summary_dto = await self.llm.generate_summary(transcript_text)
            short_transcript_dto = await self.llm.generate_short_transcript(transcript_segments_dto)
            decisions_dto = await self.llm.extract_decisions(transcript_text)
            action_items_dto = await self.llm.extract_action_items(transcript_text)

            # Evidence validation and provenance linking
            short_transcript_dto.chronological_events = EvidenceValidator.validate_and_link_events(
                segments=persisted_segments,
                events=short_transcript_dto.chronological_events
            )
            decisions_dto = EvidenceValidator.validate_and_link_decisions(
                segments=persisted_segments,
                decisions=decisions_dto
            )
            action_items_dto = EvidenceValidator.validate_and_link_action_items(
                segments=persisted_segments,
                action_items=action_items_dto,
                confirmed_speaker_names=confirmed_speakers
            )

            await self._persist_intelligence(
                db,
                meeting_id,
                summary_dto,
                short_transcript_dto,
                decisions_dto,
                action_items_dto
            )

            # Stage 7: INDEXING_KNOWLEDGE
            await self._update_status(db, meeting, ProcessingStatus.INDEXING_KNOWLEDGE, 95)
            await self.rag_service.index_meeting(db, meeting_id)

            # Stage 8: OPTIONAL VOICE EMOTION
            if settings.ENABLE_VOICE_EMOTION:
                try:
                    emotions_dto = await self.emotion.analyze(audio_path or "dummy.wav", transcript_segments_dto)
                    for em in emotions_dto:
                        db.add(VoiceEmotionAnnotation(
                            meeting_id=meeting_id,
                            start_time=em.start_time,
                            end_time=em.end_time,
                            emotion_label=em.emotion_label,
                            confidence=em.confidence,
                            acoustic_features=em.acoustic_features
                        ))
                    await db.commit()
                except Exception as emo_err:
                    logger.warning(f"Voice emotion analysis skipped: {emo_err}")

            # Stage 9: COMPLETED
            await self._update_status(db, meeting, ProcessingStatus.COMPLETED, 100)
            return True

        except Exception as e:
            logger.exception(f"Pipeline failed for meeting {meeting_id}: {e}")
            meeting.status = ProcessingStatus.FAILED
            meeting.error_message = str(e)
            job = ProcessingJob(
                meeting_id=meeting_id,
                stage=ProcessingStatus.FAILED,
                progress_percent=0,
                error_details=str(e)
            )
            db.add(job)
            await db.commit()
            return False

    async def _update_status(self, db: AsyncSession, meeting: Meeting, stage: ProcessingStatus, progress: int) -> None:
        """Update meeting and job state checkpoint."""
        meeting.status = stage
        meeting.error_message = None
        job = ProcessingJob(
            meeting_id=meeting.id,
            stage=stage,
            progress_percent=progress
        )
        db.add(job)
        await db.commit()

    async def _persist_speakers_and_segments(
        self,
        db: AsyncSession,
        meeting_id: str,
        segments_dto: list,
        turns_dto: list
    ) -> None:
        """Align diarization speaker labels with transcript segments and persist idempotently."""
        await db.execute(delete(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id))
        await db.execute(delete(Speaker).where(Speaker.meeting_id == meeting_id))
        await db.flush()

        speaker_map: dict = {}
        for turn in turns_dto:
            label = turn.speaker_label
            if label not in speaker_map:
                spk = Speaker(
                    meeting_id=meeting_id,
                    speaker_label=label,
                    confirmed_name=None,
                    is_confirmed=False
                )
                db.add(spk)
                await db.flush()
                speaker_map[label] = spk.id

        for seg in segments_dto:
            matched_speaker_id = None
            seg_mid = (seg.start_time + seg.end_time) / 2.0

            for turn in turns_dto:
                if turn.start_time <= seg_mid <= turn.end_time:
                    matched_speaker_id = speaker_map.get(turn.speaker_label)
                    break

            if not matched_speaker_id and seg.speaker_label:
                if seg.speaker_label not in speaker_map:
                    spk = Speaker(
                        meeting_id=meeting_id,
                        speaker_label=seg.speaker_label,
                        confirmed_name=None,
                        is_confirmed=False
                    )
                    db.add(spk)
                    await db.flush()
                    speaker_map[seg.speaker_label] = spk.id
                matched_speaker_id = speaker_map.get(seg.speaker_label)

            words_data = [
                {"word": w.word, "start": w.start, "end": w.end, "confidence": w.confidence}
                for w in seg.words
            ] if seg.words else None

            transcript_seg = TranscriptSegment(
                meeting_id=meeting_id,
                speaker_id=matched_speaker_id,
                start_time=seg.start_time,
                end_time=seg.end_time,
                text=seg.text,
                confidence=seg.confidence,
                words=words_data
            )
            db.add(transcript_seg)

        await db.commit()

    async def _persist_intelligence(
        self,
        db: AsyncSession,
        meeting_id: str,
        summary_dto,
        short_transcript_dto,
        decisions_dto,
        action_items_dto
    ) -> None:
        """Persist the three distinct meeting deliverables idempotently."""
        await db.execute(delete(MeetingSummary).where(MeetingSummary.meeting_id == meeting_id))
        await db.execute(delete(ShortTranscript).where(ShortTranscript.meeting_id == meeting_id))
        await db.execute(delete(Decision).where(Decision.meeting_id == meeting_id))
        await db.execute(delete(ActionItem).where(ActionItem.meeting_id == meeting_id))
        await db.flush()

        summary = MeetingSummary(
            meeting_id=meeting_id,
            executive_summary=summary_dto.executive_summary,
            key_points=summary_dto.key_points,
            risks=summary_dto.risks,
            open_questions=summary_dto.open_questions,
            next_steps=summary_dto.next_steps,
            model_name=summary_dto.model_name
        )
        db.add(summary)

        events_json = [
            {
                "timestamp": ev.timestamp,
                "speaker": ev.speaker,
                "description": ev.description,
                "event_type": getattr(ev, "event_type", "contribution"),
                "source_segment_id": getattr(ev, "source_segment_id", None),
                "evidence_quote": getattr(ev, "evidence_quote", None)
            }
            for ev in short_transcript_dto.chronological_events
        ]
        short_transcript = ShortTranscript(
            meeting_id=meeting_id,
            narrative_text=short_transcript_dto.narrative_text,
            chronological_events=events_json,
            model_name=getattr(short_transcript_dto, "model_name", None)
        )
        db.add(short_transcript)

        for dec in decisions_dto:
            status_val = DecisionStatus.CONFIRMED
            if getattr(dec, "status", None):
                raw_st = str(dec.status).upper()
                if raw_st in DecisionStatus.__members__:
                    status_val = DecisionStatus[raw_st]

            db.add(Decision(
                meeting_id=meeting_id,
                title=dec.title,
                decision_text=dec.decision_text,
                responsible_person=dec.responsible_person,
                status=status_val,
                source_segment_id=getattr(dec, "source_segment_id", None),
                evidence_timestamp=dec.evidence_timestamp,
                evidence_quote=dec.evidence_quote,
                model_name=getattr(dec, "model_name", None)
            ))

        for act in action_items_dto:
            status_val = ActionItemStatus.OPEN
            if getattr(act, "status", None):
                raw_st = str(act.status).upper()
                if raw_st in ActionItemStatus.__members__:
                    status_val = ActionItemStatus[raw_st]

            priority_val = Priority.MEDIUM
            if getattr(act, "priority", None):
                raw_pr = str(act.priority).upper()
                if raw_pr in Priority.__members__:
                    priority_val = Priority[raw_pr]

            db.add(ActionItem(
                meeting_id=meeting_id,
                task_description=act.task_description,
                owner_name=act.owner_name,
                due_date=act.due_date,
                priority=priority_val,
                status=status_val,
                source_segment_id=getattr(act, "source_segment_id", None),
                evidence_timestamp=act.evidence_timestamp,
                evidence_quote=act.evidence_quote,
                model_name=getattr(act, "model_name", None)
            ))

        await db.commit()
