"""Retrieval-Augmented Generation (RAG) and hybrid search service."""
import math
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
    """Provides semantic vector indexing, hybrid search, and grounded QA."""

    def __init__(self):
        self.embedder = get_embedding_provider()
        self.llm = get_llm_provider()

    async def index_meeting(self, db: AsyncSession, meeting_id: str) -> int:
        """Extract and index knowledge chunks with embeddings for a meeting (idempotent)."""
        # 1. Clear previous chunks to ensure idempotency
        del_stmt = delete(KnowledgeChunk).where(KnowledgeChunk.meeting_id == meeting_id)
        await db.execute(del_stmt)

        # 2. Gather transcript segments
        seg_stmt = (
            select(TranscriptSegment, Speaker.confirmed_name, Speaker.speaker_label)
            .outerjoin(Speaker, TranscriptSegment.speaker_id == Speaker.id)
            .where(TranscriptSegment.meeting_id == meeting_id)
            .order_by(TranscriptSegment.start_time.asc())
        )
        seg_res = await db.execute(seg_stmt)
        segments_data = list(seg_res.all())

        chunks_to_create: List[Dict[str, Any]] = []
        chunk_idx = 0

        # Group segments into windowed chunks (e.g. 2-3 segments per chunk)
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

        # Also index summary, decisions, and action items if available
        sum_stmt = select(MeetingSummary).where(MeetingSummary.meeting_id == meeting_id)
        sum_res = await db.execute(sum_stmt)
        summary = sum_res.scalar_one_or_none()
        if summary:
            chunks_to_create.append({
                "chunk_index": chunk_idx,
                "chunk_type": "summary",
                "text": f"Executive Summary: {summary.executive_summary} Key Points: {' '.join(summary.key_points)}",
                "start_time": 0.0,
                "end_time": 0.0,
                "speaker_label": "Meeting Summary"
            })
            chunk_idx += 1

        dec_stmt = select(Decision).where(Decision.meeting_id == meeting_id)
        dec_res = await db.execute(dec_stmt)
        for dec in dec_res.scalars().all():
            chunks_to_create.append({
                "chunk_index": chunk_idx,
                "chunk_type": "decision",
                "text": f"Confirmed Decision: {dec.title}. Details: {dec.decision_text}. Responsible: {dec.responsible_person or 'Unassigned'}",
                "start_time": dec.evidence_timestamp or 0.0,
                "end_time": dec.evidence_timestamp or 0.0,
                "speaker_label": dec.responsible_person or "Decision"
            })
            chunk_idx += 1

        if not chunks_to_create:
            return 0

        # 3. Generate embeddings in batch
        texts_to_embed = [c["text"] for c in chunks_to_create]
        vectors = await self.embedder.embed_texts(texts_to_embed)

        # 4. Save KnowledgeChunks and EmbeddingRecords
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
                model_name="deterministic-embedder"
            )
            db.add(emb_obj)

        await db.commit()
        return len(chunks_to_create)

    async def search(
        self,
        db: AsyncSession,
        organization_id: str,
        query: str,
        workspace_id: Optional[str] = None,
        meeting_id: Optional[str] = None,
        top_k: int = 5
    ) -> List[Dict[str, Any]]:
        """Perform hybrid search (cosine vector similarity + keyword matching) across authorized meetings."""
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

        query_terms = set(query.lower().split())

        scored_results = []
        for chunk, emb_list, m_id, m_title in candidates:
            # 1. Cosine similarity
            cosine_sim = self._cosine_similarity(q_vec, emb_list)

            # 2. Keyword overlap bonus
            chunk_terms = set(chunk.text.lower().split())
            overlap = len(query_terms.intersection(chunk_terms))
            keyword_score = min(overlap * 0.1, 0.4)

            total_score = (cosine_sim * 0.7) + keyword_score

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
        """Synthesize a grounded answer using retrieved chunks with timestamp citations."""
        retrieved_chunks = await self.search(
            db=db,
            organization_id=organization_id,
            query=query,
            workspace_id=workspace_id,
            meeting_id=meeting_id,
            top_k=top_k
        )

        if not retrieved_chunks:
            return GroundedAnswerResponse(
                answer="The organization's meeting records do not contain sufficient evidence to answer this question.",
                citations=[],
                found_evidence=False
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
            found_evidence=llm_response.found_evidence
        )

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Compute cosine similarity between two float vectors."""
        dot = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = math.sqrt(sum(a * a for a in vec1)) or 1.0
        norm2 = math.sqrt(sum(b * b for b in vec2)) or 1.0
        return dot / (norm1 * norm2)
