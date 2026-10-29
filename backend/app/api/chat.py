"""Meeting and Organization Chat API with grounded retrieval, verification, and tenant isolation."""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.meeting import Meeting
from app.models.transcript import TranscriptSegment, Speaker
from app.schemas.chat import (
    ChatQuestionRequest,
    GroundedAnswerResponse,
    CitationRead
)
from app.services.rag_service import RAGService
from app.services.ai.factory import get_llm_provider

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("", response_model=GroundedAnswerResponse)
async def query_meeting_chat(
    payload: ChatQuestionRequest,
    db: AsyncSession = Depends(get_db)
):
    """Query single-meeting or organization-wide meeting memory with grounded citations."""
    rag_service = RAGService()
    org_id = payload.organization_id

    if payload.meeting_id:
        stmt = select(Meeting).where(Meeting.id == payload.meeting_id)
        res = await db.execute(stmt)
        meeting = res.scalar_one_or_none()
        if not meeting:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

        # Security check: if client specified organization_id, verify it matches
        if org_id and org_id != meeting.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: meeting does not belong to specified organization"
            )
        org_id = meeting.organization_id

        # 1. Attempt RAG query over indexed chunks (segments, summary, decisions, action items)
        rag_answer = await rag_service.answer_query(
            db=db,
            query=payload.query,
            organization_id=org_id,
            workspace_id=payload.workspace_id,
            meeting_id=payload.meeting_id,
            top_k=payload.top_k
        )
        if rag_answer.found_evidence:
            return rag_answer

        # 2. Fallback to direct meeting segments if RAG vector index had no match
        seg_stmt = (
            select(TranscriptSegment, Speaker.confirmed_name, Speaker.speaker_label)
            .outerjoin(Speaker, TranscriptSegment.speaker_id == Speaker.id)
            .where(TranscriptSegment.meeting_id == payload.meeting_id)
            .order_by(TranscriptSegment.start_time.asc())
            .limit(payload.top_k * 3)
        )
        seg_res = await db.execute(seg_stmt)
        segments = list(seg_res.all())

        if segments:
            query_terms = [w.lower() for w in payload.query.split() if len(w) > 3]
            matching_chunks: List[Dict[str, Any]] = []
            for seg, conf_name, spk_label in segments:
                text_lower = seg.text.lower()
                if not query_terms or any(qt in text_lower for qt in query_terms):
                    matching_chunks.append({
                        "meeting_id": seg.meeting_id,
                        "text": seg.text,
                        "start_time": seg.start_time,
                        "end_time": seg.end_time,
                        "speaker": conf_name or spk_label or "Speaker"
                    })

            if matching_chunks:
                llm = get_llm_provider()
                direct_ans = await llm.answer_question(query=payload.query, context=matching_chunks[:payload.top_k])
                if direct_ans.found_evidence:
                    citations = [
                        CitationRead(
                            meeting_id=payload.meeting_id,
                            meeting_title=meeting.title,
                            timestamp_start=c.get("timestamp_start"),
                            timestamp_end=c.get("timestamp_end"),
                            speaker_name=c.get("speaker_name"),
                            quote=c.get("quote", "")
                        )
                        for c in direct_ans.citations
                    ]
                    return GroundedAnswerResponse(
                        answer=direct_ans.answer,
                        citations=citations,
                        found_evidence=True
                    )

        # 3. Explicit insufficient evidence
        return GroundedAnswerResponse(
            answer="The meeting records do not contain sufficient evidence to answer this question.",
            citations=[],
            found_evidence=False
        )

    elif org_id:
        return await rag_service.answer_query(
            db=db,
            query=payload.query,
            organization_id=org_id,
            workspace_id=payload.workspace_id,
            top_k=payload.top_k
        )

    return GroundedAnswerResponse(
        answer="The meeting records do not contain sufficient evidence to answer this question.",
        citations=[],
        found_evidence=False
    )
