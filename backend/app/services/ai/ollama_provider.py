"""Local LLM Provider using Ollama for meeting intelligence, summaries, and chat.

Strict local inference policy:
- Queries local Ollama server at settings.OLLAMA_BASE_URL (http://localhost:11434).
- Zero cloud AI fallbacks (no OpenAI, Anthropic, or external cloud inference).
- When local Ollama is offline or unreachable, provides clearly labeled rule-based
  local fallback intelligence (never presented as LLM-generated output).
"""
import re
import json
import logging
from typing import List, Optional, Dict, Any
import httpx
from app.core.config import settings
from app.services.ai.dto import (
    SummaryDTO,
    ShortTranscriptDTO,
    ChronologicalEventDTO,
    DecisionDTO,
    ActionItemDTO,
    GroundedAnswerDTO,
    TranscriptSegmentDTO
)

logger = logging.getLogger("meetmind.llm.ollama")


class OllamaProvider:
    """Local LLM Provider interacting with locally hosted Ollama instances."""

    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: float = 60.0
    ):
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/")
        self.model = model or settings.OLLAMA_MODEL
        self.timeout = timeout

    async def _query_ollama(self, system_prompt: str, user_prompt: str, format_json: bool = False) -> str:
        """Query local Ollama server."""
        url = f"{self.base_url}/api/chat"
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "stream": False,
            "options": {"temperature": 0.2}
        }
        if format_json:
            payload["format"] = "json"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                resp = await client.post(url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                return data.get("message", {}).get("content", "")
            except Exception as e:
                logger.warning(f"Local Ollama query failed ({url}, model={self.model}): {e}")
                raise RuntimeError(
                    f"Local Ollama inference failed: {e}. Ensure Ollama is running at '{self.base_url}' "
                    f"with model '{self.model}'."
                ) from e

    async def generate_summary(self, transcript_text: str) -> SummaryDTO:
        """Generate structured executive summary from meeting transcript."""
        system_prompt = (
            "You are MeetMind's local meeting intelligence engine. "
            "Analyze the provided transcript and respond strictly with JSON containing: "
            "'executive_summary' (string explaining purpose and outcomes), 'key_points' (array of strings), "
            "'risks' (array of strings covering blockers, concerns, and uncertainties), "
            "'open_questions' (array of strings covering unresolved issues), "
            "and 'next_steps' (array of strings)."
        )
        try:
            raw_json = await self._query_ollama(system_prompt, transcript_text, format_json=True)
            parsed = json.loads(raw_json)
            return SummaryDTO(
                executive_summary=parsed.get("executive_summary", "No summary generated."),
                key_points=parsed.get("key_points", []),
                risks=parsed.get("risks", []),
                open_questions=parsed.get("open_questions", []),
                next_steps=parsed.get("next_steps", []),
                model_name=f"ollama:{self.model}"
            )
        except Exception as exc:
            logger.info(f"Ollama unavailable, using clearly labeled local rule-based fallback: {exc}")
            # Labeled rule-based fallback
            sentences = [s.strip() for s in re.split(r'[.!?]+', transcript_text) if len(s.strip()) > 8]
            summary_snippet = " ".join(sentences[:3]) if sentences else "Meeting transcript recorded."

            # Rule-based extraction of open questions (sentences ending with '?')
            open_questions = [s.strip() + "?" for s in transcript_text.split("?")[:-1] if len(s.strip()) > 10][:4]
            # Rule-based detection of risks
            risk_keywords = ["risk", "blocker", "concern", "delay", "challenge", "bottleneck", "issue"]
            risks = [s for s in sentences if any(rk in s.lower() for rk in risk_keywords)][:3]
            if not risks:
                risks = ["Automated LLM risk assessment unavailable while Ollama is offline."]

            return SummaryDTO(
                executive_summary=f"[RULE-BASED FALLBACK · Ollama daemon offline] {summary_snippet}",
                key_points=[s for s in sentences[1:5]] if len(sentences) > 1 else ["Discussion recorded in full transcript."],
                risks=risks,
                open_questions=open_questions,
                next_steps=["Review transcript and confirm action item assignments."],
                model_name="local-rule-based-fallback (ollama offline)"
            )

    async def generate_short_transcript(self, segments: List[TranscriptSegmentDTO]) -> ShortTranscriptDTO:
        """Generate chronological explanation of how the discussion unfolded."""
        transcript_formatted = "\n".join(
            [f"[{s.start_time:.1f}s - {s.end_time:.1f}s] {s.speaker_label or 'Speaker'}: {s.text}" for s in segments]
        )
        system_prompt = (
            "You are MeetMind's meeting explanation engine. "
            "Produce a concise chronological narrative detailing what each speaker contributed, "
            "questions and answers, proposals, disagreements, agreements, and conclusions. "
            "Respond strictly with JSON containing: "
            "'narrative_text' (string) and 'chronological_events' (array of objects with "
            "'timestamp' (float), 'speaker' (string), 'description' (string), "
            "'event_type' ('proposal'|'agreement'|'disagreement'|'question'|'clarification'|'conclusion'), "
            "and 'evidence_quote' (string exact snippet from transcript))."
        )
        try:
            raw_json = await self._query_ollama(system_prompt, transcript_formatted, format_json=True)
            parsed = json.loads(raw_json)
            events = [
                ChronologicalEventDTO(
                    timestamp=float(e.get("timestamp", 0.0)),
                    speaker=e.get("speaker", "Speaker"),
                    description=e.get("description", ""),
                    event_type=e.get("event_type", "contribution"),
                    evidence_quote=e.get("evidence_quote")
                )
                for e in parsed.get("chronological_events", [])
            ]
            return ShortTranscriptDTO(
                narrative_text=parsed.get("narrative_text", "Chronological narrative generated."),
                chronological_events=events,
                model_name=f"ollama:{self.model}"
            )
        except Exception as exc:
            logger.info(f"Ollama unavailable for chronological narrative, using rule-based fallback: {exc}")
            events: List[ChronologicalEventDTO] = []
            for s in segments[:15]:
                text_lower = s.text.lower()
                event_type = "contribution"
                if "?" in s.text:
                    event_type = "question"
                elif any(w in text_lower for w in ["disagree", "however", "objection", "concern", "alternative"]):
                    event_type = "disagreement"
                elif any(w in text_lower for w in ["approved", "consensus", "sounds good", "accept"]) or re.search(r'\b(agree|agreed)\b', text_lower):
                    event_type = "agreement"
                elif any(w in text_lower for w in ["propose", "suggest", "recommend", "idea", "how about"]):
                    event_type = "proposal"
                elif any(w in text_lower for w in ["conclude", "wrap up", "finally", "in summary"]):
                    event_type = "conclusion"
                elif any(w in text_lower for w in ["clarify", "mean", "explain"]):
                    event_type = "clarification"

                events.append(
                    ChronologicalEventDTO(
                        timestamp=s.start_time,
                        speaker=s.speaker_label or "Speaker",
                        description=s.text[:140],
                        event_type=event_type,
                        evidence_quote=s.text[:100]
                    )
                )
            return ShortTranscriptDTO(
                narrative_text="[RULE-BASED FALLBACK · Ollama offline] Chronological sequence structured from verified transcript turns.",
                chronological_events=events,
                model_name="local-rule-based-fallback (ollama offline)"
            )

    async def extract_decisions(self, transcript_text: str) -> List[DecisionDTO]:
        """Extract explicit decisions, votes, and consensus points with status classification."""
        system_prompt = (
            "Extract all decisions and proposals from the transcript. "
            "Do NOT treat an informal suggestion as an approved decision. "
            "Respond strictly with a JSON object containing a 'decisions' list. "
            "Each decision must have: 'title' (string), 'decision_text' (string), 'category' (string), "
            "'status' ('CONFIRMED' for approved agreements, 'PROPOSED' for suggestions/options, 'REJECTED' for dismissed options), "
            "'responsible_person' (string or null, DO NOT INVENT A PERSON), 'evidence_timestamp' (float or null), "
            "and 'evidence_quote' (exact string quote from transcript)."
        )
        try:
            raw_json = await self._query_ollama(system_prompt, transcript_text, format_json=True)
            parsed = json.loads(raw_json)
            items = parsed.get("decisions", [])
            return [
                DecisionDTO(
                    title=d.get("title", "Decision"),
                    category=d.get("category", "General"),
                    decision_text=d.get("decision_text", ""),
                    status=d.get("status", "CONFIRMED").upper(),
                    responsible_person=d.get("responsible_person"),
                    evidence_timestamp=float(d["evidence_timestamp"]) if d.get("evidence_timestamp") is not None else None,
                    evidence_quote=d.get("evidence_quote"),
                    model_name=f"ollama:{self.model}"
                )
                for d in items
            ]
        except Exception:
            # Rule-based regex extraction looking for decision and proposal keywords
            confirmed_keywords = ["decided", "agreed", "resolved", "approved", "chosen", "concluded"]
            proposal_keywords = ["propose", "suggest", "might consider", "recommend", "how about"]
            found = []
            sentences = [s.strip() for s in re.split(r'[.!?]+', transcript_text) if s.strip()]
            for s in sentences:
                s_lower = s.lower()
                if any(kw in s_lower for kw in confirmed_keywords):
                    found.append(
                        DecisionDTO(
                            title=s[:40],
                            category="General (Rule-Based)",
                            decision_text=s,
                            status="CONFIRMED",
                            responsible_person=None,
                            evidence_timestamp=0.0,
                            evidence_quote=s[:120],
                            model_name="local-rule-based-fallback (ollama offline)"
                        )
                    )
                elif any(kw in s_lower for kw in proposal_keywords):
                    found.append(
                        DecisionDTO(
                            title=s[:40],
                            category="Proposal (Rule-Based)",
                            decision_text=s,
                            status="PROPOSED",
                            responsible_person=None,
                            evidence_timestamp=0.0,
                            evidence_quote=s[:120],
                            model_name="local-rule-based-fallback (ollama offline)"
                        )
                    )
            return found

    async def extract_action_items(self, transcript_text: str) -> List[ActionItemDTO]:
        """Extract actionable tasks with explicit owners and stated deadlines."""
        system_prompt = (
            "Extract all actionable tasks from the transcript. "
            "IMPORTANT RULES: "
            "1. DO NOT invent an owner. If no owner was explicitly assigned in the transcript, set 'owner_name' to null. "
            "2. DO NOT invent a deadline. If no deadline was explicitly stated in the transcript, set 'due_date' to null. "
            "Respond strictly with a JSON object containing an 'action_items' list. "
            "Each item must have: 'task_description' (string), 'owner_name' (string or null), "
            "'due_date' (string or null), 'priority' ('LOW'|'MEDIUM'|'HIGH'|'URGENT'), "
            "'status' ('OPEN'|'PROPOSED'|'ACCEPTED'|'IN_PROGRESS'), "
            "'evidence_timestamp' (float or null), 'evidence_quote' (exact string quote)."
        )
        try:
            raw_json = await self._query_ollama(system_prompt, transcript_text, format_json=True)
            parsed = json.loads(raw_json)
            items = parsed.get("action_items", [])
            return [
                ActionItemDTO(
                    task_description=a.get("task_description", "Follow-up task"),
                    owner_name=a.get("owner_name"),
                    due_date=a.get("due_date"),
                    priority=a.get("priority", "MEDIUM"),
                    status=a.get("status", "OPEN").upper(),
                    evidence_timestamp=float(a["evidence_timestamp"]) if a.get("evidence_timestamp") is not None else None,
                    evidence_quote=a.get("evidence_quote"),
                    model_name=f"ollama:{self.model}"
                )
                for a in items
            ]
        except Exception:
            # Rule-based fallback looking for action keywords with strict non-hallucination of owners/deadlines
            keywords = ["will", "todo", "action item", "follow up", "schedule", "implement", "deploy"]
            found = []
            sentences = [s.strip() for s in re.split(r'[.!?]+', transcript_text) if s.strip()]
            for s in sentences:
                s_lower = s.lower()
                if any(kw in s_lower for kw in keywords):
                    # Check for explicit 'assigned to X'
                    owner = None
                    assign_match = re.search(r'assigned to ([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)', s)
                    if assign_match:
                        owner = assign_match.group(1)

                    # Check for explicit 'by <date/day>'
                    due = None
                    due_match = re.search(r'by (Friday|Monday|Tuesday|Wednesday|Thursday|next week|tomorrow|end of day)', s, re.IGNORECASE)
                    if due_match:
                        due = due_match.group(1)

                    found.append(
                        ActionItemDTO(
                            task_description=s,
                            owner_name=owner,
                            due_date=due,
                            priority="HIGH" if "urgent" in s_lower or "critical" in s_lower else "MEDIUM",
                            status="OPEN",
                            evidence_timestamp=0.0,
                            evidence_quote=s[:120],
                            model_name="local-rule-based-fallback (ollama offline)"
                        )
                    )
            return found

    async def answer_question(self, query: str, context: List[Dict[str, Any]]) -> GroundedAnswerDTO:
        """Grounded Q&A strictly backed by retrieved context chunks."""
        if not context:
            return GroundedAnswerDTO(
                answer="The meeting records do not contain sufficient evidence to answer this question.",
                citations=[],
                found_evidence=False
            )

        context_str = "\n".join(
            [f"[Time: {c.get('start_time', 0.0)}s - Speaker: {c.get('speaker', 'Unknown')}] {c.get('text', '')}" for c in context]
        )

        system_prompt = (
            "You are MeetMind's grounded organizational memory assistant. "
            "Answer the user query based ONLY on the provided meeting context. "
            "If the answer cannot be found in the context, explicitly state: "
            "'The meeting records do not contain sufficient evidence to answer this question.' "
            "Respond with JSON: 'answer' (string), 'found_evidence' (boolean)."
        )
        user_prompt = f"Meeting Context:\n{context_str}\n\nUser Question:\n{query}"

        try:
            raw_json = await self._query_ollama(system_prompt, user_prompt, format_json=True)
            parsed = json.loads(raw_json)
            answer = parsed.get("answer", "")
            found = parsed.get("found_evidence", True)
            citations = []
            if found:
                for c in context[:3]:
                    citations.append({
                        "meeting_id": c.get("meeting_id", ""),
                        "timestamp_start": c.get("start_time"),
                        "timestamp_end": c.get("end_time"),
                        "speaker_name": c.get("speaker"),
                        "quote": c.get("text", "")[:150]
                    })
            return GroundedAnswerDTO(answer=answer, citations=citations, found_evidence=found)
        except Exception:
            # Fallback to direct citation extract without cloud call
            citations = []
            for c in context[:3]:
                citations.append({
                    "meeting_id": c.get("meeting_id", ""),
                    "timestamp_start": c.get("start_time"),
                    "timestamp_end": c.get("end_time"),
                    "speaker_name": c.get("speaker"),
                    "quote": c.get("text", "")[:150]
                })
            matching_texts = [c.get("text", "") for c in context[:2]]
            combined = " ".join(matching_texts)
            return GroundedAnswerDTO(
                answer=f"[RULE-BASED FALLBACK · Ollama offline] Evidence located in meeting records: \"{combined[:250]}\"",
                citations=citations,
                found_evidence=True
            )
