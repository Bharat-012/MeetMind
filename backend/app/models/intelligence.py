"""Meeting intelligence, summaries, chronological narrative, decisions, and action items."""
import enum
from typing import List, Optional
from sqlalchemy import String, Float, Enum, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid


class DecisionStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    REVISED = "REVISED"
    SUPERSEDED = "SUPERSEDED"
    CANCELLED = "CANCELLED"


class ActionItemStatus(str, enum.Enum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    BLOCKED = "BLOCKED"
    CANCELLED = "CANCELLED"


class Priority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class MeetingSummary(Base, TimestampMixin):
    __tablename__ = "meeting_summaries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), unique=True, nullable=False)

    executive_summary: Mapped[str] = mapped_column(String(5000), nullable=False)
    key_points: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    risks: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    open_questions: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    next_steps: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    model_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="summary")  # noqa: F821


class ShortTranscript(Base, TimestampMixin):
    __tablename__ = "short_transcripts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), unique=True, nullable=False)

    narrative_text: Mapped[str] = mapped_column(String(10000), nullable=False)
    chronological_events: Mapped[list] = mapped_column(JSON, default=list, nullable=False)  # List of event dicts with timestamp, speaker, description

    # Relationships
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="short_transcript")  # noqa: F821


class Topic(Base, TimestampMixin):
    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)
    summary: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)


class Decision(Base, TimestampMixin):
    __tablename__ = "decisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    decision_text: Mapped[str] = mapped_column(String(3000), nullable=False)
    responsible_person: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[DecisionStatus] = mapped_column(Enum(DecisionStatus), default=DecisionStatus.ACTIVE, nullable=False)

    evidence_timestamp: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    evidence_quote: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)

    # Relationships
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="decisions")  # noqa: F821
    revisions: Mapped[List["DecisionRevision"]] = relationship("DecisionRevision", back_populates="decision", cascade="all, delete-orphan")


class DecisionRevision(Base, TimestampMixin):
    __tablename__ = "decision_revisions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    decision_id: Mapped[str] = mapped_column(String(36), ForeignKey("decisions.id", ondelete="CASCADE"), nullable=False, index=True)
    revised_in_meeting_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="SET NULL"), nullable=True)

    reason: Mapped[str] = mapped_column(String(2000), nullable=False)
    previous_state: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)
    new_state: Mapped[str] = mapped_column(String(2000), nullable=False)

    # Relationships
    decision: Mapped["Decision"] = relationship("Decision", back_populates="revisions")


class ActionItem(Base, TimestampMixin):
    __tablename__ = "action_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)

    task_description: Mapped[str] = mapped_column(String(2000), nullable=False)
    owner_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    due_date: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    priority: Mapped[Priority] = mapped_column(Enum(Priority), default=Priority.MEDIUM, nullable=False)
    status: Mapped[ActionItemStatus] = mapped_column(Enum(ActionItemStatus), default=ActionItemStatus.OPEN, nullable=False, index=True)

    evidence_timestamp: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    evidence_quote: Mapped[Optional[str]] = mapped_column(String(2000), nullable=True)

    # Relationships
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="action_items")  # noqa: F821
    updates: Mapped[List["ActionItemUpdate"]] = relationship("ActionItemUpdate", back_populates="action_item", cascade="all, delete-orphan")


class ActionItemUpdate(Base, TimestampMixin):
    __tablename__ = "action_item_updates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    action_item_id: Mapped[str] = mapped_column(String(36), ForeignKey("action_items.id", ondelete="CASCADE"), nullable=False, index=True)
    updated_by_user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    status_from: Mapped[str] = mapped_column(String(50), nullable=False)
    status_to: Mapped[str] = mapped_column(String(50), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(1000), nullable=True)

    # Relationships
    action_item: Mapped["ActionItem"] = relationship("ActionItem", back_populates="updates")

