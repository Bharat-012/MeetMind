# MeetMind — Changelog

All notable changes to the MeetMind project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.5] - 2026-10-30: Recursive QA, Bug Fixes & Final Acceptance

### Added
- **Recursive QA Engine Test Suite (`backend/tests/test_recursive_qa_engine.py`)**:
  - Added 9 comprehensive automated tests verifying:
    1. Validation of all 8 media extensions (MP3, WAV, M4A, AAC, MP4, MOV, MKV, WebM) + disallowed types.
    2. Deep PyAV probing across all 8 formats: codec identification, audio/video detection, and browser playability.
    3. Web preview generation for non-browser video formats (MKV, MOV).
    4. Video thumbnail extraction.
    5. Negative media edge cases: empty 0-byte file rejection, corrupt file rejection, oversized file rejection (413).
    6. Complete YouTube URL parser matrix: watch, youtu.be, shorts, embed, and error reporting for invalid schemes/domains.
    7. Security boundaries: invalid UUID rejection (400) and path traversal defense on media streaming.
    8. Cross-tenant participant isolation: blocking cross-organization speaker assignments.
    9. EvidenceValidator integrity: tentative decision downgrading and stripping hallucinated owners.
- **Frontend Favicon Asset**:
  - Added `frontend/public/favicon.ico` and `frontend/public/favicon.png`, resolving browser 404 console errors.
- **Final QA Acceptance Report (`FINAL_QA_ACCEPTANCE_REPORT.md`)**:
  - Comprehensive documentation covering executive status (MVP READY), feature coverage matrix, defect register, local AI audit, security audit, performance results, and browser verification gallery.

### Fixed
- **MP3 Browser Playability False Negative**:
  - Added `mp3float` to `MediaService.BROWSER_PLAYABLE_AUDIO_CODECS` so native PyAV MP3 streams are correctly marked browser-playable.
- **Console Errors in Browser**:
  - Cleaned up all console errors across 5 viewports, achieving `0 console errors` in Google Chrome.

### Verified
- **Backend Test Suite**: 54 passed, 0 failed, 0 warnings in 153.30s (100% pass rate).
- **Frontend Checks**: TypeScript clean (0 errors), Next.js production build clean (0 errors).
- **Browser Automation**: Playwright automated testing in native Google Chrome across 5 viewports with zero horizontal overflow.

---

## [0.6.0] - 2026-10-30: Ultimate One-Day MVP Completion & Quality Sprint

### Added
- **Full Media Format Support Expansion**:
  - Expanded `ALLOWED_MEDIA_EXTENSIONS` across `backend/app/core/config.py`, `backend/.env`, and `frontend/components/IngestModal.tsx` to include `.aac`.
  - Full matrix of 8 supported formats: MP4, MOV, MKV, WebM, WAV, MP3, M4A, AAC with 500MB size limit enforcement.
- **Sprint Automated Test Suite (`backend/tests/test_mvp_completion_sprint.py`)**:
  - 6 dedicated automated tests covering:
    1. Validation of all 8 media extensions.
    2. HTTP 413 rejection of oversized media uploads (>500MB).
    3. Filename sanitization converting whitespace to underscores.
    4. Path traversal defense preventing directory breakout attacks.
    5. Pipeline retry idempotency verifying zero duplicate records.
    6. Grounded vs truthful insufficient evidence fallback verification.
- **Comprehensive Browser Verification Suite (`scratch/test_mvp_complete_browser.py`)**:
  - Automated Playwright browser tests executed directly in native Google Chrome across 5 user journeys with 8 high-resolution screenshots (`68_mvp_local_video_player.png` through `75_mvp_speakers_directory.png`).

### Changed
- **Anti-False-Positive Grounding Defenses**:
  - Added meta-words (`meeting`, `meetings`, `during`, `about`, `there`, `their`, `they`, `have`, `been`, `with`, `tell`, `show`) to search stop-words in `OllamaProvider` and `RAGService`.
  - Prevents meta-conversational queries (e.g. 'during the meeting') from triggering false-positive keyword hits on unrelated topics.
- **Starlette 413 Deprecation Resolution**:
  - Replaced deprecated `status.HTTP_413_REQUEST_ENTITY_TOO_LARGE` with `getattr(status, 'HTTP_413_CONTENT_TOO_LARGE', 413)` in `MediaService`.
- **Media Upload Sanitization**:
  - Ensured uploaded media files with spaces and special characters are safely normalized on disk while preserving user-facing filenames in metadata.

### Verified
- **Backend Test Suite**:
  - 45 passed, 0 warnings in 227.09s (100% pass rate).
- **Frontend Quality Assurance**:
  - TypeScript compilation: 0 errors (`npx tsc --noEmit`).
  - Next.js production build: 0 errors (`npm run build`).
- **Browser End-to-End Verification**:
  - All 5 critical user journeys passed with zero visual defects or console errors.

---

## [0.5.0] - 2026-10-30: Phase 5 — Advanced AI Meeting Chat & Knowledge Intelligence

### Added
- **Genuine Local Semantic Embedding Provider (`app/services/ai/local_embedding_provider.py`)**:
  - Fully local CPU/CUDA dense embedding generation using HuggingFace `transformers` and PyTorch with `sentence-transformers/all-MiniLM-L6-v2`.
  - Generates 384-dimensional L2-normalized vectors via mean pooling. Zero cloud embedding APIs.
- **Intent-Aware Hybrid Retriever (`app/services/rag_service.py`)**:
  - Indexes rich chunk types: `transcript_block`, `summary`, `decision`, `action_item`, `risk_issue`, `open_questions`.
  - Intent classification (`decisions`, `action_items`, `blockers_risks`, `summary_overview`, `speaker_specific`).
  - Hybrid scoring formula: dense cosine similarity + lexical keyword matching + intent chunk-type boost (+0.25) + speaker relevance boost (+0.20).
- **Grounded Contextual Suggested Questions (`GET /api/chat/suggested-questions`)**:
  - Dynamically derives realistic, grounded question chips from authentic meeting decisions, action items, risks, and attendee names.
  - Supports both meeting-level and organization-wide scopes.
- **Persistent Chat Sessions & Messages (`app/models/knowledge.py`, `app/api/chat.py`)**:
  - `ChatConversation` and `ChatMessage` models with CRUD endpoints (`/api/chat/conversations`).
  - Strict multi-tenant isolation enforcing organization ownership checks (HTTP 403 Forbidden on cross-tenant access).
- **Real-Time SSE Streaming (`POST /api/chat/stream`)**:
  - Streams Server-Sent Events (`data: {"type": "token", "content": "..."}`) for live typewriter rendering.
  - Returns active model provenance badge (`ollama:llama3.2` or transparent offline `local-rule-based-fallback`).
  - Delivers final verifiable evidence citations payload.
- **Meeting Detail Chat UI Overhaul (`frontend/app/meetings/[id]/page.tsx` Tab 7)**:
  - Redesigned chat container with active model indicator, "New Chat" session reset button, suggested question chips, streaming generation effect, user stop button, and verifiable citation cards.
  - Interactive clickable timestamp pills (`[mm:ss]`): clicking seeks video/audio player directly (`seekTo(c.timestamp_start)`).
- **Workspace Cross-Meeting Synthesizer UI Overhaul (`frontend/app/workspace/page.tsx` Tab 2)**:
  - Cross-meeting chat with organizational suggested questions, multi-meeting citation pills linking to source meetings.

### Verified
- **Automated Backend Regression Test Suite**:
  - 39 tests passing in 143.42s (100% pass rate) across all phases.
- **Frontend Quality Assurance**:
  - Clean TypeScript check: 0 errors (`npx tsc --noEmit`).
  - Production build successful: 0 errors (`npm run build`).
- **Browser End-to-End Automation via Playwright Chrome**:
  - `test_phase5_browser.py`: Verified single-meeting chat, suggested questions, streaming answer, citation seek, reset, and multi-meeting organizational chat.
  - 4 high-resolution screenshots captured: `64_meeting_chat_citations.png`, `65_meeting_chat_citation_seek.png`, `66_meeting_chat_reset.png`, `67_workspace_cross_meeting_chat.png`.

---

## [0.4.8] - 2026-10-30: Complete UI/UX Redesign — Premium Modern Minimalist SaaS

### Added
- **Reusable Application Shell (rontend/components/AppShell.tsx)**:
  - Unified desktop and mobile navigation layout with slim sidebar, MeetMind branding, organization indicator/switcher, prominent 'New Meeting' trigger, and bottom local AI engine hardware status indicator with dynamic health badge.
  - Responsive mobile drawer toggle with backdrop overlay and smooth slide-out animation on small screens (<768px).
- **Redesigned Ingest Modal (rontend/components/IngestModal.tsx)**:
  - Minimalist segmented controls switching between Local Media Upload and YouTube URL Import.
  - Interactive drag-and-drop dropzone displaying file size, media type icon, and format hints (MP4, MOV, MKV, WebM, WAV, MP3, M4A up to 2GB).
  - High-visibility error callouts and loading spinner states during network submission.
- **Redesigned Dashboard (rontend/app/page.tsx)**:
  - Live metric summary cards querying real backend numbers (Total Meetings, Decisions Logged, Active Action Items, Directory Speakers).
  - Recent Meetings table with source format pills, duration, creation date, status badges, and direct navigation links.
  - Verified Local AI Infrastructure section highlighting Faster-Whisper (ASR), NVIDIA Nemotron-3 (Diarization), and Local LLM/RAG with Zero Cloud AI APIs guarantee.
- **Redesigned Meetings Library & Workspace (rontend/app/workspace/page.tsx)**:
  - Real-time client-side search filtering by meeting title or description, and processing status filter dropdown.
  - Responsive card grid displaying meetings with metadata badges, durations, dates, and status pills.
  - Tab views for Cross-Meeting Chat with verifiable citations, Historical Decisions Register, and Organization Action Items.
- **Redesigned Speaker Directory (rontend/app/speakers/page.tsx)**:
  - Searchable speaker profile cards with avatar initials, email, description, and speaking time statistics.
  - Side-by-side Appearances & History Drawer showing meetings attended and verified dialogue turns.
  - Modal dialogs for creating and editing speaker profiles.
- **Unified Design Tokens & Layout (rontend/app/globals.css, rontend/app/layout.tsx)**:
  - Cohesive deep dark palette (#090d16 background, #0d121f sidebar, #0f172a cards/surfaces, #1e293b borders, indigo accents).
  - Custom scrollbar styling and suppression of browser-level horizontal scrollbars.

### Verified
- **Comprehensive Multi-Viewport Playwright Browser Test Suite (	est_redesign_viewports_e2e.py)**:
  - Desktop 1440x900: Dashboard, Ingest Modal, Workspace Library, Decisions Register, Action Items, Cross-Meeting Chat, Speakers Directory with Appearances Drawer, Meeting Detail with local video player (all PASS).
  - Laptop 1280x800: Workspace Library, Meeting Detail YouTube showcase (all PASS).
  - Tablet 768x1024: 2-column Dashboard grid, responsive Speakers Directory (all PASS).
  - Mobile 390x844: Hamburger navigation drawer, mobile dashboard, responsive meeting detail player (all PASS).
  - 20 high-resolution screenshots captured (44_* to 63_*).
- **Production Next.js Build**:
  - 
pm run build completed with 0 errors.
- **TypeScript Static Check**:
  - 
px tsc --noEmit completed with 0 errors.
- **Full Backend Pytest Suite**:
  - 34/34 tests passed in 320s with 0 regressions.

## [0.4.7] - 2026-10-29: Video Preview, Audio/Video Player & Meeting Detail UI Overhaul

### Fixed
- **Missing Video Preview Container for Local & YouTube Videos**:
  - Replaced the compact audio bar with a prominent, responsive 16:9 HTML5 video player for local MP4/WebM video files displaying real video frames.
  - Added video codec format badges (e.g. `H264`, `MP4 VIDEO`), duration display, and browser compatibility warning banners.
  - Updated `media_service.import_from_url` in `backend/app/services/media_service.py` with `"ffmpeg_location": self.ffmpeg_path` and format preference `best[ext=mp4][height<=720]/bestvideo[height<=720]+bestaudio/best[height<=720]/best/bestaudio`, allowing yt-dlp to merge separated video/audio streams into a standard playable MP4 file.
  - Added rich YouTube Showcase Card for YouTube imports displaying original YouTube thumbnail backdrop, channel attribution, duration, external video link, and one-click toggle to YouTube player.
- **Dedicated Audio Player Experience for Audio-Only Files**:
  - For audio recordings (e.g. WAV, MP3), renders a dedicated spacious Audio Player Card with audio wave icon, audio format badge, title, duration, volume controls, and playback scrubber without an awkward empty black video frame.
- **Stuck `GENERATING_SUMMARY` Status & 0 Events Placeholder**:
  - Diagnosed root cause: `fetchMeetingData()` in `frontend/app/meetings/[id]/page.tsx` was only called once on mount (`useEffect(..., [meetingId])`). If the user navigated to the page while the backend was still generating summaries, the UI froze permanently in that state with empty deliverables.
  - Added active real-time polling (every 2.5 seconds) while `status !== 'COMPLETED' && status !== 'FAILED'`, ensuring the frontend automatically detects completion and renders all intelligence deliverables (executive summary, chronological events, decisions, action items, speaker attribution) without manual reload.
- **Orphaned Job Recovery on Server Restart**:
  - Added lifespan cleanup in `backend/app/main.py` that queries any meetings stuck in intermediate processing states (`VALIDATING`, `TRANSCRIBING`, `DIARIZING`, `GENERATING_SUMMARY`, etc.) during startup and transitions them to `FAILED` with an actionable message prompting the user to click 'Retry Processing'.
- **Horizontal White Scrollbar Removal**:
  - Overhauled navigation tabs container using Tailwind `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden` and `.no-scrollbar` utility in `frontend/app/globals.css`, eliminating the unsightly default browser scrollbar on Windows Chrome.
- **Header Breadcrumb & Title Layout**:
  - Resolved text collisions and overlapping elements in the header bar. Breadcrumb `<- Workspace`, meeting title, status badge, and source badge are cleanly separated with truncation and standard spacing.

### Verified
- **Automated Playwright Browser E2E Test Suite (`test_player_ui_e2e.py`)**:
  - Tested meeting `fake` (user screenshot reference): verified status displays `COMPLETED`, YouTube Showcase Card renders thumbnail and channel `Unsocial Programmer`, and Tab 2 renders 15 chronological events (screenshots 37-39).
  - Tested local video meeting: verified HTML5 `<video>` element with video frames, playback, seeking, and active transcript highlighting (screenshots 40-41).
  - Tested audio-only meeting: verified dedicated audio player card without empty video container (screenshot 42).
- **Backend Pytest Suite**:
  - 34/34 tests passing (100% pass rate).
- **Frontend TypeScript Compiler**:
  - 0 errors via `npx tsc --noEmit`.

## [0.4.6] - 2026-10-29: Critical Bug Fix — YouTube Import + Local Video Preview and Processing

### Fixed
- **Local Media Streaming & Byte-Range Delivery (GET /api/meetings/{id}/media)**:
  - Implemented secure Starlette FileResponse route supporting HTTP 206 Partial Content range requests (Accept-Ranges: bytes, Content-Range) and path traversal security validation (os.path.realpath inside MEDIA_STORAGE_DIR).
  - Enables smooth seeking, scrubbing, and streaming in HTML5 video/audio players without downloading the entire media file upfront.
- **Media Information API (GET /api/meetings/{id}/media-info)**:
  - Probes uploaded media files via PyAV (v.open) to extract duration, dimensions, framerate, video/audio codecs, and browser playability flags (is_browser_playable).
  - Delivers codec warnings and playback capabilities to the frontend client.
- **Frontend HTML5 Video & Audio Player (rontend/app/meetings/[id]/page.tsx)**:
  - Replaced simulated setInterval timer with real HTML5 <video> and <audio> elements listening to onTimeUpdate and onLoadedMetadata.
  - Added responsive video preview container, format badge, and collapsible toggle.
  - Linked scrubber slider and Play/Pause controls directly to ideo.currentTime and ideo.play().
  - Synchronized transcript segment clicks to seek the real video/audio player to the exact timestamp (ideo.currentTime = seg.start_time; video.play()) and dynamically highlight the active segment during playback.
  - Added browser codec warning banner and audio-only playback fallback.
- **Audio Extraction with FFmpeg & PyAV Fallback (ackend/app/services/media_service.py)**:
  - Integrated imageio-ffmpeg static binary detection in ModelManager._detect_ffmpeg() for reliable standalone FFmpeg execution.
  - Implemented extract_audio extracting standard 16kHz mono 16-bit PCM WAV from any container (MP4, WebM, MOV, MKV, AVI) with PyAV frame-resampling fallback.
  - Implemented ensure_web_preview for browser-incompatible video containers (e.g., MKV, ProRes) and generate_thumbnail for frame snapshots.
- **Real YouTube Import Service with yt-dlp (ackend/app/services/media_service.py)**:
  - Integrated yt-dlp dependency to safely extract metadata and permitted public video/audio streams.
  - Added strict syntax and video ID validation (alidate_youtube_url), rejecting invalid schemes and unsupported domains.
  - Added pre-download accessibility checks for private, restricted, removed, or DRM-protected videos with clear HTTP 400 error messages.
  - Prevented ingestion of active livestreams before broadcast conclusion.
  - Automated download of permitted media and conversion to 16kHz mono WAV for downstream Faster-Whisper and Nemotron-3 processing.
  - Added duplicate detection in POST /api/meetings/import-url to prevent re-importing the same YouTube URL within the same workspace (HTTP 409 Conflict).
- **Ingestion Modal Navigation (rontend/app/workspace/page.tsx)**:
  - Updated onSuccess callback to automatically route to /meetings/{createdMeeting.id} on submission.

### Verified
- **Playwright Browser E2E Test Suite (ackend/test_video_and_youtube_browser_e2e.py)**:
  - Test 1: Workspace loaded cleanly.
  - Test 2: Corrupt media file rejected cleanly with HTTP 400 error displayed in UI.
  - Test 3: Local video upload (sample_meeting_video.mp4), pipeline completion in 10s, HTML5 <video> player rendered, HTTP 206 range requests confirmed, Play/Pause functional, transcript segment click seeking video and active highlight confirmed, Deliverables A/B/C rendered.
  - Test 4: YouTube non-YouTube domain rejection and non-existent video ID rejection confirmed with UI error messages.
  - Test 5: Real public YouTube video imported (https://www.youtube.com/watch?v=jNQXAC9IVRw), downloaded, transcribed, diarized, and played back with seeking.
  - Test 6: Duplicate YouTube URL in same workspace rejected with 409 Conflict.
  - Captured 17 high-resolution screenshots (20_* to 36_*) validating the full browser journey.
- **Unit & Integration Regression Suite**:
  - All 34/34 tests passed with 100% success rate.

## [0.4.5] - 2026-10-29: Browser-Based End-to-End Testing & Bug Fixes

### Added
- **Automated Playwright E2E Browser Testing Suite (`test_browser_e2e.py`)**:
  - Drove native Google Chrome headless browser across 14 distinct user journeys.
  - Generated and uploaded real 16kHz mono spoken English audio (`sample_speech.wav`, ~8.2s).
  - Captured 17 high-resolution screenshots covering Home Dashboard, Workspace Library, Ingest Modal, Real Media Upload, Background Pipeline Completion, Deliverable A (Full Transcript, search filter, playback seek), Speaker Attribution & Audit Trail, Deliverable B (Chronological Explanation & Event Sequence), Deliverable C (Structured Summary, Decision Register, Action Item Tracker), Grounded Meeting Chat (Answerable & Unanswerable), Idempotent Regeneration, and Organization Speaker Directory.
- **Evidence Verification in Offline Chat Fallback**:
  - Implemented meaningful keyword matching in `OllamaProvider.answer_question` fallback to strictly verify grounded evidence before returning `found_evidence=True`.
  - Unanswerable queries (e.g. out-of-context questions) now truthfully return `found_evidence=False` with `"The meeting records do not contain sufficient evidence to answer this question."`.

### Fixed
- **Database Schema Evolution**:
  - Added automatic lightweight column migrations in `init_db()` (`app/core/database.py`) to safely apply `ALTER TABLE ... ADD COLUMN` for columns added across Phases 3 and 4 (`source_segment_id`, `model_name`, `is_confirmed`, `description`, `notes`, `assignment_source`).
- **Workspace Media Ingestion Fallback**:
  - Fixed `WorkspacePage` frontend and backend ingestion endpoints (`upload_meeting_media`, `import_media_url`) to fall back to the organization's default workspace if an invalid or unselected workspace ID is passed.
- **Navigation Links**:
  - Added proper `next/link` links on the dashboard sidebar to `/workspace` and `/speakers`.
- **Test Suite Isolation**:
  - Configured `conftest.py` with mock defaults for unit tests to prevent dummy-byte audio decoding exceptions, while preserving genuine local inference tests in `test_real_models_and_audit.py`.

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
