"""MeetMind Configuration Settings."""
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # Application Settings
    APP_NAME: str = "MeetMind"
    APP_ENV: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000", "*"]

    # Security & Auth
    SECRET_KEY: str = "meetmind-secret-key-change-me-in-production-random-hex"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    ALGORITHM: str = "HS256"

    # Database Persistence
    DATABASE_URL: str = "sqlite+aiosqlite:///./meetmind.db"

    # Storage Settings
    MEDIA_STORAGE_DIR: str = "./storage/media"
    MAX_UPLOAD_SIZE_BYTES: int = 524288000  # 500 MB
    ALLOWED_MEDIA_EXTENSIONS: List[str] = ["mp4", "webm", "mov", "mkv", "mp3", "wav", "m4a", "aac"]

    # AI Model Providers
    ASR_PROVIDER: str = "mock"  # mock | faster_whisper | whisper
    FASTER_WHISPER_MODEL_SIZE: str = "base"
    WHISPER_DEVICE: str = "cpu"
    WHISPER_COMPUTE_TYPE: str = "int8"

    DIARIZATION_PROVIDER: str = "mock"  # mock | pyannote
    HUGGINGFACE_TOKEN: Optional[str] = None

    LLM_PROVIDER: str = "mock"  # mock | openai | ollama
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"

    EMBEDDING_PROVIDER: str = "sentence_transformers"  # sentence_transformers | mock
    EMBEDDING_MODEL_NAME: str = "sentence-transformers/all-MiniLM-L6-v2"

    ENABLE_VOICE_EMOTION: bool = False
    VOICE_EMOTION_PROVIDER: str = "disabled"  # disabled | mock | speechbrain


settings = Settings()

