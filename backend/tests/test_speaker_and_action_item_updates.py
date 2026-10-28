"""Tests for updating speaker display names and action item status."""
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.organization import Organization, Workspace
from app.models.meeting import Meeting, SourceType, ProcessingStatus
from app.models.transcript import Speaker
from app.models.intelligence import ActionItem, Priority, ActionItemStatus


@pytest.mark.asyncio
async def test_update_speaker_and_action_item(client: AsyncClient, db_session: AsyncSession):
    """Test manual speaker renaming and action item status progression."""
    # Create test entities directly in DB
    org = Organization(name="Omni Inc", slug="omni-inc")
    db_session.add(org)
    await db_session.flush()

    ws = Workspace(organization_id=org.id, name="General")
    db_session.add(ws)
    await db_session.flush()

    meeting = Meeting(
        organization_id=org.id,
        workspace_id=ws.id,
        title="Architecture Discussion",
        source_type=SourceType.UPLOAD,
        status=ProcessingStatus.COMPLETED
    )
    db_session.add(meeting)
    await db_session.flush()

    speaker = Speaker(
        meeting_id=meeting.id,
        speaker_label="SPEAKER_00",
        confirmed_name=None
    )
    db_session.add(speaker)

    action_item = ActionItem(
        meeting_id=meeting.id,
        task_description="Setup pgvector extension in Postgres",
        owner_name="Alice",
        priority=Priority.HIGH,
        status=ActionItemStatus.OPEN
    )
    db_session.add(action_item)
    await db_session.commit()

    # 1. Update Speaker name
    patch_speaker_resp = await client.patch(
        f"/api/meetings/{meeting.id}/speakers/{speaker.id}",
        json={"confirmed_name": "Dr. Sarah Chen"}
    )
    assert patch_speaker_resp.status_code == 200
    assert patch_speaker_resp.json()["confirmed_name"] == "Dr. Sarah Chen"

    # 2. Update Action Item status to COMPLETED
    patch_action_resp = await client.patch(
        f"/api/meetings/{meeting.id}/action-items/{action_item.id}",
        json={"status": "COMPLETED", "notes": "Extension enabled in staging"}
    )
    assert patch_action_resp.status_code == 200
    assert patch_action_resp.json()["status"] == "COMPLETED"

