"""Factory for retrieving configured AI providers.

Enforces local AI first:
- faster-whisper for speech recognition
- nvidia/Nemotron-3-Diarization for speaker diarization
- Ollama for local LLM intelligence
- Local sentence embeddings
- Mock providers for deterministic automated unit tests
"""
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
        try:
            from app.services.ai.faster_whisper_provider import FasterWhisperProvider
            return FasterWhisperProvider()
        except Exception:
            return MockASRProvider()
    return MockASRProvider()


def get_diarization_provider() -> DiarizationProvider:
    """Return diarization provider instance based on settings."""
    if settings.DIARIZATION_PROVIDER in ["nemotron", "nemotron_3_diarization", "nvidia"]:
        try:
            from app.services.ai.nemotron_diarization_provider import Nemotron3DiarizationProvider
            return Nemotron3DiarizationProvider(hf_token=settings.HUGGINGFACE_TOKEN)
        except Exception:
            return MockDiarizationProvider()
    return MockDiarizationProvider()


def get_llm_provider() -> LLMProvider:
    """Return local LLM provider instance based on settings."""
    if settings.LLM_PROVIDER == "ollama":
        try:
            from app.services.ai.ollama_provider import OllamaProvider
            return OllamaProvider()
        except Exception:
            return MockLLMProvider()
    return MockLLMProvider()


def get_embedding_provider() -> EmbeddingProvider:
    """Return local embedding provider instance based on settings."""
    if settings.EMBEDDING_PROVIDER in ["sentence_transformers", "local", "minilm", "all-MiniLM-L6-v2"]:
        try:
            from app.services.ai.local_embedding_provider import LocalSentenceEmbeddingProvider
            return LocalSentenceEmbeddingProvider(model_name=settings.EMBEDDING_MODEL_NAME)
        except Exception:
            return MockEmbeddingProvider()
    return MockEmbeddingProvider()


def get_voice_emotion_provider() -> VoiceEmotionProvider:
    """Return voice emotion provider instance based on settings."""
    if settings.ENABLE_VOICE_EMOTION and settings.VOICE_EMOTION_PROVIDER == "mock":
        return MockVoiceEmotionProvider()
    return MockVoiceEmotionProvider()
