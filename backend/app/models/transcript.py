"""Transcript segment, speaker, and participant attribution models."""
from typing import List, Optional
from sqlalchemy import String, Float, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid


class MeetingParticipant(Base, TimestampMixin):
    __tablename__ = "meeting_participants"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # Relationships
    speaker_assignments: Mapped[List["SpeakerAssignment"]] = relationship("SpeakerAssignment", back_populates="participant")


class Speaker(Base, TimestampMixin):
    __tablename__ = "speakers"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)

    speaker_label: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "SPEAKER_00", "Speaker 1"
    confirmed_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # User overridden name
    participant_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("meeting_participants.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="speakers")  # noqa: F821
    segments: Mapped[List["TranscriptSegment"]] = relationship("TranscriptSegment", back_populates="speaker")
    assignment: Mapped[Optional["SpeakerAssignment"]] = relationship("SpeakerAssignment", back_populates="speaker", uselist=False)


class SpeakerAssignment(Base, TimestampMixin):
    __tablename__ = "speaker_assignments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    speaker_id: Mapped[str] = mapped_column(String(36), ForeignKey("speakers.id", ondelete="CASCADE"), unique=True, nullable=False)
    participant_id: Mapped[str] = mapped_column(String(36), ForeignKey("meeting_participants.id", ondelete="CASCADE"), nullable=False)
    assigned_by_user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    speaker: Mapped["Speaker"] = relationship("Speaker", back_populates="assignment")
    participant: Mapped["MeetingParticipant"] = relationship("MeetingParticipant", back_populates="speaker_assignments")


class TranscriptSegment(Base, TimestampMixin):
    __tablename__ = "transcript_segments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    speaker_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("speakers.id", ondelete="SET NULL"), nullable=True, index=True)

    start_time: Mapped[float] = mapped_column(Float, nullable=False, index=True)  # In seconds
    end_time: Mapped[float] = mapped_column(Float, nullable=False, index=True)    # In seconds
    text: Mapped[str] = mapped_column(String(5000), nullable=False)
    confidence: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    words: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # Detailed word-level timestamps

    # Relationships
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="transcript_segments")  # noqa: F821
    speaker: Mapped[Optional["Speaker"]] = relationship("Speaker", back_populates="segments")

