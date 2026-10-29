# MeetMind — Changelog

All notable changes to the MeetMind project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-10-29: Phase 4 Meeting Intelligence Engine

### Added
- **Three Core Meeting Deliverables**:
  - **Deliverable A — Full Transcript**: Verbatim ASR preservation, confirmed participant names with diarizer fallback, `Confirmed` vs `Unassigned` visual badges, search, speaker filter, and synchronized seeking.
  - **Deliverable B — Chronological Meeting Explanation**: Sequential narrative flow persisted in `ShortTranscript` capturing proposals, agreements, disagreements, questions, clarifications, and conclusions with typed badges, timestamps, and `source_segment_id`.
  - **Deliverable C — Structured Meeting Intelligence**:
    - **Executive Summary (`MeetingSummary`)**: Meeting purpose, executive narrative, key discussion points, risks/blockers, unresolved questions, and next steps.
    - **Decision Register (`Decision`)**: Strict status classification (`CONFIRMED`, `PROPOSED`, `REJECTED`, `SUPERSEDED`), responsible participant, quotes, and timestamp link to seek player.
    - **Action Item Tracker (`ActionItem`)**: Explicit owner and due date validation (unsupported values stored as `None`), priority, status, and quote seeking.
- **EvidenceValidator & Hallucination Prevention (`EvidenceValidator`)**:
  - Segment existence validation: every Decision, Action Item, and Event is strictly linked to an authentic database `TranscriptSegment`.
  - Timestamp verification and bounding within meeting duration.
  - Status safety: tentative suggestions and proposals are automatically downgraded from `CONFIRMED` to `PROPOSED`.
  - Non-hallucination guarantee: ungrounded owners and deadlines are stripped to `None` rather than invented.
  - Meeting segment ownership verification (`verify_segment_ownership`).
- **Meeting Intelligence Regeneration API (`POST /api/meetings/{id}/regenerate-intelligence`)**:
  - Re-runs Stage 6 using existing transcript segments without requiring re-ingestion or re-ASR.
  - Guarantees complete database idempotency with zero duplicate records.
- **Enhanced Meeting Chat**:
  - Verifiable timestamp citations (`[mm:ss]`) that seek the media player to the exact audio turn.
  - Truthful fallback handling: queries about unsupported facts return `found_evidence = False` and `"The meeting records do not contain sufficient evidence to answer this question."`.
  - Multi-tenant organization isolation: cross-tenant meeting queries are blocked with HTTP 403 Forbidden.
- **Meeting Detail Interface Upgrades**:
  - Added "Regenerate Intelligence" action button with live progress indicator.
  - Chronological explanation tab with model attribution pill, typed event sequence badges, and seeking.
  - Executive summary tab with 4-quadrant layout (Takeaways, Risks, Questions, Next Steps).
  - Decision register cards with color-coded status badges and quote playback seeking.
  - Action item tracker with priority pills, unassigned fallback badges, and completion toggles.
  - Chat citations with clickable `[mm:ss]` buttons that seek the synchronized media player.
- **Automated Regression Suite**:
  - Authored `backend/tests/test_phase4_meeting_intelligence.py` covering provenance validation, hallucination defense, Ollama offline fallback, idempotent regeneration, and tenant security.
  - Expanded test suite from 30 to 34 tests (34/34 passing in 85.2s).
  - Verified clean Next.js TypeScript compilation (0 errors).

## [0.3.0] - 2026-10-29: Phase 3 Speaker Directory, Participant Management, and Attribution

### Added
- **Organization Speaker Directory (`MeetingParticipant`)**:
  - Full CRUD and search API (`/api/organizations/{org_id}/speakers`) supporting display name, email, role, and description.
  - Participation history endpoint (`/api/organizations/{org_id}/speakers/{participant_id}/history`) returning meeting count, total talk time, attended meetings, and spoken transcript segments.
  - Dedicated Next.js frontend page (`frontend/app/speakers/page.tsx`) with search, metrics cards, creation/editing modals, and a slide-over participation history drawer.
- **Meeting-Level Speaker Attribution Workflow**:
  - Assignment endpoint (`PATCH /api/meetings/{id}/speakers/{speaker_id}`) linking anonymous diarized labels (`SPEAKER_00`) to organization participant profiles or setting confirmed display names.
  - Unassign endpoint (`POST /api/meetings/{id}/speakers/{speaker_id}/unassign`) resetting attribution status.
  - Audit trail endpoint (`GET /api/meetings/{id}/speakers/{speaker_id}/audit-history`) returning chronological attribution changes.
  - Speaker contribution stats endpoint (`GET /api/meetings/{id}/speakers/stats`) returning per-speaker duration, segment count, and talk-time percentage.
- **Strict Identity Governance & Biometric Prohibition**:
  - Enforced ADR-008: absolute prohibition on automatic speaker identification using voice similarity or acoustic biometrics alone.
  - Diarizer outputs remain immutable: `Speaker.speaker_label` is preserved across all assignments and renames.
  - Cross-meeting isolation: identical anonymous labels (`SPEAKER_00`) across meetings remain strictly independent database entities.
- **Attribution Audit Logging**:
  - Integrated `AuditLog` events (`ASSIGN_SPEAKER`, `UNASSIGN_SPEAKER`, `UPDATE_SPEAKER_PROFILE`, `DELETE_SPEAKER_PROFILE`) recording actor, timestamp, previous vs new name/participant ID, and notes.
- **Enhanced Meeting Detail Frontend**:
  - Transcript lines display confirmed display name prominently with original label fallback and `Confirmed` vs `Unassigned` visual badges.
  - Speaker filter dropdown allowing instant filtering of transcript by speaker.
  - Speaker assignment modal supporting profile selection or custom name entry.
  - Attribution audit history modal displaying full provenance of identity changes.
  - Speaker contribution distribution bar showing talk-time percentages across participants.
- **Transparent Local AI Fallback**:
  - Enhanced `OllamaProvider` with deterministic local rule-based fallback when the local Ollama daemon is offline, explicitly labeled `[RULE-BASED FALLBACK · Ollama offline]` with `model_name = "local-rule-based-fallback (ollama offline)"`.
- **Automated Test Suite Expansion**:
  - Created `tests/test_phase3_speakers_and_attribution.py` covering directory CRUD, participant assignment, unassignment, audit logging, cross-meeting independence, speaker stats, and Ollama offline fallback.
  - Expanded test suite from 24 to 30 tests (30/30 passing in 37.4s).

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
