"""Knowledge base, embeddings, chat conversations, and voice emotion models."""
import enum
from typing import List, Optional
from sqlalchemy import String, Float, Integer, Enum, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.models.base import TimestampMixin, generate_uuid


class ChatScope(str, enum.Enum):
    SINGLE_MEETING = "SINGLE_MEETING"
    MULTI_MEETING = "MULTI_MEETING"
    ORGANIZATION = "ORGANIZATION"


class MessageSender(str, enum.Enum):
    USER = "USER"
    ASSISTANT = "ASSISTANT"


class KnowledgeChunk(Base, TimestampMixin):
    __tablename__ = "knowledge_chunks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)

    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_type: Mapped[str] = mapped_column(String(50), nullable=False)  # transcript_block, summary, decision, action_item
    text: Mapped[str] = mapped_column(String(5000), nullable=False)
    start_time: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    end_time: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    speaker_label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="knowledge_chunks")  # noqa: F821
    embedding: Mapped[Optional["EmbeddingRecord"]] = relationship("EmbeddingRecord", back_populates="chunk", uselist=False, cascade="all, delete-orphan")


class EmbeddingRecord(Base, TimestampMixin):
    __tablename__ = "embedding_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    chunk_id: Mapped[str] = mapped_column(String(36), ForeignKey("knowledge_chunks.id", ondelete="CASCADE"), unique=True, nullable=False)

    embedding: Mapped[list] = mapped_column(JSON, nullable=False)  # Stored as JSON list of floats for SQLite/universal compatibility
    dimensions: Mapped[int] = mapped_column(Integer, nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Relationships
    chunk: Mapped["KnowledgeChunk"] = relationship("KnowledgeChunk", back_populates="embedding")


class ChatConversation(Base, TimestampMixin):
    __tablename__ = "chat_conversations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    organization_id: Mapped[str] = mapped_column(String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True, index=True)
    meeting_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    title: Mapped[str] = mapped_column(String(255), default="New Conversation", nullable=False)
    scope: Mapped[ChatScope] = mapped_column(Enum(ChatScope), default=ChatScope.SINGLE_MEETING, nullable=False)

    # Relationships
    messages: Mapped[List["ChatMessage"]] = relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan")


class ChatMessage(Base, TimestampMixin):
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    conversation_id: Mapped[str] = mapped_column(String(36), ForeignKey("chat_conversations.id", ondelete="CASCADE"), nullable=False, index=True)

    sender: Mapped[MessageSender] = mapped_column(Enum(MessageSender), nullable=False)
    content: Mapped[str] = mapped_column(String(10000), nullable=False)
    citations: Mapped[list] = mapped_column(JSON, default=list, nullable=False)  # List of citation dicts (meeting_id, timestamp, quote)

    # Relationships
    conversation: Mapped["ChatConversation"] = relationship("ChatConversation", back_populates="messages")


class VoiceEmotionAnnotation(Base, TimestampMixin):
    __tablename__ = "voice_emotion_annotations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=generate_uuid)
    meeting_id: Mapped[str] = mapped_column(String(36), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True)
    segment_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("transcript_segments.id", ondelete="SET NULL"), nullable=True)

    start_time: Mapped[float] = mapped_column(Float, nullable=False)
    end_time: Mapped[float] = mapped_column(Float, nullable=False)
    emotion_label: Mapped[str] = mapped_column(String(50), nullable=False)  # e.g., "neutral", "engaged", "tense", "calm"
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    acoustic_features: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # pitch, energy, speaking rate

    # Relationships
    meeting: Mapped["Meeting"] = relationship("Meeting", back_populates="voice_emotions")  # noqa: F821

