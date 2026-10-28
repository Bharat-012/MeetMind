"""Meeting, media asset, and processing job models."""
import enum
from typing import List, Optional
from sqlalchemy import String, Integer, Float, Enum, ForeignKey, JSON, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid, utc_now


class ProcessingStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    UPLOADED = "UPLOADED"
    VALIDATING = "VALIDATING"
    EXTRACTING_MEDIA = "EXTRACTING_MEDIA"
    TRANSCRIBING = "TRANSCRIBING"
    DIARIZING = "DIARIZING"
    ALIGNING_SPEAKERS = "ALIGNING_SPEAKERS"
    GENERATING_SUMMARY = "GENERATING_SUMMARY"
    INDEXING_KNOWLEDGE = "INDEXING_KNOWLEDGE"
    COMPLETED = "COMPLETED"
    PARTIALLY_COMPLETED = "PARTIALLY_COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class SourceType(str, enum.Enum):
    UPLOAD = "UPLOAD"
    YOUTUBE = "YOUTUBE"
    GOOGLE_MEET = "GOOGLE_MEET"
    ZOOM = "ZOOM"
    TEAMS = "TEAMS"
    LIVE_STREAM = "LIVE_STREAM"


class Meeting(Base, TimestampMixin):
    __tablename__ = "meetings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id: Mapped[str] = mapped_column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    source_type: Mapped[SourceType] = mapped_column(Enum(SourceType), default=SourceType.UPLOAD, nullable=False)
    source_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    original_filename: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    recorded_at: Mapped[Optional[DateTime]] = mapped_column(DateTime(timezone=True), default=utc_now, nullable=True)

    status: Mapped[ProcessingStatus] = mapped_column(Enum(ProcessingStatus), default=ProcessingStatus.UPLOADED, nullable=False, index=True)
    error_message: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)

    # Relationships
    organization: Mapped["Organization"] = relationship("Organization", back_populates="meetings")  # noqa: F821
    workspace: Mapped["Workspace"] = relationship("Workspace", back_populates="meetings")  # noqa: F821
    project: Mapped[Optional["Project"]] = relationship("Project", back_populates="meetings")  # noqa: F821

    media_asset: Mapped[Optional["MediaAsset"]] = relationship("MediaAsset", back_populates="meeting", uselist=False, cascade="all, delete-orphan")
    processing_jobs: Mapped[List["ProcessingJob"]] = relationship("ProcessingJob", back_populates="meeting", cascade="all, delete-orphan")

    speakers: Mapped[List["Speaker"]] = relationship("Speaker", back_populates="meeting", cascade="all, delete-orphan")  # noqa: F821
    transcript_segments: Mapped[List["TranscriptSegment"]] = relationship("TranscriptSegment", back_populates="meeting", cascade="all, delete-orphan")  # noqa: F821
    summary: Mapped[Optional["MeetingSummary"]] = relationship("MeetingSummary", back_populates="meeting", uselist=False, cascade="all, delete-orphan")  # noqa: F821
    short_transcript: Mapped[Optional["ShortTranscript"]] = relationship("ShortTranscript", back_populates="meeting", uselist=False, cascade="all, delete-orphan")  # noqa: F821
    decisions: Mapped[List["Decision"]] = relationship("Decision", back_populates="meeting", cascade="all, delete-orphan")  # noqa: F821
    action_items: Mapped[List["ActionItem"]] = relationship("ActionItem", back_populates="meeting", cascade="all, delete-orphan")  # noqa: F821
    knowledge_chunks: Mapped[List["KnowledgeChunk"]] = relationship("KnowledgeChunk", back_populates="meeting", cascade="all, delete-orphan")  # noqa: F821
    voice_emotions: Mapped[List["VoiceEmotionAnnotation"]] = relationship("VoiceEmotionAnnotation", back_populates="meeting", cascade="all, delete-orphan")  # noqa: F821


class MediaAsset(Base, TimestampMixin):
    __tablename__ = "media_assets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), unique=True, nullable=False)

    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    audio_path: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    media_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Relationships
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="media_asset")


class ProcessingJob(Base, TimestampMixin):
    __tablename__ = "processing_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)

    stage: Mapped[ProcessingStatus] = mapped_column(Enum(ProcessingStatus), nullable=False)
    progress_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_details: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    retries: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="processing_jobs")

