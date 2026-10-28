"""High-quality deterministic Mock AI Providers for testing and development."""
import hashlib
from typing import List, Optional, Dict, Any
from app.services.ai.dto import (
    TranscriptSegmentDTO,
    WordTimingDTO,
    DiarizationTurnDTO,
    SummaryDTO,
    ShortTranscriptDTO,
    ChronologicalEventDTO,
    DecisionDTO,
    ActionItemDTO,
    GroundedAnswerDTO,
    EmotionDTO
)


class MockASRProvider:
    """Deterministic ASR provider returning realistic meeting dialogue."""

    async def transcribe(self, audio_path: str, language: Optional[str] = None) -> List[TranscriptSegmentDTO]:
        return [
            TranscriptSegmentDTO(
                start_time=0.0,
                end_time=12.5,
                text="Welcome everyone. Today we are reviewing the Q4 product roadmap and the cloud database migration plan.",
                speaker_label="SPEAKER_00",
                confidence=0.96,
                words=[
                    WordTimingDTO(word="Welcome", start=0.0, end=0.8),
                    WordTimingDTO(word="everyone.", start=0.9, end=1.5),
                    WordTimingDTO(word="Today", start=1.8, end=2.2),
                    WordTimingDTO(word="we", start=2.3, end=2.4),
                    WordTimingDTO(word="are", start=2.5, end=2.6),
                    WordTimingDTO(word="reviewing", start=2.7, end=3.4),
                    WordTimingDTO(word="the", start=3.5, end=3.6),
                    WordTimingDTO(word="Q4", start=3.7, end=4.1),
                    WordTimingDTO(word="product", start=4.2, end=4.7),
                    WordTimingDTO(word="roadmap", start=4.8, end=5.4),
                ]
            ),
            TranscriptSegmentDTO(
                start_time=13.0,
                end_time=25.0,
                text="I have reviewed the latency benchmarks. Moving from MySQL to PostgreSQL with pgvector will reduce search query time by forty percent.",
                speaker_label="SPEAKER_01",
                confidence=0.94,
            ),
            TranscriptSegmentDTO(
                start_time=26.0,
                end_time=42.0,
                text="That sounds promising. What is the cutover timeline, and what risks are we accepting regarding data migration downtime?",
                speaker_label="SPEAKER_00",
                confidence=0.98,
            ),
            TranscriptSegmentDTO(
                start_time=43.0,
                end_time=58.5,
                text="We can perform zero-downtime replication over the weekend. I will finalize the runbook by Friday and share it with engineering.",
                speaker_label="SPEAKER_01",
                confidence=0.95,
            ),
            TranscriptSegmentDTO(
                start_time=59.0,
                end_time=72.0,
                text="Agreed. Let's make that our formal decision. Let's target the migration for next month.",
                speaker_label="SPEAKER_00",
                confidence=0.97,
            )
        ]


class MockDiarizationProvider:
    """Deterministic Diarization provider returning speaker turns."""

    async def diarize(self, audio_path: str) -> List[DiarizationTurnDTO]:
        return [
            DiarizationTurnDTO(start_time=0.0, end_time=12.5, speaker_label="SPEAKER_00", confidence=0.95),
            DiarizationTurnDTO(start_time=13.0, end_time=25.0, speaker_label="SPEAKER_01", confidence=0.92),
            DiarizationTurnDTO(start_time=26.0, end_time=42.0, speaker_label="SPEAKER_00", confidence=0.97),
            DiarizationTurnDTO(start_time=43.0, end_time=58.5, speaker_label="SPEAKER_01", confidence=0.94),
            DiarizationTurnDTO(start_time=59.0, end_time=72.0, speaker_label="SPEAKER_00", confidence=0.96),
        ]


class MockLLMProvider:
    """Deterministic LLM Provider generating evidence-grounded intelligence."""

    async def generate_summary(self, transcript_text: str) -> SummaryDTO:
        return SummaryDTO(
            executive_summary="The team evaluated the Q4 product roadmap and confirmed the migration from MySQL to PostgreSQL with pgvector to improve query performance.",
            key_points=[
                "Latency benchmarks indicate a 40% reduction in search query time with PostgreSQL and pgvector.",
                "Zero-downtime replication strategy was selected for the migration.",
                "The engineering team agreed to target next month for the production cutover."
            ],
            risks=[
                "Potential replication lag during the weekend migration window."
            ],
            open_questions=[
                "Confirming fallback rollback steps if replication integrity check fails."
            ],
            next_steps=[
                "Complete the migration runbook by Friday."
            ],
            model_name="mock-llm-intelligence-v1"
        )

    async def generate_short_transcript(self, segments: List[TranscriptSegmentDTO]) -> ShortTranscriptDTO:
        events = [
            ChronologicalEventDTO(
                timestamp=0.0,
                speaker="SPEAKER_00",
                description="Opened the meeting to review the Q4 roadmap and database migration."
            ),
            ChronologicalEventDTO(
                timestamp=13.0,
                speaker="SPEAKER_01",
                description="Presented benchmark results showing a 40% query latency reduction with PostgreSQL and pgvector."
            ),
            ChronologicalEventDTO(
                timestamp=26.0,
                speaker="SPEAKER_00",
                description="Inquired about migration downtime risks and execution timeline."
            ),
            ChronologicalEventDTO(
                timestamp=43.0,
                speaker="SPEAKER_01",
                description="Proposed zero-downtime weekend replication and committed to delivering the runbook by Friday."
            ),
            ChronologicalEventDTO(
                timestamp=59.0,
                speaker="SPEAKER_00",
                description="Formally approved the migration plan for next month."
            )
        ]
        narrative = (
            "At 00:00, SPEAKER_00 opened the discussion on Q4 architecture. "
            "At 00:13, SPEAKER_01 shared benchmarks demonstrating a 40% query time reduction with PostgreSQL and pgvector. "
            "SPEAKER_00 raised questions regarding cutover downtime, and SPEAKER_01 proposed zero-downtime replication with a Friday runbook deadline. "
            "At 00:59, the team formally approved targeting the migration for next month."
        )
        return ShortTranscriptDTO(narrative_text=narrative, chronological_events=events)

    async def extract_decisions(self, transcript_text: str) -> List[DecisionDTO]:
        return [
            DecisionDTO(
                title="Migrate database to PostgreSQL with pgvector",
                decision_text="The team officially decided to proceed with migrating from MySQL to PostgreSQL with pgvector next month.",
                responsible_person="SPEAKER_01",
                evidence_timestamp=59.0,
                evidence_quote="Let's make that our formal decision. Let's target the migration for next month."
            )
        ]

    async def extract_action_items(self, transcript_text: str) -> List[ActionItemDTO]:
        return [
            ActionItemDTO(
                task_description="Finalize zero-downtime replication runbook and share with engineering",
                owner_name="SPEAKER_01",
                due_date="Friday",
                priority="HIGH",
                evidence_timestamp=43.0,
                evidence_quote="I will finalize the runbook by Friday and share it with engineering."
            )
        ]

    async def answer_question(self, query: str, context: List[Dict[str, Any]]) -> GroundedAnswerDTO:
        query_lower = query.lower()
        if "postgres" in query_lower or "database" in query_lower or "migration" in query_lower or "benchmark" in query_lower:
            return GroundedAnswerDTO(
                answer="The team decided to migrate from MySQL to PostgreSQL with pgvector, which is projected to reduce query latency by 40%. The runbook will be finalized by Friday.",
                citations=[
                    {
                        "meeting_id": context[0].get("meeting_id") if context else "unknown",
                        "timestamp_start": 13.0,
                        "timestamp_end": 25.0,
                        "speaker_name": "SPEAKER_01",
                        "quote": "Moving from MySQL to PostgreSQL with pgvector will reduce search query time by forty percent."
                    },
                    {
                        "meeting_id": context[0].get("meeting_id") if context else "unknown",
                        "timestamp_start": 43.0,
                        "timestamp_end": 58.5,
                        "speaker_name": "SPEAKER_01",
                        "quote": "I will finalize the runbook by Friday and share it with engineering."
                    }
                ],
                found_evidence=True
            )
        return GroundedAnswerDTO(
            answer="The meeting records do not contain sufficient evidence to answer this question.",
            citations=[],
            found_evidence=False
        )


class MockEmbeddingProvider:
    """Deterministic embedding provider that creates fixed-size vectors from text hash."""

    def __init__(self, dimensions: int = 384):
        self.dimensions = dimensions

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        embeddings = []
        for text in texts:
            # Generate deterministic pseudo-embedding using SHA-256 hash
            hasher = hashlib.sha256(text.encode("utf-8")).digest()
            vec = []
            for i in range(self.dimensions):
                byte_val = hasher[i % len(hasher)]
                # normalize between -1.0 and 1.0
                vec.append((byte_val / 127.5) - 1.0)
            # Normalize vector magnitude
            norm = sum(x * x for x in vec) ** 0.5 or 1.0
            embeddings.append([x / norm for x in vec])
        return embeddings


class MockVoiceEmotionProvider:
    """Deterministic vocal acoustic emotion provider."""

    async def analyze(self, audio_path: str, segments: List[TranscriptSegmentDTO]) -> List[EmotionDTO]:
        emotions = []
        for seg in segments:
            emotions.append(
                EmotionDTO(
                    start_time=seg.start_time,
                    end_time=seg.end_time,
                    emotion_label="engaged",
                    confidence=0.88,
                    acoustic_features={"mean_pitch_hz": 182.4, "vocal_energy_db": -22.1}
                )
            )
        return emotions

