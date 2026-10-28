"""AI Provider unit tests."""
import pytest
from app.services.ai.mock_providers import (
    MockASRProvider,
    MockDiarizationProvider,
    MockLLMProvider,
    MockEmbeddingProvider
)


@pytest.mark.asyncio
async def test_asr_provider_transcription():
    """Verify ASR provider produces timestamped segments."""
    asr = MockASRProvider()
    segments = await asr.transcribe("dummy_path.wav")
    assert len(segments) > 0
    assert segments[0].start_time == 0.0
    assert segments[0].end_time > 0.0
    assert "roadmap" in segments[0].text
    assert len(segments[0].words) > 0


@pytest.mark.asyncio
async def test_diarization_provider():
    """Verify Diarization provider returns speaker turns."""
    diarizer = MockDiarizationProvider()
    turns = await diarizer.diarize("dummy_path.wav")
    assert len(turns) > 0
    assert turns[0].speaker_label == "SPEAKER_00"
    assert turns[1].speaker_label == "SPEAKER_01"


@pytest.mark.asyncio
async def test_llm_intelligence_generation():
    """Verify LLM provider produces three distinct outputs, decisions, action items, and grounded Q&A."""
    llm = MockLLMProvider()

    # 1. Summary
    summary = await llm.generate_summary("test transcript")
    assert len(summary.executive_summary) > 10
    assert len(summary.key_points) > 0
    assert len(summary.next_steps) > 0

    # 2. Short transcript / chronological narrative
    short_transcript = await llm.generate_short_transcript([])
    assert len(short_transcript.narrative_text) > 10
    assert len(short_transcript.chronological_events) > 0

    # 3. Decisions
    decisions = await llm.extract_decisions("test transcript")
    assert len(decisions) > 0
    assert decisions[0].evidence_timestamp is not None
    assert decisions[0].evidence_quote is not None

    # 4. Action items
    actions = await llm.extract_action_items("test transcript")
    assert len(actions) > 0
    assert actions[0].owner_name == "SPEAKER_01"
    assert actions[0].due_date == "Friday"

    # 5. Grounded Q&A
    answer = await llm.answer_question("What did we decide about the postgres database migration?", [{"meeting_id": "m1"}])
    assert answer.found_evidence is True
    assert len(answer.citations) > 0
    assert "pgvector" in answer.answer

    # 6. Missing evidence handling
    missing_answer = await llm.answer_question("Who won the 1994 world cup?", [])
    assert missing_answer.found_evidence is False
    assert "not contain sufficient evidence" in missing_answer.answer


@pytest.mark.asyncio
async def test_embedding_provider():
    """Verify Embedding provider generates normalized vectors with expected dimensions."""
    embedder = MockEmbeddingProvider(dimensions=384)
    texts = ["Meeting notes regarding database", "Another sentence"]
    embeddings = await embedder.embed_texts(texts)
    assert len(embeddings) == 2
    assert len(embeddings[0]) == 384
    # Check unit vector normalization
    magnitude = sum(x * x for x in embeddings[0]) ** 0.5
    assert pytest.approx(magnitude, abs=1e-4) == 1.0

