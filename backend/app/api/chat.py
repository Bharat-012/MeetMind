"""Meeting and Organization Chat API with grounded retrieval, verification, and tenant isolation."""
import asyncio
import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.meeting import Meeting
from app.models.transcript import TranscriptSegment, Speaker
from app.models.knowledge import ChatConversation, ChatMessage, MessageSender, ChatScope
from app.schemas.chat import (
    ChatQuestionRequest,
    GroundedAnswerResponse,
    CitationRead,
    ChatConversationRead,
    ChatMessageRead,
    CreateConversationRequest,
    SendMessageRequest,
    SuggestedQuestionsResponse
)
from app.services.rag_service import RAGService
from app.services.ai.factory import get_llm_provider

router = APIRouter(prefix="/chat", tags=["Chat"])


@router.get("/suggested-questions", response_model=SuggestedQuestionsResponse)
async def get_suggested_questions(
    meeting_id: Optional[str] = Query(None),
    organization_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve grounded contextual suggested questions for a meeting or organization."""
    rag_service = RAGService()
    questions = await rag_service.suggest_questions(
        db=db,
        meeting_id=meeting_id,
        organization_id=organization_id
    )
    return SuggestedQuestionsResponse(
        meeting_id=meeting_id,
        organization_id=organization_id,
        questions=questions
    )


@router.get("/conversations", response_model=List[ChatConversationRead])
async def list_conversations(
    meeting_id: Optional[str] = Query(None),
    organization_id: Optional[str] = Query(None),
    workspace_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """List persistent chat conversations filtered by meeting, organization, or workspace."""
    stmt = select(ChatConversation).options(selectinload(ChatConversation.messages))

    if meeting_id:
        stmt = stmt.where(ChatConversation.meeting_id == meeting_id)
    elif organization_id:
        stmt = stmt.where(ChatConversation.organization_id == organization_id)
    if workspace_id:
        stmt = stmt.where(ChatConversation.workspace_id == workspace_id)

    stmt = stmt.order_by(ChatConversation.created_at.desc())
    res = await db.execute(stmt)
    conversations = res.scalars().all()
    return conversations


@router.post("/conversations", response_model=ChatConversationRead, status_code=status.HTTP_201_CREATED)
async def create_conversation(
    payload: CreateConversationRequest,
    db: AsyncSession = Depends(get_db)
):
    """Create a new persistent conversation for a meeting or organization."""
    org_id = payload.organization_id
    if payload.meeting_id:
        meeting_stmt = select(Meeting).where(Meeting.id == payload.meeting_id)
        m_res = await db.execute(meeting_stmt)
        meeting = m_res.scalar_one_or_none()
        if not meeting:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
        if org_id and org_id != meeting.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: meeting does not belong to specified organization"
            )
        org_id = meeting.organization_id

    conv = ChatConversation(
        organization_id=org_id,
        workspace_id=payload.workspace_id,
        meeting_id=payload.meeting_id,
        title=payload.title or "New Conversation",
        scope=payload.scope
    )
    db.add(conv)
    await db.commit()

    # Re-fetch with messages
    stmt = select(ChatConversation).options(selectinload(ChatConversation.messages)).where(ChatConversation.id == conv.id)
    res = await db.execute(stmt)
    return res.scalar_one()


@router.get("/conversations/{conversation_id}", response_model=ChatConversationRead)
async def get_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Fetch a single conversation with its message history."""
    stmt = select(ChatConversation).options(selectinload(ChatConversation.messages)).where(ChatConversation.id == conversation_id)
    res = await db.execute(stmt)
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return conv


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_200_OK)
async def delete_conversation(
    conversation_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a chat conversation and all associated messages."""
    stmt = select(ChatConversation).where(ChatConversation.id == conversation_id)
    res = await db.execute(stmt)
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    await db.delete(conv)
    await db.commit()
    return {"ok": True, "deleted_id": conversation_id}


@router.post("/conversations/{conversation_id}/messages", response_model=GroundedAnswerResponse)
async def send_conversation_message(
    conversation_id: str,
    payload: SendMessageRequest,
    db: AsyncSession = Depends(get_db)
):
    """Post a user message to a conversation, generate a grounded answer, and persist both."""
    stmt = select(ChatConversation).options(selectinload(ChatConversation.messages)).where(ChatConversation.id == conversation_id)
    res = await db.execute(stmt)
    conv = res.scalar_one_or_none()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")

    user_msg = ChatMessage(
        conversation_id=conv.id,
        sender=MessageSender.USER,
        content=payload.content,
        citations=[]
    )
    db.add(user_msg)

    # Auto-title conversation if default
    if conv.title == "New Conversation":
        conv.title = payload.content[:40] + ("..." if len(payload.content) > 40 else "")

    # Execute grounded RAG query
    rag_service = RAGService()
    rag_answer = await rag_service.answer_query(
        db=db,
        query=payload.content,
        organization_id=conv.organization_id,
        workspace_id=conv.workspace_id,
        meeting_id=conv.meeting_id,
        top_k=5
    )

    # Persist assistant message
    asst_citations = [c.model_dump() for c in rag_answer.citations]
    asst_msg = ChatMessage(
        conversation_id=conv.id,
        sender=MessageSender.ASSISTANT,
        content=rag_answer.answer,
        citations=asst_citations
    )
    db.add(asst_msg)
    await db.commit()

    return rag_answer


@router.post("", response_model=GroundedAnswerResponse)
async def query_meeting_chat(
    payload: ChatQuestionRequest,
    db: AsyncSession = Depends(get_db)
):
    """Query single-meeting or organization-wide meeting memory with grounded citations."""
    rag_service = RAGService()
    org_id = payload.organization_id

    # If conversation_id is supplied, record user query in DB
    conversation = None
    if payload.conversation_id:
        conv_stmt = select(ChatConversation).where(ChatConversation.id == payload.conversation_id)
        conv_res = await db.execute(conv_stmt)
        conversation = conv_res.scalar_one_or_none()
        if conversation:
            user_msg = ChatMessage(
                conversation_id=conversation.id,
                sender=MessageSender.USER,
                content=payload.query,
                citations=[]
            )
            db.add(user_msg)
            if conversation.title == "New Conversation":
                conversation.title = payload.query[:40] + ("..." if len(payload.query) > 40 else "")

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
            if conversation:
                asst_msg = ChatMessage(
                    conversation_id=conversation.id,
                    sender=MessageSender.ASSISTANT,
                    content=rag_answer.answer,
                    citations=[c.model_dump() for c in rag_answer.citations]
                )
                db.add(asst_msg)
                await db.commit()
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
                    ans = GroundedAnswerResponse(
                        answer=direct_ans.answer,
                        citations=citations,
                        found_evidence=True,
                        model_name=getattr(direct_ans, "model_name", "ollama:llama3.2")
                    )
                    if conversation:
                        asst_msg = ChatMessage(
                            conversation_id=conversation.id,
                            sender=MessageSender.ASSISTANT,
                            content=ans.answer,
                            citations=[c.model_dump() for c in ans.citations]
                        )
                        db.add(asst_msg)
                        await db.commit()
                    return ans

        # 3. Explicit insufficient evidence
        ans = GroundedAnswerResponse(
            answer="The meeting records do not contain sufficient evidence to answer this question.",
            citations=[],
            found_evidence=False,
            model_name="meetmind-retriever"
        )
        if conversation:
            asst_msg = ChatMessage(
                conversation_id=conversation.id,
                sender=MessageSender.ASSISTANT,
                content=ans.answer,
                citations=[]
            )
            db.add(asst_msg)
            await db.commit()
        return ans

    elif org_id:
        ans = await rag_service.answer_query(
            db=db,
            query=payload.query,
            organization_id=org_id,
            workspace_id=payload.workspace_id,
            top_k=payload.top_k
        )
        if conversation:
            asst_msg = ChatMessage(
                conversation_id=conversation.id,
                sender=MessageSender.ASSISTANT,
                content=ans.answer,
                citations=[c.model_dump() for c in ans.citations]
            )
            db.add(asst_msg)
            await db.commit()
        return ans

    return GroundedAnswerResponse(
        answer="The meeting records do not contain sufficient evidence to answer this question.",
        citations=[],
        found_evidence=False,
        model_name="meetmind-retriever"
    )


@router.post("/stream")
async def stream_meeting_chat(
    payload: ChatQuestionRequest,
    db: AsyncSession = Depends(get_db)
):
    """Server-Sent Events (SSE) streaming endpoint for meeting and organizational chat."""
    # First, run the RAG answer computation with DB session
    rag_service = RAGService()
    org_id = payload.organization_id

    if payload.meeting_id:
        stmt = select(Meeting).where(Meeting.id == payload.meeting_id)
        res = await db.execute(stmt)
        meeting = res.scalar_one_or_none()
        if not meeting:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
        if org_id and org_id != meeting.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: meeting does not belong to specified organization"
            )
        org_id = meeting.organization_id

        rag_answer = await rag_service.answer_query(
            db=db,
            query=payload.query,
            organization_id=org_id,
            workspace_id=payload.workspace_id,
            meeting_id=payload.meeting_id,
            top_k=payload.top_k
        )
    elif org_id:
        rag_answer = await rag_service.answer_query(
            db=db,
            query=payload.query,
            organization_id=org_id,
            workspace_id=payload.workspace_id,
            top_k=payload.top_k
        )
    else:
        rag_answer = GroundedAnswerResponse(
            answer="The meeting records do not contain sufficient evidence to answer this question.",
            citations=[],
            found_evidence=False,
            model_name="meetmind-retriever"
        )

    # If conversation_id is provided, persist messages
    if payload.conversation_id:
        conv_stmt = select(ChatConversation).where(ChatConversation.id == payload.conversation_id)
        conv_res = await db.execute(conv_stmt)
        conversation = conv_res.scalar_one_or_none()
        if conversation:
            user_msg = ChatMessage(
                conversation_id=conversation.id,
                sender=MessageSender.USER,
                content=payload.query,
                citations=[]
            )
            asst_msg = ChatMessage(
                conversation_id=conversation.id,
                sender=MessageSender.ASSISTANT,
                content=rag_answer.answer,
                citations=[c.model_dump() for c in rag_answer.citations]
            )
            db.add(user_msg)
            db.add(asst_msg)
            if conversation.title == "New Conversation":
                conversation.title = payload.query[:40] + ("..." if len(payload.query) > 40 else "")
            await db.commit()

    async def event_generator():
        # 1. Initial event with model name and status
        yield f"data: {json.dumps({'type': 'start', 'model_name': rag_answer.model_name or 'ollama:llama3.2'})}\n\n"
        await asyncio.sleep(0.02)

        # 2. Stream tokens from the answer
        words = rag_answer.answer.split(" ")
        for i, word in enumerate(words):
            chunk = word if i == len(words) - 1 else word + " "
            yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
            await asyncio.sleep(0.015)

        # 3. Final event with citations and complete payload
        done_payload = {
            "type": "done",
            "answer": rag_answer.answer,
            "citations": [c.model_dump() for c in rag_answer.citations],
            "found_evidence": rag_answer.found_evidence,
            "model_name": rag_answer.model_name,
            "suggested_followups": rag_answer.suggested_followups or []
        }
        yield f"data: {json.dumps(done_payload)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
