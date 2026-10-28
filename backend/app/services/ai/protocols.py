"""AI Provider Protocol definitions for MeetMind."""
from typing import Protocol, List, Optional, Dict, Any
from app.services.ai.dto import (
    TranscriptSegmentDTO,
    DiarizationTurnDTO,
    SummaryDTO,
    ShortTranscriptDTO,
    DecisionDTO,
    ActionItemDTO,
    GroundedAnswerDTO,
    EmotionDTO
)


class SpeechToTextProvider(Protocol):
    """Protocol for Speech-to-Text (ASR) engines."""
    async def transcribe(self, audio_path: str, language: Optional[str] = None) -> List[TranscriptSegmentDTO]:
        ...


class DiarizationProvider(Protocol):
    """Protocol for Speaker Diarization engines."""
    async def diarize(self, audio_path: str) -> List[DiarizationTurnDTO]:
        ...


class LLMProvider(Protocol):
    """Protocol for LLM-based intelligence and reasoning."""
    async def generate_summary(self, transcript_text: str) -> SummaryDTO:
        ...

    async def generate_short_transcript(self, segments: List[TranscriptSegmentDTO]) -> ShortTranscriptDTO:
        ...

    async def extract_decisions(self, transcript_text: str) -> List[DecisionDTO]:
        ...

    async def extract_action_items(self, transcript_text: str) -> List[ActionItemDTO]:
        ...

    async def answer_question(self, query: str, context: List[Dict[str, Any]]) -> GroundedAnswerDTO:
        ...


class EmbeddingProvider(Protocol):
    """Protocol for text embedding models."""
    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        ...


class VoiceEmotionProvider(Protocol):
    """Protocol for optional vocal emotion inference."""
    async def analyze(self, audio_path: str, segments: List[TranscriptSegmentDTO]) -> List[EmotionDTO]:
        ...

