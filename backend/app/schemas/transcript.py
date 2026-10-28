"""Pydantic schemas for Transcripts and Speakers."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict


class TranscriptSegmentRead(BaseModel):
    id: str
    meeting_id: str
    speaker_id: Optional[str] = None
    speaker_label: Optional[str] = None
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
    participant_id: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)


class SpeakerUpdateRequest(BaseModel):
    confirmed_name: str
    participant_id: Optional[str] = None


class FullTranscriptResponse(BaseModel):
    meeting_id: str
    segments: List[TranscriptSegmentRead]
    speakers: List[SpeakerRead]

