# MeetMind — Changelog

All notable changes to the MeetMind project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - Full Platform Implementation Completed

### Added
- **Core Media Ingestion (`backend/app/services/media_service.py`)**:
  - Implemented streaming multipart file upload with chunking to protect memory.
  - Implemented audio extraction with FFmpeg and format fallback.
  - Implemented media endpoints `/api/meetings/upload` and `/api/meetings/import-url`.
- **Background Pipeline Orchestrator (`backend/app/services/pipeline_service.py`)**:
  - 9-stage idempotent state machine (`UPLOADED` ➔ `VALIDATING` ➔ `EXTRACTING_MEDIA` ➔ `TRANSCRIBING` ➔ `DIARIZING` ➔ `ALIGNING_SPEAKERS` ➔ `GENERATING_SUMMARY` ➔ `INDEXING_KNOWLEDGE` ➔ `COMPLETED`).
  - Automatic alignment of diarization turns with speech segments.
- **Three Core Deliverables**:
  1. *Full Transcript*: Complete timestamped dialogue with speaker badges.
  2. *Short Transcript / Chronological Explanation*: Narrative sequence of who proposed what, disagreements, and conclusions.
  3. *Structured Summary*: Executive summary, key points, risks, open questions, confirmed decisions, and action items.
- **RAG & Hybrid Search Engine (`backend/app/services/rag_service.py`)**:
  - Semantic vector indexing and cosine similarity calculation.
  - Keyword overlap bonus (BM25 style).
  - Grounded single-meeting QA with clickable timestamp citations (`[mm:ss]`).
  - Strict anti-hallucination guard returning `found_evidence=False` when evidence is absent.
- **Organizational Memory & Cross-Meeting Intelligence (`backend/app/services/cross_meeting_service.py`)**:
  - Cross-meeting Q&A synthesizing evidence across all authorized meetings (`/api/organizations/{id}/chat`).
  - Organization-wide Decisions register (`/api/organizations/{id}/decisions`).
  - Organization-wide Action Items board (`/api/organizations/{id}/action-items`).
  - Verified multi-tenant boundary isolation with zero data leakage.
- **Interactive Next.js 14 Frontend Application (`frontend/`)**:
  - Dashboard with system health indicator and workspace switcher (`/`).
  - Meeting detail page (`/meetings/[id]`) with synchronized media player seeking and 9 tabs:
    1. Overview
    2. Full Transcript (with search & speaker filtering)
    3. Chronological Explanation (narrative & event sequence)
    4. Structured Summary (executive summary, key topics, risks)
    5. Decisions (register with evidence quotes)
    6. Action Items (interactive status toggles)
    7. Speakers (interactive rename tool)
    8. Meeting Chat (grounded conversational QA with clickable timestamps)
    9. Voice Emotion Analysis (acoustic charts)
  - Organization Workspace (`/workspace`): Library, cross-meeting chat, decisions timeline, and action items.
  - Ingestion modal with drag-and-drop file upload and URL import.
- **Automated Test Suite (`backend/tests/`)**:
  - 13 comprehensive unit and integration tests covering all services, APIs, and multi-tenant isolation (100% passing).
  - Verified Next.js production build (`npm run build` passed with zero errors).

## [0.1.0] - Phase 1 Foundation Completed
- Established project governance rulebook (`PROJECT_RULES.md`).
- Multi-tenant database models, schemas, and AI interfaces.
