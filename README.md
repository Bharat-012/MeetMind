# MeetMind — AI Meeting Intelligence & Organizational Memory Platform

MeetMind is an enterprise-grade AI meeting intelligence platform that transforms recorded meetings, uploaded audio/video files, online video URLs, and authorized live meeting streams into searchable, speaker-attributed organizational knowledge.

---

## Key Features

- **Multi-Source Ingestion**: Upload MP4, WebM, MOV, MKV, MP3, WAV, M4A, or submit online video URLs.
- **Accurate Speech-to-Text**: Timestamped segment transcription powered by modular ASR engines (e.g. `faster-whisper`).
- **Speaker Diarization & Identity Mapping**: Detect speaker turns with NVIDIA Nemotron-3-Diarization and connect anonymous speaker labels (`SPEAKER_00`) to organization participant profiles with immutable audit trails.
- **Organization Speaker Directory**: Organization-wide directory of participants with participation statistics, meeting history, and spoken segments.
- **Strict Attribution Governance**: Complete prohibition on voice biometrics; attribution requires explicit user confirmation or verified metadata.
- **Three Core Deliverables**:
  1. *Full Transcript*: Timestamped, searchable dialogue.
  2. *Short Transcript / Chronological Explanation*: Narrative sequence of who said what, arguments, and conclusions.
  3. *Structured Summary*: Executive summary, formal decisions, and action items with owners and deadlines.
- **Playback Synchronization**: Synced media player that seeks directly to the audio/video timestamp when a transcript line or citation is clicked.
- **Single-Meeting Grounded RAG Chat**: Conversational Q&A strictly grounded in the meeting transcript with clickable timestamp citations (`[mm:ss]`).
- **Multi-Tenant Organizational Memory**: Search across the entire company meeting archive, compare decisions across time, and query multi-meeting topics while strictly enforcing tenant isolation.
- **Optional Voice Emotion Analysis**: Decoupled acoustic emotion inference from vocal audio.

---

## Repository Structure

```
MeetRoom/
├── PROJECT_RULES.md        # Permanent operating rulebook & AI governance standard
├── PROJECT_OVERVIEW.md     # Vision, user personas, and capabilities
├── ARCHITECTURE.md         # Technical architecture & component specifications
├── IMPLEMENTATION_PLAN.md  # Detailed phased implementation roadmap
├── TASK_TRACKER.md         # Granular task state tracking
├── DECISIONS.md            # Architectural Decision Records (ADRs)
├── CHANGELOG.md            # Version change history
├── .env.example            # Environment variable template
├── backend/                # FastAPI application & AI pipelines
│   ├── app/
│   │   ├── api/            # REST and WebSocket endpoints
│   │   ├── core/           # Config, database engine, security
│   │   ├── models/         # SQLAlchemy ORM multi-tenant models
│   │   ├── schemas/        # Pydantic request & response schemas
│   │   └── services/       # Ingestion, ASR, Diarization, LLM, RAG services
│   └── tests/              # Automated unit and integration tests
└── frontend/               # Next.js responsive web application
```

---

## Quickstart Guide

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- FFmpeg (for media audio extraction)

### 1. Backend Setup
```bash
cd backend
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
cp ../.env.example .env
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## Governance & Rules
All contributors and AI agents working on this project must strictly comply with [PROJECT_RULES.md](file:///d:/MeetRoom/PROJECT_RULES.md).

