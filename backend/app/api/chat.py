"""Meeting and Organization Chat API."""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.meeting import Meeting
from app.models.transcript import TranscriptSegment
from app.schemas.chat import (
    ChatQuestionRequest,
    GroundedAnswerResponse,
    CitationRead
)
from app.services.ai.factory import get_llm_provider

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.post("", response_model=GroundedAnswerResponse)
async def query_meeting_chat(
    payload: ChatQuestionRequest,
    db: AsyncSession = Depends(get_db)
):
    """Query single-meeting or organization-wide meeting memory with grounded citations."""
    context_chunks: List[Dict[str, Any]] = []

    if payload.meeting_id:
        stmt = select(Meeting).where(Meeting.id == payload.meeting_id)
        res = await db.execute(stmt)
        meeting = res.scalar_one_or_none()
        if not meeting:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

        # Fetch transcript segments as context
        seg_stmt = (
            select(TranscriptSegment)
            .where(TranscriptSegment.meeting_id == payload.meeting_id)
            .order_by(TranscriptSegment.start_time.asc())
            .limit(payload.top_k)
        )
        seg_res = await db.execute(seg_stmt)
        segments = list(seg_res.scalars().all())

        for s in segments:
            context_chunks.append({
                "meeting_id": s.meeting_id,
                "text": s.text,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "speaker": s.speaker_id or "Unknown"
            })

    llm = get_llm_provider()
    result = await llm.answer_question(query=payload.query, context=context_chunks)

    formatted_citations = [
        CitationRead(
            meeting_id=c.get("meeting_id", payload.meeting_id or ""),
            timestamp_start=c.get("timestamp_start"),
            timestamp_end=c.get("timestamp_end"),
            speaker_name=c.get("speaker_name"),
            quote=c.get("quote", "")
        )
        for c in result.citations
    ]

    return GroundedAnswerResponse(
        answer=result.answer,
        citations=formatted_citations,
        found_evidence=result.found_evidence
    )

