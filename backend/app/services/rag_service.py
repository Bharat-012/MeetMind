"""Retrieval-Augmented Generation (RAG) and hybrid search service."""
import math
import re
from typing import List, Dict, Any, Optional
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.meeting import Meeting
from app.models.transcript import TranscriptSegment, Speaker
from app.models.intelligence import MeetingSummary, Decision, ActionItem
from app.models.knowledge import KnowledgeChunk, EmbeddingRecord
from app.services.ai.factory import get_embedding_provider, get_llm_provider
from app.schemas.chat import GroundedAnswerResponse, CitationRead


class RAGService:
    """Provides semantic vector indexing, hybrid intent-aware search, and grounded QA."""

    def __init__(self):
        self.embedder = get_embedding_provider()
        self.llm = get_llm_provider()

    async def index_meeting(self, db: AsyncSession, meeting_id: str) -> int:
        """Extract and index knowledge chunks with embeddings for a meeting (idempotent)."""
        # 1. Clear previous chunks and embeddings to ensure idempotency
        subquery = select(KnowledgeChunk.id).where(KnowledgeChunk.meeting_id == meeting_id)
        await db.execute(delete(EmbeddingRecord).where(EmbeddingRecord.chunk_id.in_(subquery)))
        await db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.meeting_id == meeting_id))
        await db.flush()

        chunks_to_create: List[Dict[str, Any]] = []
        chunk_idx = 0

        # 2. Gather transcript segments
        seg_stmt = (
            select(TranscriptSegment, Speaker.confirmed_name, Speaker.speaker_label)
            .outerjoin(Speaker, TranscriptSegment.speaker_id == Speaker.id)
            .where(TranscriptSegment.meeting_id == meeting_id)
            .order_by(TranscriptSegment.start_time.asc())
        )
        seg_res = await db.execute(seg_stmt)
        segments_data = list(seg_res.all())

        # Group segments into windowed blocks (e.g. 2-3 segments per block with overlap)
        window = []
        for row in segments_data:
            seg = row[0]
            speaker_name = row[1] or row[2] or "Unknown Speaker"
            window.append((seg, speaker_name))

            if len(window) >= 2:
                combined_text = " ".join([f"{s[1]}: {s[0].text}" for s in window])
                chunks_to_create.append({
                    "chunk_index": chunk_idx,
                    "chunk_type": "transcript_block",
                    "text": combined_text,
                    "start_time": window[0][0].start_time,
                    "end_time": window[-1][0].end_time,
                    "speaker_label": window[0][1]
                })
                chunk_idx += 1
                window = [window[-1]]  # 1-segment overlap

        if window:
            combined_text = " ".join([f"{s[1]}: {s[0].text}" for s in window])
            chunks_to_create.append({
                "chunk_index": chunk_idx,
                "chunk_type": "transcript_block",
                "text": combined_text,
                "start_time": window[0][0].start_time,
                "end_time": window[-1][0].end_time,
                "speaker_label": window[0][1]
            })
            chunk_idx += 1

        # 3. Index executive summary, key points, risks, and open questions
        sum_stmt = select(MeetingSummary).where(MeetingSummary.meeting_id == meeting_id)
        sum_res = await db.execute(sum_stmt)
        summary = sum_res.scalar_one_or_none()
        if summary:
            if summary.executive_summary or summary.key_points:
                chunks_to_create.append({
                    "chunk_index": chunk_idx,
                    "chunk_type": "summary",
                    "text": f"Executive Summary: {summary.executive_summary} Key Discussion Points: {' '.join(summary.key_points or [])}",
                    "start_time": 0.0,
                    "end_time": 0.0,
                    "speaker_label": "Meeting Summary"
                })
                chunk_idx += 1

            if summary.risks:
                chunks_to_create.append({
                    "chunk_index": chunk_idx,
                    "chunk_type": "risk_issue",
                    "text": f"Identified Risks, Blockers, and Challenges: {' '.join(summary.risks)}",
                    "start_time": 0.0,
                    "end_time": 0.0,
                    "speaker_label": "Meeting Risks"
                })
                chunk_idx += 1

            if summary.open_questions:
                chunks_to_create.append({
                    "chunk_index": chunk_idx,
                    "chunk_type": "open_questions",
                    "text": f"Unresolved Questions and Inquiries: {' '.join(summary.open_questions)}",
                    "start_time": 0.0,
                    "end_time": 0.0,
                    "speaker_label": "Open Questions"
                })
                chunk_idx += 1

        # 4. Index confirmed decisions
        dec_stmt = select(Decision).where(Decision.meeting_id == meeting_id)
        dec_res = await db.execute(dec_stmt)
        for dec in dec_res.scalars().all():
            chunks_to_create.append({
                "chunk_index": chunk_idx,
                "chunk_type": "decision",
                "text": f"Confirmed Decision: {dec.title}. Details: {dec.decision_text}. Responsible: {dec.responsible_person or 'Unassigned'}. Status: {dec.status}",
                "start_time": dec.evidence_timestamp or 0.0,
                "end_time": dec.evidence_timestamp or 0.0,
                "speaker_label": dec.responsible_person or "Decision"
            })
            chunk_idx += 1

        # 5. Index action items
        act_stmt = select(ActionItem).where(ActionItem.meeting_id == meeting_id)
        act_res = await db.execute(act_stmt)
        for act in act_res.scalars().all():
            chunks_to_create.append({
                "chunk_index": chunk_idx,
                "chunk_type": "action_item",
                "text": f"Action Item Task: {act.task_description}. Assigned Owner: {act.owner_name or 'Unassigned'}. Due Date: {act.due_date or 'No deadline'}. Priority: {act.priority}. Status: {act.status}",
                "start_time": act.evidence_timestamp or 0.0,
                "end_time": act.evidence_timestamp or 0.0,
                "speaker_label": act.owner_name or "Action Item"
            })
            chunk_idx += 1

        if not chunks_to_create:
            return 0

        # 6. Generate embeddings in batch
        texts_to_embed = [c["text"] for c in chunks_to_create]
        vectors = await self.embedder.embed_texts(texts_to_embed)
        emb_model_name = getattr(self.embedder, "model_name", "all-MiniLM-L6-v2")

        # 7. Persist KnowledgeChunks and EmbeddingRecords
        for c_dict, vec in zip(chunks_to_create, vectors):
            chunk_obj = KnowledgeChunk(
                meeting_id=meeting_id,
                chunk_index=c_dict["chunk_index"],
                chunk_type=c_dict["chunk_type"],
                text=c_dict["text"],
                start_time=c_dict["start_time"],
                end_time=c_dict["end_time"],
                speaker_label=c_dict["speaker_label"]
            )
            db.add(chunk_obj)
            await db.flush()

            emb_obj = EmbeddingRecord(
                chunk_id=chunk_obj.id,
                embedding=vec,
                dimensions=len(vec),
                model_name=emb_model_name
            )
            db.add(emb_obj)

        await db.commit()
        return len(chunks_to_create)

    def _detect_intent(self, query: str) -> Dict[str, bool]:
        """Detect query intent to apply specialized chunk boosting."""
        q_lower = query.lower()
        return {
            "decision": any(w in q_lower for w in ["decision", "decisions", "decide", "decided", "agreed", "consensus", "approved", "chosen"]),
            "action_item": any(w in q_lower for w in ["action item", "action items", "task", "tasks", "assigned", "assign", "deadline", "deadlines", "due", "deliver", "todo", "to-do", "to do", "next step", "next steps"]),
            "problem_blocker": any(w in q_lower for w in ["blocker", "blockers", "problem", "problems", "issue", "issues", "risk", "risks", "concern", "concerns", "challenge", "challenges", "unresolved"]),
            "summary_overview": any(w in q_lower for w in ["summary", "summarize", "overview", "what happened", "what was discussed", "main topics"]),
        }

    async def search(
        self,
        db: AsyncSession,
        organization_id: str,
        query: str,
        workspace_id: Optional[str] = None,
        meeting_id: Optional[str] = None,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Perform hybrid intent-aware search across authorized meetings."""
        # Query embedding
        q_vectors = await self.embedder.embed_texts([query])
        q_vec = q_vectors[0]

        # Retrieve candidate chunks scoped to organization
        base_query = (
            select(KnowledgeChunk, EmbeddingRecord.embedding, Meeting.id, Meeting.title)
            .join(Meeting, KnowledgeChunk.meeting_id == Meeting.id)
            .join(EmbeddingRecord, KnowledgeChunk.id == EmbeddingRecord.chunk_id)
            .where(Meeting.organization_id == organization_id)
        )

        if workspace_id:
            base_query = base_query.where(Meeting.workspace_id == workspace_id)
        if meeting_id:
            base_query = base_query.where(Meeting.id == meeting_id)

        res = await db.execute(base_query)
        candidates = list(res.all())

        if not candidates:
            return []

        intents = self._detect_intent(query)
        stop_words = {
            "what", "when", "where", "which", "who", "whom", "this", "that", "these", "those",
            "is", "are", "was", "were", "the", "a", "an", "for", "did", "team", "about", "from", "with",
            "meeting", "meetings", "during", "there", "their", "they", "have", "been", "tell", "show"
        }
        query_words = [w.lower() for w in re.findall(r'\b[a-zA-Z]{3,}\b', query) if w.lower() not in stop_words]

        scored_results = []
        for chunk, emb_list, m_id, m_title in candidates:
            # 1. Cosine similarity
            cosine_sim = self._cosine_similarity(q_vec, emb_list)

            # 2. Lexical keyword overlap
            chunk_lower = chunk.text.lower()
            keyword_matches = sum(1 for qw in query_words if qw in chunk_lower)
            keyword_score = min(keyword_matches * 0.15, 0.45)

            # 3. Intent-aware boosting
            intent_boost = 0.0
            if intents["decision"] and chunk.chunk_type == "decision":
                intent_boost += 0.25
            if intents["action_item"] and chunk.chunk_type == "action_item":
                intent_boost += 0.25
            if intents["problem_blocker"] and chunk.chunk_type in ["risk_issue", "open_questions"]:
                intent_boost += 0.25
            if intents["summary_overview"] and chunk.chunk_type == "summary":
                intent_boost += 0.25

            # 4. Speaker relevance boost
            if chunk.speaker_label and chunk.speaker_label.lower() in query.lower():
                intent_boost += 0.20

            total_score = (cosine_sim * 0.6) + keyword_score + intent_boost

            scored_results.append({
                "chunk_id": chunk.id,
                "meeting_id": m_id,
                "meeting_title": m_title,
                "text": chunk.text,
                "chunk_type": chunk.chunk_type,
                "start_time": chunk.start_time,
                "end_time": chunk.end_time,
                "speaker_label": chunk.speaker_label,
                "score": total_score
            })

        # Rank by score descending
        scored_results.sort(key=lambda x: x["score"], reverse=True)
        return scored_results[:top_k]

    async def answer_query(
        self,
        db: AsyncSession,
        query: str,
        organization_id: str,
        workspace_id: Optional[str] = None,
        meeting_id: Optional[str] = None,
        top_k: int = 5
    ) -> GroundedAnswerResponse:
        """Synthesize a grounded answer using retrieved chunks with timestamp citations and model info."""
        retrieved_chunks = await self.search(
            db=db,
            organization_id=organization_id,
            query=query,
            workspace_id=workspace_id,
            meeting_id=meeting_id,
            top_k=top_k
        )

        model_name = getattr(self.llm, "model", "local-rule-based-fallback (ollama offline)")

        if not retrieved_chunks:
            return GroundedAnswerResponse(
                answer="The meeting records do not contain sufficient evidence to answer this question.",
                citations=[],
                found_evidence=False,
                model_name=model_name
            )

        context_payload = [
            {
                "meeting_id": c["meeting_id"],
                "meeting_title": c["meeting_title"],
                "text": c["text"],
                "start_time": c["start_time"],
                "end_time": c["end_time"],
                "speaker": c["speaker_label"]
            }
            for c in retrieved_chunks
        ]

        llm_response = await self.llm.answer_question(query=query, context=context_payload)

        citations = []
        if llm_response.found_evidence and retrieved_chunks:
            for c in retrieved_chunks[:3]:
                citations.append(
                    CitationRead(
                        meeting_id=c["meeting_id"],
                        meeting_title=c["meeting_title"],
                        timestamp_start=c["start_time"],
                        timestamp_end=c["end_time"],
                        speaker_name=c["speaker_label"],
                        quote=c["text"][:200]
                    )
                )

        return GroundedAnswerResponse(
            answer=llm_response.answer,
            citations=citations if llm_response.found_evidence else [],
            found_evidence=llm_response.found_evidence,
            model_name=getattr(llm_response, "model_name", None) or model_name
        )

    async def suggest_questions(
        self,
        db: AsyncSession,
        meeting_id: Optional[str] = None,
        organization_id: Optional[str] = None
    ) -> List[str]:
        """Generate smart contextual suggested questions grounded in real meeting content."""
        questions = []

        if meeting_id:
            # Check decisions
            dec_stmt = select(Decision).where(Decision.meeting_id == meeting_id).limit(2)
            dec_res = await db.execute(dec_stmt)
            decisions = list(dec_res.scalars().all())
            if decisions:
                questions.append("What decisions were confirmed in this meeting?")
                if decisions[0].title:
                    questions.append(f"What was decided regarding {decisions[0].title}?")

            # Check action items
            act_stmt = select(ActionItem).where(ActionItem.meeting_id == meeting_id).limit(2)
            act_res = await db.execute(act_stmt)
            actions = list(act_res.scalars().all())
            if actions:
                questions.append("What action items and deadlines were assigned?")
                if actions[0].owner_name and actions[0].owner_name != "Unassigned":
                    questions.append(f"What tasks are assigned to {actions[0].owner_name}?")

            # Check summary risks
            sum_stmt = select(MeetingSummary).where(MeetingSummary.meeting_id == meeting_id)
            sum_res = await db.execute(sum_stmt)
            summary = sum_res.scalar_one_or_none()
            if summary and summary.risks:
                questions.append("What blockers or risks were discussed?")

            # Default meeting questions
            questions.append("What were the main topics discussed?")
            questions.append("What did each participant contribute to the discussion?")

        elif organization_id:
            # Organization-wide suggested questions
            questions = [
                "What major decisions were agreed upon across recent meetings?",
                "Which action items and commitments are currently open?",
                "What recurring blockers or risks have been identified by the team?",
                "What progress has been made since the previous architecture review?",
                "Which team members have upcoming deadlines scheduled?"
            ]

        # Deduplicate and return top 5
        seen = set()
        deduped = []
        for q in questions:
            if q not in seen:
                seen.add(q)
                deduped.append(q)
        return deduped[:5]

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Compute cosine similarity between two float vectors."""
        dot = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = math.sqrt(sum(a * a for a in vec1)) or 1.0
        norm2 = math.sqrt(sum(b * b for b in vec2)) or 1.0
        return dot / (norm1 * norm2)
