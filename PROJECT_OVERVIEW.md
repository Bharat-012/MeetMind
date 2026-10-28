# MeetMind — Project Overview

## Vision & Purpose
**MeetMind** is an enterprise-grade AI meeting intelligence and organizational memory platform. It transforms recorded meetings, uploaded audio/video files, online video URLs, and authorized live meeting streams into searchable, verifiable, speaker-attributed organizational knowledge.

Unlike conventional transcription tools that merely generate text dumps, MeetMind functions as a persistent institutional brain. It connects discussions across days, months, and projects, enabling teams to ask questions across their entire meeting archive while preserving source timestamps, speaker identities, citations, and organizational access boundaries.

---

## Target Audience & Personas
- **Leadership & Executives**: Review high-level summaries, track critical decisions, assess project velocity, and observe strategic pivots over time.
- **Product & Project Managers**: Automatically capture action items, owners, deadlines, blockers, and track changes to requirements across sprints.
- **Engineering & Design Teams**: Search technical rationale, architectural decisions, and verify who proposed or agreed to specific technical approaches.
- **Cross-Functional Teams**: Onboard quickly by querying the historical record of projects ("Why did we choose Postgres over Mongo for Project X?").

---

## Core Product Capabilities

### 1. Multi-Source Ingestion
- Uploaded media: MP4, WebM, MOV, MKV, MP3, WAV, M4A with background validation and audio extraction.
- Online videos: YouTube and supported video URLs with caption extraction and audio fallback.
- Meeting platforms: Google Meet, Zoom, Microsoft Teams recording ingestion via standard formats and future API adapters.
- Authorized live capture architecture with participant consent tracking and recording controls.

### 2. High-Accuracy Speech & Speaker Attribution
- Local/self-hosted ASR with timestamped sentence-level segments.
- Modular Speaker Diarization identifying turn boundaries and unique speaker IDs within each meeting.
- Participant identification mapping: map anonymous speaker labels (e.g., "Speaker 1") to known organizational members with audit history.

### 3. Three Distinct Meeting Intelligence Deliverables
For every processed meeting, MeetMind generates and persists:
1. **Full Transcript**: Complete, searchable, timestamped dialogue with speaker attribution.
2. **Short Transcript / Chronological Explanation**: A concise chronological explanation of how the discussion unfolded, who said what, disagreements, and conclusions reached.
3. **Structured Summary & Action Engine**: Executive summary, key points, explicitly confirmed decisions, action items (with owner, deadline, priority, status), risks, and open questions.

### 4. Interactive Meeting Playback & Grounded Chat
- Media player synchronized with transcript: clicking any segment or citation seeks the player to that exact millisecond.
- Retrieval-Augmented Generation (RAG) meeting chat: answers are strictly grounded in the meeting evidence and include clickable citations with timestamps.
- Explicit uncertainty handling: if the meeting does not contain an answer, the system truthfully states that evidence is absent.

### 5. Multi-Tenant Organizational Memory & Cross-Meeting Chat
- Multi-tenant architecture with strict organization, workspace, and project boundaries.
- Hybrid search (BM25 full-text search + semantic vector embeddings).
- Organization-wide chat: ask questions across hundreds of authorized meetings (e.g., "What commitments were made to Client A across all Q3 meetings?").
- Decision history & revision tracking: monitor how decisions evolve or get superseded over time with full provenance.

### 6. Optional Voice Emotion Analysis
- Separate, optional audio emotion inference module analyzing vocal acoustics (pitch, acoustic energy, vocal tone) rather than text sentiment.
- Never conflated with internal psychological truth; displayed as tentative acoustic predictions with confidence scores.

---

## Architectural Principles
- **Privacy & Security First**: Organization data isolation enforced at the database and query layer. Transcripts and meeting media are untrusted data.
- **Modular AI Runtimes**: Pluggable interfaces for ASR, Diarization, LLM generation, and Embeddings.
- **Local-First & Scalable**: Runs out-of-the-box in local environments (SQLite/FastAPI/Next.js) with a seamless migration path to PostgreSQL + pgvector + Redis + MinIO/S3.
- **Verification & Provenance**: Every AI-generated claim must be backed by a verifiable source timestamp and meeting reference.

