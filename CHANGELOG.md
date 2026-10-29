# MeetMind — Changelog

All notable changes to the MeetMind project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-10-29: Phase 2 End-to-End Validation & Audit Milestone

### Added
- **Real Local Model Verification Suite (`tests/test_real_models_and_audit.py`)**: End-to-end audit tests executing genuine local inference on host hardware for both `faster-whisper` and `nvidia/Nemotron-3-Diarization` (99,226,504 parameters).
- **Retry Idempotency Verification**: Automated test proving zero duplicated records (`TranscriptSegment`, `MeetingSummary`, `Decision`, `ActionItem`, `KnowledgeChunk`) across repeated pipeline execution runs.
- **Hardware Profile RAM Telemetry**: Integrated `psutil` virtual memory reporting (`ram_total_gb`, `ram_available_gb`) into `LocalModelManager.get_hardware_profile()`.
- **Pre-Ingestion Security & Format Validation**: Immediate file extension checks rejecting unauthorized formats (`.exe`) prior to DB creation and URL scheme enforcement (`http`/`https` only).
- **Audio Extraction Self-Copy Guard**: Resolved `shutil.SameFileError` when input media is already named `extracted_audio.wav`.
- **Knowledge Base Cascade Cleanup**: Enhanced `RAGService.index_meeting` to cleanly delete child `EmbeddingRecord`s before parent `KnowledgeChunk`s to guarantee complete SQLite idempotency.

### Changed
- Expanded automated regression suite from 19 to 24 tests; 24/24 passing in 24.83 seconds.
- Added `librosa>=0.10.0` and `accelerate>=0.28.0` to `backend/requirements.txt` to support full native `transformers` frame classification for `Nemotron-3-Diarization`.
- Verified Next.js 14 frontend TypeScript compilation via `npx tsc --noEmit` (0 errors).

## [0.2.0] - Phase 2: Core Media Ingestion, Real ASR, and Nemotron Diarization

### Added
- **Central Local Model Manager (`LocalModelManager`)**: Hardware profiling (CPU, RAM, NVIDIA GPU, VRAM, CUDA, FFmpeg), model readiness states (`READY`, `MISSING_WEIGHTS`, `MISSING_DEPENDENCY`, `SERVICE_OFFLINE`), and strict local inference enforcement (`cloud_fallback_enabled = False`).
- **Real Local ASR (`FasterWhisperProvider`)**: CTranslate2-powered faster-whisper local transcription with sentence and word-level timestamps (`WordTimingDTO`), VAD filtering, and CPU/CUDA device support. Verified real local inference on host hardware.
- **Mandatory NVIDIA Nemotron-3-Diarization (`Nemotron3DiarizationProvider`)**: Sortformer architecture (~100M parameters, OpenMDW 1.1 license) supporting up to 8 concurrent speakers and overlapping speech with 10ms frame resolution.
- **Media Ingestion & URL Importer**: Enhanced `MediaService` with multi-path FFmpeg detection, pure-Python `wave` duration probing, and YouTube / media URL metadata extraction.
- **Local LLM Intelligence (`OllamaProvider`)**: Local Q&A, structured summaries, chronological narrative, decisions, and action items using local Ollama instances (`llama3.2`).
- **Model Diagnostic Endpoints**: Added `/api/models/status`, `/api/models/test-asr`, and `/api/models/nemotron/spec`.
- **Architectural Decision Records**: Added `ADR-006` (Strict Local-First AI Inference Policy) and `ADR-007` (NVIDIA Nemotron-3-Diarization as Primary Diarization Engine).
- **Test Suite**: Expanded automated test suite from 11 to 19 tests, including model readiness, media validation, duration probing, URL import, and Nemotron turn sorting (19/19 passing).

## [0.1.0] - Phase 1 Foundation Completed

### Added
- Created `PROJECT_RULES.md` as the permanent operating governance rulebook for AI agents.
- Authored core architectural documentation: `PROJECT_OVERVIEW.md`, `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md`, `TASK_TRACKER.md`, `DECISIONS.md`, and `CHANGELOG.md`.
- Implemented full multi-tenant SQLAlchemy 2.0 ORM models in `backend/app/models/`.
- Implemented typed Pydantic v2 schemas in `backend/app/schemas/`.
- Implemented database session management and automatic table initialization.
- Built FastAPI endpoints for Health, Organizations, Meetings, and Grounded Chat.
- Initialized Next.js 14 frontend structure with TypeScript and Tailwind CSS.
