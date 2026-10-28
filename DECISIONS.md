# MeetMind — Architectural Decision Records (ADRs)

## ADR-001: Local-First Modular Architecture with Dual Database Support
- **Status**: Accepted
- **Context**: Developers and evaluators need to run MeetMind immediately on local workstations without mandatory external cloud infrastructure (e.g., managed Postgres, Redis clusters, or S3 buckets), while enterprise deployments require horizontal scalability and robust vector indexing.
- **Decision**: Build the application on SQLAlchemy 2.0 with asynchronous session management. Support SQLite in WAL mode with local file storage for effortless local development and automated testing, while providing full configuration support for PostgreSQL with pgvector, Redis, and MinIO/S3 in production.
- **Consequences**: Zero external dependencies required for initial development, fast automated test runs, and clear migration path to production.

---

## ADR-002: Pluggable AI Provider Protocols with Fallback Engines
- **Context**: AI models for ASR (e.g. faster-whisper), Diarization (e.g. pyannote), LLMs (e.g. Ollama, OpenAI), and Embeddings require varying compute, GPU VRAM, and license agreements. Running automated test suites must not depend on downloading 5GB+ model weights or having CUDA-capable GPUs.
- **Decision**: Define strict Python Protocol interfaces for every AI capability. Provide production adapters (e.g. `FasterWhisperProvider`, `PyannoteProvider`, `OpenAICompatibleProvider`, `SentenceTransformersProvider`) alongside deterministic, rule-based fallback adapters (`MockASRProvider`, `MockDiarizationProvider`, `RuleBasedLLMProvider`, `MockEmbeddingProvider`).
- **Consequences**: Business logic is completely decoupled from model specifics. Unit and integration tests run deterministically in sub-seconds in any CI/CD environment.

---

## ADR-003: Three Distinct Meeting Deliverables with Segment Provenance
- **Context**: Users require different granularities of meeting intelligence: exhaustive dialogue, a chronological narrative explaining how decisions evolved, and actionable executive summaries.
- **Decision**: MeetMind will persist three distinct artifacts for every meeting:
  1. *Full Transcript*: Complete, timestamped, speaker-attributed dialogue.
  2. *Short Transcript / Chronological Explanation*: Narrative detailing who proposed ideas, arguments, disagreements, and final resolutions in sequential order.
  3. *Structured Summary*: Executive summary, key points, formal decisions, and action items with owners and deadlines.
  Every claim in deliverables 2 and 3 must maintain foreign key references or timestamp anchors to the underlying transcript segments.
- **Consequences**: Prevents hallucination, establishes auditability, and allows users to verify summaries against actual speech.

---

## ADR-004: Multi-Tenant Data Isolation and Untrusted Transcript Input
- **Context**: Meetings frequently contain confidential organizational information. Cross-tenant data leakage or prompt injection attacks embedded inside spoken audio are critical security risks.
- **Decision**: Multi-tenant boundaries (`organization_id`, `workspace_id`) are enforced on every database query and vector retrieval operation. Transcripts and meeting media are treated as untrusted data payloads; instructions inside transcripts are strictly isolated from system instructions in AI prompts.
- **Consequences**: Bulletproof tenant isolation and robust protection against transcript prompt injection.

---

## ADR-005: Decoupled Optional Voice Emotion Analysis
- **Context**: Acoustic emotion analysis requires raw audio feature extraction and is subject to predictive uncertainty. It must never block core transcription or summarization.
- **Decision**: Implement Voice Emotion Analysis as an independent, optional pipeline stage. Predictions are stored as tentative acoustic tags with confidence scores. If this stage fails, the meeting completes with status `PARTIALLY_COMPLETED`.
- **Consequences**: Core meeting intelligence is resilient to emotion analysis failures.

