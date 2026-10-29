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

---

## ADR-006: Strict Local-First AI Inference Policy
- **Status**: Accepted
- **Context**: Privacy and organizational sovereignty require that meeting audio, transcripts, summaries, embeddings, and chat questions must never be sent to third-party cloud AI APIs (OpenAI, Anthropic, Gemini, cloud transcription).
- **Decision**: Enforce that all AI inference executes locally on user-controlled hardware. Speech recognition uses `faster-whisper`, diarization uses `NVIDIA Nemotron-3-Diarization`, LLM summarization and chat use locally hosted `Ollama`, and embeddings use local Sentence-Transformers. No silent cloud fallback is permitted.
- **Consequences**: Complete privacy guarantee for enterprise meeting data, offline operation capability, zero per-token cloud inference costs.

---

## ADR-007: NVIDIA Nemotron-3-Diarization as Primary Diarization Engine
- **Status**: Accepted
- **Context**: Speaker diarization is critical for attributing decisions and action items to correct participants. NVIDIA's Nemotron-3-Diarization is an open-weight, 100M parameter Sortformer model delivering state-of-the-art low Diarization Error Rate (DER) across up to 8 concurrent speakers and overlapping speech with 10ms frame resolution.
- **Decision**: Adopt `nvidia/Nemotron-3-Diarization` under OpenMDW 1.1 license as MeetMind's primary speaker diarization architecture. Interface it through `Nemotron3DiarizationProvider`, mapping its speaker dictionary outputs into MeetMind's internal `DiarizationTurnDTO` and aligning them with Whisper transcript segments.
- **Consequences**: Handles multi-speaker overlap accurately while keeping memory consumption under ~1.5 GB VRAM.

---

## ADR-008: Organization-Level Speaker Directory and Explicit Attribution Audit Trail
- **Status**: Accepted
- **Context**: Diarization models output anonymous, meeting-scoped labels (`SPEAKER_00`, `SPEAKER_01`). Automatically inferring identity across meetings using voice biometrics introduces privacy violations, false positive misattributions, and legal liability. Furthermore, organizations need a centralized directory of participants with full auditability of who made or corrected speaker assignments.
- **Decision**:
  1. Implement an organization-scoped Speaker Directory (`MeetingParticipant`) storing reusable profiles (`name`, `email`, `description`, `avatar_url`) isolated per tenant.
  2. Maintain strict meeting scoping for diarizer outputs (`Speaker`). Never assume `SPEAKER_00` in Meeting A is the same person as `SPEAKER_00` in Meeting B.
  3. Prohibit automatic voice biometric identification. Speaker attribution requires explicit user confirmation or verified metadata.
  4. Preserve original diarization labels permanently alongside user-confirmed display names.
  5. Log every assignment, correction, and unassignment action in `AuditLog` recording the actor, timestamp, previous value, and new value.
- **Consequences**: Complete transparency and auditability, zero biometric privacy liability, robust multi-tenant isolation, and flawless preservation of original diarization data.

---

## ADR-009: Meeting Intelligence Engine, Evidence Provenance, and Hallucination Prevention
- **Status**: Accepted
- **Context**: In Phase 4, MeetMind generates three distinct meeting deliverables (Deliverable A: Full Transcript, Deliverable B: Chronological Narrative Explanation, Deliverable C: Structured Meeting Intelligence covering Executive Summary, Decision Register, and Action Item Tracker). Generative AI models are prone to hallucinating facts, inventing non-existent owners/deadlines, creating fabricated timestamps, or confusing informal suggestions with approved decisions.
- **Decision**:
  1. Implement a dedicated `EvidenceValidator` service that validates all extracted decisions, action items, and chronological events against authentic database `TranscriptSegment`s belonging strictly to the target `meeting_id`.
  2. Mandate foreign key provenance linking: every Decision and Action Item stores `source_segment_id`, `evidence_timestamp`, and `evidence_quote`. Every chronological event links to `source_segment_id`.
  3. Strictly enforce decision status classification: informal suggestions and tentative proposals must be classified as `PROPOSED`, never `CONFIRMED`.
  4. Strictly prohibit hallucination of action item owners and deadlines: if an owner or due date is not grounded in the meeting text or confirmed participants, the fields are explicitly assigned `None` (rendered as "Unassigned" / "No deadline").
  5. Enforce transparent model provenance: every intelligence artifact stores `model_name` (e.g. `ollama:llama3.2` or clearly labeled `local-rule-based-fallback (ollama offline)`).
  6. Ground single-meeting and organization chat with verifiable timestamp citations (`[mm:ss]`). If the transcript or memory does not answer a query, return an explicit "insufficient evidence" response (`found_evidence = False`) rather than guessing.
- **Consequences**: Guaranteed factual grounding, complete traceability from summary/decision to exact spoken audio turn, zero ungrounded owner/deadline hallucinations, and transparent offline fallback behavior.
