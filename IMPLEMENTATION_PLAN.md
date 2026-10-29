# MeetMind — Phased Implementation Plan

This roadmap outlines the systematic execution sequence for building MeetMind according to `PROJECT_RULES.md` and the master architecture specification.

---

## Phase 1: Foundation & Baseline Architecture (Current Phase)
- **Goal**: Establish the repository structure, database layer, configuration, security models, test fixtures, and runnable foundation.
- **Deliverables**:
  - `backend/`: FastAPI application structure with configuration management via Pydantic Settings.
  - `backend/app/models/`: Complete SQLAlchemy ORM models covering Organizations, Workspaces, Projects, Meetings, Media, Transcripts, Speakers, Summaries, Decisions, Action Items, Knowledge Chunks, and Chat.
  - `backend/app/schemas/`: Pydantic request/response schemas.
  - `backend/app/core/`: Database engine, session lifecycle, security, and logging.
  - `backend/app/services/`: Abstract interfaces for AI components (ASR, Diarization, LLM, Embedding, Emotion).
  - Automated unit test suite verifying database creation, models, and API health.
  - Configuration files: `.env.example`, `requirements.txt`, `pytest.ini`.

---

## Phase 2: Core Media Ingestion & Speech Transcription Pipeline
- **Goal**: Ingest audio/video files and URLs, extract audio, run transcription, and persist timestamped segments.
- **Deliverables**:
  - Media upload and URL import endpoints with validation.
  - FFmpeg audio extraction utility with fallback handling.
  - Modular ASR provider with `FasterWhisperProvider` and mock/fallback for test environments.
  - Background task runner executing pipeline stages: `UPLOADED` ➔ `VALIDATING` ➔ `EXTRACTING_MEDIA` ➔ `TRANSCRIBING`.
  - Transcript persistence and segment retrieval APIs.
  - Tests covering upload validation, audio extraction, transcript generation, and idempotency.

---

## Phase 3: Speaker Directory, Participant Management, and Attribution (Completed)
- **Goal**: Build organization-level speaker directory, connect anonymous diarized labels to known participants, maintain an immutable attribution audit trail, preserve diarizer output, enforce the strict no-voice-biometrics identity rule, and provide rich speaker analytics.
- **Completed Deliverables**:
  - Organization-level Speaker Directory endpoints (`/api/organizations/{org_id}/speakers`): CRUD, search, participation stats, meeting appearances, and segment history.
  - Meeting-level speaker assignment and correction endpoints (`PATCH /api/meetings/{id}/speakers/{speaker_id}` & `POST .../unassign`): Link anonymous diarizer labels (`SPEAKER_00`) to organization participant profiles or confirmed display names.
  - Attribution Audit Logging (`AuditLog` and `SpeakerAssignment`): Full audit trail recording actor, timestamp, previous vs new name/participant ID, and notes.
  - Immutability of Diarizer Output: `Speaker.speaker_label` preserved unmodified across all assignments and renames.
  - Cross-Meeting Isolation: Identical anonymous labels across meetings remain completely independent.
  - No Voice Biometrics Rule: Absolute prohibition of automatic speaker identification from acoustic features alone.
  - Frontend UI:
    - Organization Speaker Directory (`frontend/app/speakers/page.tsx`): Directory table, search, profile creation, and participation history drawer.
    - Enhanced Meeting Detail (`frontend/app/meetings/[id]/page.tsx`): Confirmed display names with diarizer label fallback, Confirmed/Unassigned badges, speaker filter dropdown, assignment modal, audit history modal, and talk-time distribution bar.
    - Workspace navigation link (`frontend/app/workspace/page.tsx`).
  - Automated Testing: Comprehensive test suite in `tests/test_phase3_speakers_and_attribution.py` (30/30 total tests passing).

---

## Phase 4: Meeting Intelligence Engine (Three Distinct Deliverables) (Current Phase)
- **Goal**: Generate Full Transcript, Short Transcript (chronological narrative), and Structured Summary with Decisions and Action Items using local LLM inference with transparent offline fallback.
- **Deliverables**:
  - Deliverable 1: Full Transcript with confirmed speaker attribution, timestamp alignment, and search/filter.
  - Deliverable 2: Short Transcript / Chronological Narrative capturing speaker-by-speaker flow, proposals, disagreements, alternatives discussed, and conclusions.
  - Deliverable 3: Structured Meeting Intelligence:
    - Executive summary, key discussion points, and next steps.
    - Formal Decision Register with rationale, alternatives rejected, consensus status, and segment evidence links.
    - Action Item Tracker with explicit assignees, due dates, priority levels, and completion status.
  - Segment Provenance: Direct quotation and timestamp linkage connecting every decision and action item to source transcript segments.
  - Deterministic Parsing & Regeneration Safety: Schema validation ensuring LLM outputs conform to typed contracts without duplicating existing database records on re-run.
  - Verification & Regression Tests for structured intelligence generation.

---

## Phase 5: Single-Meeting Grounded RAG Chat
- **Goal**: Enable conversational Q&A grounded strictly in the meeting transcript with clickable timestamp citations.
- **Deliverables**:
  - Chunking and embedding service for transcript segments and summaries.
  - Vector similarity retriever filtered by meeting ID.
  - Grounded answer generation enforcing citation references (`[mm:ss]`).
  - Uncertainty enforcement (saying "Information not found" when evidence is missing).
  - Interactive chat endpoints and WebSocket streaming.
  - Tests for citation accuracy and hallucination defense.

---

## Phase 6: Organization-Wide Memory & Cross-Meeting Chat
- **Goal**: Build company-wide meeting search, cross-meeting Q&A, and decision timeline comparisons across authorized workspaces.
- **Deliverables**:
  - Multi-tenant hybrid search engine (BM25 keyword search + vector embeddings).
  - Organization-level RAG chat synthesizing insights across multiple meetings.
  - Decision tracking over time (detecting revisions, updates, or reversals).
  - Strict tenant and workspace isolation verification.
  - Tests for cross-meeting retrieval, permission barriers, and prompt injection defense.

---

## Phase 7: Live Integrations & Video URL Importers
- **Goal**: Add robust external video ingestion (YouTube, meeting cloud recordings) and live capture endpoints.
- **Deliverables**:
  - YouTube / online video caption importer with audio fallback.
  - Cloud recording ingestion adapters (Google Meet, Zoom, Teams file formats).
  - Live capture streaming endpoint with participant consent controls.

---

## Phase 8: Optional Voice Emotion Analysis
- **Goal**: Implement non-blocking acoustic emotion inference from vocal audio.
- **Deliverables**:
  - Acoustic emotion provider analyzing raw audio segments.
  - Confidence scoring and tentative prediction tags.
  - Configuration toggle allowing the feature to be disabled.
  - Fault tolerance ensuring emotion failures do not abort the core meeting deliverables.

---

## Phase 9: Frontend Application & Production Hardening
- **Goal**: Deliver a polished Next.js responsive web application and complete containerized deployment.
- **Deliverables**:
  - Next.js dashboard, meeting detail page with 9 tabs, synchronized media player, and organization chat.
  - Docker Compose setup (FastAPI, Next.js, PostgreSQL/pgvector, Redis, MinIO).
  - End-to-end integration tests and operational runbooks.

