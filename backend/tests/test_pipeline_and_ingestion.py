"""Pipeline orchestration and media ingestion integration tests."""
import io
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.meeting import Meeting, ProcessingStatus
from app.models.transcript import TranscriptSegment, Speaker
from app.models.intelligence import MeetingSummary, ShortTranscript, Decision, ActionItem
from app.models.knowledge import KnowledgeChunk
from app.services.pipeline_service import PipelineService
from tests.conftest import TestAsyncSessionLocal


@pytest.mark.asyncio
async def test_full_pipeline_execution(client: AsyncClient, db_session: AsyncSession):
    """Test full background pipeline execution generating all 3 deliverables and indexing."""
    # 1. Setup Organization and Workspace
    org_resp = await client.post("/api/organizations", json={"name": "Alpha Corp", "slug": "alpha-corp"})
    org_id = org_resp.json()["id"]

    ws_resp = await client.get(f"/api/organizations/{org_id}/workspaces")
    ws_id = ws_resp.json()[0]["id"]

    # 2. Upload Mock Audio File
    file_content = b"FAKE_AUDIO_BYTES_FOR_TESTING"
    files = {"file": ("test_meeting.wav", io.BytesIO(file_content), "audio/wav")}
    data = {
        "organization_id": org_id,
        "workspace_id": ws_id,
        "title": "Alpha Sprint Retrospective"
    }

    upload_resp = await client.post("/api/meetings/upload", data=data, files=files)
    assert upload_resp.status_code == 201
    meeting = upload_resp.json()
    meeting_id = meeting["id"]
    assert meeting["status"] == "UPLOADED"

    # 3. Execute pipeline synchronously in test
    pipeline = PipelineService(session_factory=TestAsyncSessionLocal)
    success = await pipeline.run_pipeline(meeting_id)
    assert success is True

    # 4. Verify Meeting Status is COMPLETED
    stmt = select(Meeting).where(Meeting.id == meeting_id)
    res = await db_session.execute(stmt)
    updated_meeting = res.scalar_one()
    assert updated_meeting.status == ProcessingStatus.COMPLETED

    # 5. Verify Deliverable 1: Full Transcript Segments & Speakers
    seg_stmt = select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id)
    seg_res = await db_session.execute(seg_stmt)
    segments = list(seg_res.scalars().all())
    assert len(segments) >= 5
    assert segments[0].start_time == 0.0

    spk_stmt = select(Speaker).where(Speaker.meeting_id == meeting_id)
    spk_res = await db_session.execute(spk_stmt)
    speakers = list(spk_res.scalars().all())
    assert len(speakers) >= 2

    # 6. Verify Deliverable 2: Short Transcript (Chronological Narrative)
    short_stmt = select(ShortTranscript).where(ShortTranscript.meeting_id == meeting_id)
    short_res = await db_session.execute(short_stmt)
    short_transcript = short_res.scalar_one()
    assert "SPEAKER_00" in short_transcript.narrative_text
    assert len(short_transcript.chronological_events) >= 5

    # 7. Verify Deliverable 3: Structured Summary, Decisions, Action Items
    sum_stmt = select(MeetingSummary).where(MeetingSummary.meeting_id == meeting_id)
    sum_res = await db_session.execute(sum_stmt)
    summary = sum_res.scalar_one()
    assert len(summary.executive_summary) > 20
    assert len(summary.key_points) >= 3

    dec_stmt = select(Decision).where(Decision.meeting_id == meeting_id)
    dec_res = await db_session.execute(dec_stmt)
    decisions = list(dec_res.scalars().all())
    assert len(decisions) >= 1
    assert decisions[0].evidence_timestamp is not None

    act_stmt = select(ActionItem).where(ActionItem.meeting_id == meeting_id)
    act_res = await db_session.execute(act_stmt)
    action_items = list(act_res.scalars().all())
    assert len(action_items) >= 1
    assert action_items[0].owner_name == "SPEAKER_01"

    # 8. Verify Knowledge Chunks were created and indexed
    chunk_stmt = select(KnowledgeChunk).where(KnowledgeChunk.meeting_id == meeting_id)
    chunk_res = await db_session.execute(chunk_stmt)
    chunks = list(chunk_res.scalars().all())
    assert len(chunks) >= 4
