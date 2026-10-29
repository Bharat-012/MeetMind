"""Pydantic schemas for Summaries, Chronological Narrative, Decisions, and Action Items."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict
from app.models.intelligence import DecisionStatus, ActionItemStatus, Priority


class ChronologicalEventRead(BaseModel):
    timestamp: float
    speaker: str
    description: str
    event_type: str = "contribution"  # proposal, agreement, disagreement, question, clarification, conclusion
    source_segment_id: Optional[str] = None
    evidence_quote: Optional[str] = None


class MeetingSummaryRead(BaseModel):
    id: str
    meeting_id: str
    executive_summary: str
    key_points: List[str]
    risks: List[str]
    open_questions: List[str]
    next_steps: List[str]
    model_name: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ShortTranscriptRead(BaseModel):
    id: str
    meeting_id: str
    narrative_text: str
    chronological_events: List[Dict[str, Any]]
    model_name: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class DecisionRead(BaseModel):
    id: str
    meeting_id: str
    title: str
    decision_text: str
    responsible_person: Optional[str] = None
    status: DecisionStatus
    source_segment_id: Optional[str] = None
    evidence_timestamp: Optional[float] = None
    evidence_quote: Optional[str] = None
    model_name: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ActionItemRead(BaseModel):
    id: str
    meeting_id: str
    task_description: str
    owner_name: Optional[str] = None
    due_date: Optional[str] = None
    priority: Priority
    status: ActionItemStatus
    source_segment_id: Optional[str] = None
    evidence_timestamp: Optional[float] = None
    evidence_quote: Optional[str] = None
    model_name: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class ActionItemStatusUpdate(BaseModel):
    status: ActionItemStatus
    notes: Optional[str] = None

