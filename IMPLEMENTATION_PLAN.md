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

## Phase 3: Speaker Diarization & Participant Mapping
- **Goal**: Detect speaker turns, assign anonymous speaker IDs, align with ASR timestamps, and provide speaker renaming tools.
- **Deliverables**:
  - Diarization interface with `PyannoteProvider` and acoustic energy/heuristic fallback.
  - Timestamp alignment algorithm matching diarization turns with Whisper segments.
  - Speaker directory and participant assignment endpoints with audit trails.
  - Tests for speaker boundary detection, alignment accuracy, and manual label renaming.

---

## Phase 4: Meeting Intelligence Engine (Three Distinct Deliverables)
- **Goal**: Generate Full Transcript, Short Transcript (chronological explanation), and Structured Summary with Decisions and Action Items.
- **Deliverables**:
  - Chronological explanation generator capturing speaker arguments, disagreements, and conclusions.
  - Structured summary generator (executive summary, main topics, risks, open questions).
  - Decision extraction engine with revision tracking.
  - Action item extraction engine with owner, deadline, priority, and status.
  - Evidence linkers associating every extracted claim to its exact transcript segment.
  - Tests for structured output parsing, evidence validation, and regeneration safety.

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

