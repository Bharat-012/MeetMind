"""Pydantic schemas for Meetings, Ingestion, and Status."""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, HttpUrl, ConfigDict
from app.models.meeting import ProcessingStatus, SourceType


class MeetingBase(BaseModel):
    title: str
    description: Optional[str] = None
    workspace_id: str
    project_id: Optional[str] = None


class MeetingCreate(MeetingBase):
    organization_id: str
    source_type: SourceType = SourceType.UPLOAD


class URLImportRequest(BaseModel):
    organization_id: str
    workspace_id: str
    project_id: Optional[str] = None
    title: Optional[str] = None
    url: str


class MeetingRead(MeetingBase):
    id: str
    organization_id: str
    source_type: SourceType
    source_url: Optional[str] = None
    original_filename: Optional[str] = None
    duration_seconds: Optional[float] = None
    status: ProcessingStatus
    error_message: Optional[str] = None
    recorded_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class MeetingListResponse(BaseModel):
    items: List[MeetingRead]
    total: int


class ProcessingStatusResponse(BaseModel):
    meeting_id: str
    status: ProcessingStatus
    progress_percent: int
    stage: ProcessingStatus
    error_details: Optional[str] = None

