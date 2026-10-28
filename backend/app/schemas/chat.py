"""Pydantic schemas for Meeting and Organization Chat."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from app.models.knowledge import ChatScope, MessageSender


class CitationRead(BaseModel):
    meeting_id: str
    meeting_title: Optional[str] = None
    timestamp_start: Optional[float] = None
    timestamp_end: Optional[float] = None
    speaker_name: Optional[str] = None
    quote: str


class ChatQuestionRequest(BaseModel):
    query: str
    meeting_id: Optional[str] = None  # None indicates organization-wide search
    scope: ChatScope = ChatScope.SINGLE_MEETING
    top_k: int = 5


class ChatMessageRead(BaseModel):
    id: str
    conversation_id: str
    sender: MessageSender
    content: str
    citations: List[dict]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ChatConversationRead(BaseModel):
    id: str
    organization_id: str
    workspace_id: Optional[str] = None
    meeting_id: Optional[str] = None
    title: str
    scope: ChatScope
    messages: List[ChatMessageRead]
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class GroundedAnswerResponse(BaseModel):
    answer: str
    citations: List[CitationRead]
    found_evidence: bool

