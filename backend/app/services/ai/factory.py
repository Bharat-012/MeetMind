"""Factory for retrieving configured AI providers."""
from app.core.config import settings
from app.services.ai.protocols import (
    SpeechToTextProvider,
    DiarizationProvider,
    LLMProvider,
    EmbeddingProvider,
    VoiceEmotionProvider
)
from app.services.ai.mock_providers import (
    MockASRProvider,
    MockDiarizationProvider,
    MockLLMProvider,
    MockEmbeddingProvider,
    MockVoiceEmotionProvider
)


def get_asr_provider() -> SpeechToTextProvider:
    """Return speech-to-text provider instance based on settings."""
    if settings.ASR_PROVIDER == "faster_whisper":
        # Dynamic import to avoid strict dependency on faster-whisper when running in test mode
        try:
            from app.services.ai.faster_whisper_provider import FasterWhisperProvider
            return FasterWhisperProvider()
        except ImportError:
            return MockASRProvider()
    return MockASRProvider()


def get_diarization_provider() -> DiarizationProvider:
    """Return diarization provider instance based on settings."""
    if settings.DIARIZATION_PROVIDER == "pyannote":
        try:
            from app.services.ai.pyannote_provider import PyannoteDiarizationProvider
            return PyannoteDiarizationProvider()
        except ImportError:
            return MockDiarizationProvider()
    return MockDiarizationProvider()


def get_llm_provider() -> LLMProvider:
    """Return LLM provider instance based on settings."""
    if settings.LLM_PROVIDER == "openai":
        try:
            from app.services.ai.openai_provider import OpenAIProvider
            return OpenAIProvider()
        except ImportError:
            return MockLLMProvider()
    return MockLLMProvider()


def get_embedding_provider() -> EmbeddingProvider:
    """Return embedding provider instance based on settings."""
    return MockEmbeddingProvider()


def get_voice_emotion_provider() -> VoiceEmotionProvider:
    """Return voice emotion provider instance based on settings."""
    if settings.ENABLE_VOICE_EMOTION and settings.VOICE_EMOTION_PROVIDER == "mock":
        return MockVoiceEmotionProvider()
    return MockVoiceEmotionProvider()

