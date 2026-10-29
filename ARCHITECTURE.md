# MeetMind — Technical Architecture & System Design

## 1. High-Level Architecture Overview

MeetMind is designed as a privacy-preserving modular platform with asynchronous background pipeline processing, pluggable local AI inference engines, and multi-tenant security boundaries.

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
│  - Central Local Model Manager    - Hardware Profiling & Readiness API      │
└───────────┬──────────────────────────────────────────────┬──────────────────┘
            │ DB / Queries                                 │ Job Dispatch
            ▼                                              ▼
┌──────────────────────────────────────┐     ┌────────────────────────────────┐
│      Persistence & Storage           │     │    Async Background Worker     │
│  - Database: SQLAlchemy 2.0 ORM      │     │  - Job Pipeline Orchestrator   │
│    (SQLite local / PostgreSQL prod)  │     │  - Idempotent Stage Runner     │
│  - Vector Storage: pgvector /        │     │  - State Machine Checkpoints   │
│    Local Normalized Cosine Index     │     │  - Media Extraction (FFmpeg/wav│
│  - Media Store: Local FS / MinIO/S3  │     └───────────────┬────────────────┘
└──────────────────────────────────────┘                     │
                                                             ▼
                                             ┌────────────────────────────────┐
                                             │     Strict Local AI Models     │
                                             │  - ASR: faster-whisper (local) │
                                             │  - Diarizer: NVIDIA Nemotron-3 │
                                             │    Diarization (Sortformer)    │
                                             │  - LLM: Local Ollama (llama3.2)│
                                             │  - Embeddings: all-MiniLM-L6-v2│
                                             │  - Voice Emotion: Local audio  │
                                             │  (Zero Third-Party Cloud AI)   │
                                             └────────────────────────────────┘
```

---

## 2. Component Specifications

### 2.1 Frontend (Presentation Layer)
- **Framework**: Next.js (App Router), React, TypeScript.
- **Styling & Components**: Tailwind CSS, Lucide icons, accessible modal and tab controls.
- **Key Modules**:
  - `MediaUpload & IngestModal`: Multipart drag-and-drop file upload with progress tracking and URL ingestion (YouTube / media URLs).
  - `MeetingDetailView`: Unified hub with synchronized audio/video player and 9 view tabs:
    1. *Overview*: Metadata, processing state, high-level summary cards.
    2. *Full Transcript*: Timestamped, speaker-attributed dialogue with search, filter, and player seeking.
    3. *Short Transcript*: Chronological narrative detailing who proposed what, disagreements, and conclusions.
    4. *Summary*: Structured executive summary, key topics, and findings.
    5. *Decisions*: Formal decision register with supporting evidence and revision histories.
    6. *Action Items*: Task board with owners, deadlines, priority, and status toggles.
    7. *Speakers*: Speaker mapping tool allowing users to map anonymous speaker IDs to organization members.
    8. *Meeting Chat*: Grounded conversational QA with clickable timestamp citations (`[mm:ss]`).
    9. *Voice Analysis*: Optional acoustic emotion and vocal energy graphs.
  - `OrgWorkspaceView`: Cross-meeting library, multi-meeting RAG chat, project filters, and company-wide decision search.

### 2.2 Backend API (Application Layer)
- **Framework**: Python 3.11+, FastAPI, Pydantic v2.
- **Security & Multi-Tenancy**: Organization and workspace isolation enforced on every request. Resource queries are parameterized with `organization_id`.
- **Central Local Model Manager (`LocalModelManager`)**:
  - Profiles host hardware (CPU cores, RAM, GPU model, VRAM, CUDA capability, FFmpeg binary).
  - Evaluates readiness of local models (`faster-whisper`, `nvidia/Nemotron-3-Diarization`, `Ollama`).
  - Enforces strict local inference policy: `cloud_fallback_enabled = False`.
- **Asynchronous Processing**: Background job manager handling long-running extraction, ASR, and indexing tasks without blocking HTTP event loops.

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

## 3. Local AI Models & Diarization Specifications

### 3.1 Speech-to-Text: `faster-whisper`
- **Library**: `faster-whisper` powered by CTranslate2.
- **Execution**: Local execution on CPU (`int8`) or NVIDIA CUDA GPU (`float16`).
- **Features**: Preserves sentence-level and word-level timestamps (`WordTimingDTO`), VAD filtering, and multi-language detection.
- **Zero Cloud Leakage**: Runs entirely on local weights; never queries OpenAI or third-party transcription APIs.

### 3.2 Speaker Diarization: `NVIDIA Nemotron-3-Diarization`
- **Model ID**: `nvidia/Nemotron-3-Diarization` on Hugging Face.
- **Architecture**: 100M parameter Sortformer supporting up to 8 concurrent speakers and overlapping speech.
- **Frame Step**: 10 ms (100 Hz frame rate).
- **Interface**: Implemented in `Nemotron3DiarizationProvider` via Hugging Face Transformers (`AutoModelForAudioFrameClassification` and `AutoProcessor`).
- **Alignment**: Turn timestamps are aligned with Whisper speech segments using midpoint overlap matching to attribute stable speaker labels (`SPEAKER_00`, `SPEAKER_01`, etc.).

### 3.3 Meeting Intelligence: Local Ollama
- **Engine**: Local `Ollama` daemon (e.g. `llama3.2`, `mistral`).
- **Outputs**: Generates Structured Summaries, Chronological Narratives, Decisions with quotes, Action Items with owners/deadlines, and Grounded Citations.

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

- **Idempotency**: Retrying a failed stage replaces or updates target records without producing duplicate segments, tasks, or embeddings.
- **Fault Tolerance**: If optional voice emotion analysis fails, the meeting completes with status `PARTIALLY_COMPLETED` rather than aborting.

---

## 5. Speaker Directory, Participant Management & Attribution Architecture (Phase 3)

### 5.1 Entity Separation & Data Scoping
To preserve data integrity, multi-tenancy, and auditability, speaker-related entities follow strict scoping boundaries:
1. **`Speaker` (Meeting-Scoped Diarizer Turn)**:
   - Belongs to exactly one `Meeting` (`meeting_id`).
   - Represents an anonymous diarized entity (e.g. `speaker_label = "SPEAKER_00"`).
   - Preserves ground-truth diarizer outputs immutably: `speaker_label` is never overwritten upon assignment or renaming.
   - Holds attribution state (`is_confirmed: bool`, default `False`) and an optional foreign key link to `MeetingParticipant`.
   - **Cross-Meeting Independence**: The identical anonymous label (e.g., `SPEAKER_00`) in two different meetings represents two completely independent database records. The system never merges, links, or assumes identical identity across meetings without explicit manual confirmation.

2. **`MeetingParticipant` (Organization-Scoped Speaker Directory Profile)**:
   - Belongs to an `Organization` (`organization_id`).
   - Represents a persistent person/profile across the tenant's workspace.
   - Tracks canonical identity (`name`, `email`, `role`, `description`).
   - Enables organization-wide participation queries (all meetings attended, segment count, total talk-time duration).

3. **`SpeakerAssignment` & `AuditLog` (Immutable Attribution Audit Trail)**:
   - Every assignment, re-assignment, or un-assignment is recorded in `SpeakerAssignment` with `assignment_source = "MANUAL_CONFIRMED"`.
   - Every mutation produces an event in `AuditLog` capturing:
     - `actor_id` (the authenticated user making the attribution change)
     - `action` (`ASSIGN_SPEAKER`, `UNASSIGN_SPEAKER`, `UPDATE_SPEAKER_PROFILE`, etc.)
     - `details` (JSON payload detailing previous participant/display name vs new participant/display name, timestamp, and optional user notes).

### 5.2 Strict Identity Policy: Prohibition of Voice Biometrics
Per MeetMind core governance:
- **No Automatic Biometric Identification**: The platform strictly prohibits automatic speaker identification inferred from voice similarity, acoustic embeddings, or voice biometrics alone.
- **Explicit Confirmation Only**: Anonymous diarizer labels are only mapped to real identities through:
  1. Explicit user assignment in the UI (`PATCH /api/meetings/{id}/speakers/{speaker_id}`).
  2. Verified external meeting provider metadata (e.g., calendar invitees or Zoom attendee lists with explicit match criteria).
- Any unassigned or uncertain speaker turn remains labeled as `Unassigned` (`is_confirmed = False`).

### 5.3 Speaker Analytics & Contribution Metrics
Meeting intelligence calculates contribution metrics on-the-fly or via cached aggregation:
- `total_talk_time_seconds`: Sum of segment durations (`end_time - start_time`) attributed to the speaker.
- `segment_count`: Number of distinct speech turns spoken by the speaker.
- `talk_time_percentage`: Ratio of speaker's talk time relative to the total spoken speech duration across all meeting segments.

### 5.4 Local LLM Fallback Transparency
When local Ollama inference is offline or uninstalled:
- `OllamaProvider` activates a deterministic, local rule-based extractor for meeting summaries, chronological narratives, decisions, and chat.
- All fallback responses are explicitly labeled (e.g., `[RULE-BASED FALLBACK · Ollama offline]`) with `model_name = "local-rule-based-fallback (ollama offline)"`.
- Cloud AI fallback remains strictly disabled (`cloud_fallback_enabled = False`).

