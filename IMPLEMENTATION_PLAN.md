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

## Phase 4: Meeting Intelligence Engine (Three Distinct Deliverables) (Completed)
- **Goal**: Generate Full Transcript, Short Transcript (chronological narrative), and Structured Meeting Intelligence (Executive Summary, Decision Register, Action Item Tracker) with verified transcript evidence provenance and anti-hallucination controls.
- **Completed Deliverables**:
  - Deliverable A — Full Transcript: Timestamped segments, confirmed participant attribution with original diarizer fallback (`Confirmed` vs `Unassigned` badges), verbatim ASR preservation, search, speaker filter, and synchronized playback seeking.
  - Deliverable B — Chronological Meeting Explanation: Structured narrative capturing speaker contributions, proposals, alternatives, disagreements, agreements, questions, and conclusions. Events typed with pills and linked to `source_segment_id`.
  - Deliverable C — Structured Meeting Intelligence:
    - Executive summary with key points, risks, open questions, and next steps.
    - Decision Register with strict status classification (`CONFIRMED`, `PROPOSED`, `REJECTED`, `SUPERSEDED`), responsible person, quote, and timestamp link to seek player.
    - Action Item Tracker with priority, status (`OPEN`, `PROPOSED`, `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`), ungrounded owner/deadline prevention (`None`), and quote seeking.
  - EvidenceValidator Service: Segment existence validation, timestamp clamping, suggestion status downgrade, and ungrounded claim defense.
  - Idempotent Regeneration: `POST /api/meetings/{id}/regenerate-intelligence` re-generates intelligence idempotently with zero duplicate records.
  - Enhanced Meeting Detail UI: Model attribution badges, typed event timeline cards, executive summary layout, decision cards, action item tracker, and clickable citation buttons that seek the media player.
  - Automated Regression Suite: 34 tests passing across 12 test modules (100% passing in 85s); clean TypeScript compilation.

---

## Phase 5: Single-Meeting Grounded RAG Chat (Current Phase)
- **Goal**: Enable rich conversational Q&A grounded strictly in the meeting transcript and intelligence deliverables with clickable timestamp citations and streaming support.
- **Deliverables**:
  - Hybrid retrieval service indexing transcript segments, executive summaries, decisions, action items, and chronological timeline events.
  - Exact citation formatting with clickable `[mm:ss]` buttons synchronized with the media player.
  - Explicit insufficient-evidence response when user queries ask for unsupported facts.
  - Organization and workspace isolation enforcement on all chat queries.
  - WebSocket or SSE streaming support for responsive chat responses.
  - Comprehensive automated tests covering single-meeting grounding, citation accuracy, and hallucination prevention.

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

