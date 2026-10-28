# MeetMind — Technical Architecture & System Design

## 1. High-Level Architecture Overview

MeetMind is designed as a modular monolith with decoupled asynchronous background processing, pluggable AI inference interfaces, and multi-tenant security boundaries.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Frontend (Next.js 14+)                           │
│  - Dashboard & Org Workspace      - Interactive Synced Media Player         │
│  - Meeting Detail (9 Tabs)        - Multi-Meeting & Single-Meeting Chat     │
│  - Upload & Ingestion Center      - Speaker Attribution & Task Editor       │
└───────────────────────┬──────────────────────────────────▲──────────────────┘
                        │ HTTP / REST                      │ WebSockets / SSE
                        ▼                                  │
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Backend API (FastAPI)                              │
│  - Auth & Multi-Tenant RBAC       - Meeting Ingestion & Validation          │
│  - REST Controllers (Meetings,    - RAG Chat & Hybrid Search Engine         │
│    Transcripts, Tasks, Decisions) - Speaker Mapping & Audit Log Service     │
└───────────┬──────────────────────────────────────────────┬──────────────────┘
            │ DB / Queries                                 │ Job Dispatch
            ▼                                              ▼
┌──────────────────────────────────────┐     ┌────────────────────────────────┐
│      Persistence & Storage           │     │    Async Background Worker     │
│  - Database: SQLAlchemy ORM          │     │  - Job Pipeline Orchestrator   │
│    (SQLite local / PostgreSQL prod)  │     │  - Idempotent Stage Runner     │
│  - Vector Storage: pgvector /        │     │  - State Machine Checkpoints   │
│    sqlite-vec / Cosine Index         │     │  - Media Extraction (FFmpeg)   │
│  - Media Store: Local FS / MinIO/S3  │     └───────────────┬────────────────┘
└──────────────────────────────────────┘                     │
                                                             ▼
                                             ┌────────────────────────────────┐
                                             │     Pluggable AI Adapters      │
                                             │  - ASR: faster-whisper / mock  │
                                             │  - Diarizer: pyannote / mock   │
                                             │  - LLM: OpenAI / Ollama / rule │
                                             │  - Embeddings: all-MiniLM / mock
                                             │  - Voice Emotion (Optional)    │
                                             └────────────────────────────────┘
```

---

## 2. Component Specifications

### 2.1 Frontend (Presentation Layer)
- **Framework**: Next.js (App Router), React, TypeScript.
- **Styling & Components**: Tailwind CSS, Lucide icons, accessible modal and tab controls.
- **Key Modules**:
  - `MediaUpload`: Multipart drag-and-drop file upload with progress tracking and URL ingestion.
  - `MeetingDetailView`: Unified hub with synchronized audio/video player and 9 view tabs:
    1. *Overview*: Metadata, processing state, high-level summary cards.
    2. *Full Transcript*: Timestamped, speaker-attributed dialogue with search, filter, and player seeking.
    3. *Short Transcript*: Chronological narrative detailing who proposed what, disagreements, and conclusions.
    4. *Summary*: Structured executive summary, key topics, and findings.
    5. *Decisions*: Formal decision register with supporting evidence and revision histories.
    6. *Action Items*: Task board with owners, deadlines, priority, and status toggles.
    7. *Speakers*: Speaker mapping tool allowing users to map anonymous speaker IDs to organization members.
    8. *Meeting Chat*: Grounded conversational QA with clickable timestamp citations.
    9. *Voice Analysis*: Optional acoustic emotion and vocal energy graphs.
  - `OrgWorkspaceView`: Cross-meeting library, multi-meeting RAG chat, project filters, and company-wide decision search.

### 2.2 Backend API (Application Layer)
- **Framework**: Python 3.11+, FastAPI, Pydantic v2.
- **Security & Multi-Tenancy**: Organization and workspace isolation enforced on every request. Resource queries are parameterized with `organization_id`.
- **Asynchronous Processing**: Background job manager handling long-running extraction, ASR, and indexing tasks without blocking HTTP event loops.
- **Real-Time Notification**: WebSocket channel broadcasting pipeline progress (`TRANSCRIBING`, `DIARIZING`, `INDEXING`, etc.) to clients.

### 2.3 Persistence Layer
- **Relational Storage**: SQLAlchemy 2.0 ORM with asynchronous sessions.
  - Development / Out-of-the-Box: SQLite with WAL mode.
  - Production: PostgreSQL 16+.
- **Semantic / Vector Search**:
  - In-database embeddings stored via `Vector` (pgvector) or fallback cosine similarity index with vector serialization.
- **File & Media Storage**:
  - Local filesystem storage (`storage/media/`) in development.
  - S3/MinIO compatible object store in production.

---

## 3. Pluggable AI Architecture

To avoid vendor lock-in and enable deployment in air-gapped or CPU-only environments, all AI capabilities are abstracted behind Python Protocol interfaces:

```python
class SpeechToTextProvider(Protocol):
    async def transcribe(self, audio_path: str, language: Optional[str]) -> List[TranscriptSegmentDTO]: ...

class DiarizationProvider(Protocol):
    async def diarize(self, audio_path: str) -> List[DiarizationTurnDTO]: ...

class LLMProvider(Protocol):
    async def generate_summary(self, transcript: str) -> SummaryResultDTO: ...
    async def answer_question(self, query: str, context: List[RetrievedChunkDTO]) -> GroundedAnswerDTO: ...

class EmbeddingProvider(Protocol):
    async def embed_texts(self, texts: List[str]) -> List[List[float]]: ...

class VoiceEmotionProvider(Protocol):
    async def analyze(self, audio_path: str, segments: List[TranscriptSegmentDTO]) -> List[EmotionAnnotationDTO]: ...
```

Each provider ships with:
1. **Production Engine**: Real local model or standard API (e.g., `FasterWhisperProvider`, `PyannoteProvider`, `OpenAICompatibleProvider`, `SentenceTransformersProvider`).
2. **Deterministic Fallback Engine**: Rule-based or mock provider allowing the entire test suite and application to run reliably on any developer machine without requiring gigabytes of weights or GPU hardware.

---

## 4. Pipeline State Machine

Processing jobs transition through an observable, idempotent state machine:

```
[UPLOADED] ➔ [VALIDATING] ➔ [EXTRACTING_MEDIA] ➔ [TRANSCRIBING] ➔ [DIARIZING]
                                                                        │
[COMPLETED] ◀─ [INDEXING_KNOWLEDGE] ◀─ [GENERATING_SUMMARY] ◀─ [ALIGNING_SPEAKERS]
      ▲
      │ (If error occurs in non-critical stage e.g. Voice Emotion)
[PARTIALLY_COMPLETED]
```

- **Idempotency**: Retrying a failed stage replaces or updates the target records without producing duplicate segments, tasks, or embeddings.
- **Fault Tolerance**: If optional voice emotion analysis fails, the meeting completes with status `PARTIALLY_COMPLETED` rather than aborting.

---

## 5. Multi-Tenant Data Model & Security Boundaries

```
[Organization] ──< [Workspace] ──< [Project] ──< [Meeting]
       │                 │                          │
       ▼                 ▼                          ├──< [MediaAsset]
  [UserOrgRole]     [UserWorkspaceRole]             ├──< [ProcessingJob]
                                                    ├──< [Speaker]
                                                    ├──< [TranscriptSegment]
                                                    ├──< [MeetingSummary]
                                                    ├──< [ShortTranscript]
                                                    ├──< [Decision] ──< [DecisionRevision]
                                                    ├──< [ActionItem] ──< [ActionItemUpdate]
                                                    ├──< [KnowledgeChunk] ──< [Embedding]
                                                    └──< [ChatConversation] ──< [ChatMessage]
```

- Every data query incorporates an explicit `organization_id` filter.
- Untrusted inputs (meeting audio, transcripts, user uploads) are strictly treated as data payloads and never evaluated as executable code or system prompt overrides.

