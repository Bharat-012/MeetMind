"""Pydantic schemas for Transcripts, Speakers, and Organization Speaker Profiles."""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class TranscriptSegmentRead(BaseModel):
    id: str
    meeting_id: str
    speaker_id: Optional[str] = None
    speaker_label: Optional[str] = None
    speaker_name: Optional[str] = None
    is_confirmed: bool = False
    start_time: float
    end_time: float
    text: str
    confidence: Optional[float] = None
    words: Optional[list] = None
    model_config = ConfigDict(from_attributes=True)


class SpeakerRead(BaseModel):
    id: str
    meeting_id: str
    speaker_label: str
    confirmed_name: Optional[str] = None
    is_confirmed: bool = False
    participant_id: Optional[str] = None
    total_talk_time_seconds: Optional[float] = None
    segment_count: Optional[int] = None
    talk_time_percentage: Optional[float] = None
    model_config = ConfigDict(from_attributes=True)


class SpeakerUpdateRequest(BaseModel):
    confirmed_name: str = Field(..., min_length=1, max_length=255)
    participant_id: Optional[str] = None
    notes: Optional[str] = None
    user_id: Optional[str] = None


class SpeakerStatsRead(BaseModel):
    speaker_id: str
    speaker_label: str
    display_name: str
    is_confirmed: bool
    total_seconds: float
    segment_count: int
    percentage: float


class SpeakerAssignmentAuditRead(BaseModel):
    id: str
    action: str
    speaker_id: str
    meeting_id: str
    speaker_label: str
    previous_name: Optional[str] = None
    new_name: Optional[str] = None
    previous_participant_id: Optional[str] = None
    new_participant_id: Optional[str] = None
    assigned_by_user_id: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime


class FullTranscriptResponse(BaseModel):
    meeting_id: str
    segments: List[TranscriptSegmentRead]
    speakers: List[SpeakerRead]


# Organization-Level Speaker Profile Schemas
class ParticipantCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None


class ParticipantUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None


class ParticipantRead(BaseModel):
    id: str
    organization_id: str
    name: str
    email: Optional[str] = None
    description: Optional[str] = None
    avatar_url: Optional[str] = None
    total_meetings: int = 0
    total_talk_time_seconds: float = 0.0
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MeetingAppearanceRead(BaseModel):
    meeting_id: str
    meeting_title: str
    speaker_id: str
    speaker_label: str
    segment_count: int
    talk_time_seconds: float
    meeting_created_at: datetime


class ParticipantHistoryRead(BaseModel):
    participant: ParticipantRead
    appearances: List[MeetingAppearanceRead]
    recent_segments: List[TranscriptSegmentRead]
