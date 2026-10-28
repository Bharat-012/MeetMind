"""Database schema and relational model tests."""
import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.organization import Organization, Workspace
from app.models.meeting import Meeting, ProcessingStatus, SourceType
from app.models.intelligence import MeetingSummary, Decision, ActionItem, Priority, ActionItemStatus


@pytest.mark.asyncio
async def test_organization_and_workspace_lifecycle(db_session: AsyncSession):
    """Verify organization and workspace relationships and constraints."""
    org = Organization(name="Acme Corp", slug="acme")
    db_session.add(org)
    await db_session.commit()
    await db_session.refresh(org)

    assert org.id is not None
    assert org.slug == "acme"

    ws = Workspace(organization_id=org.id, name="Engineering", description="Core dev team")
    db_session.add(ws)
    await db_session.commit()
    await db_session.refresh(ws)

    assert ws.id is not None
    assert ws.organization_id == org.id


@pytest.mark.asyncio
async def test_meeting_and_intelligence_models(db_session: AsyncSession):
    """Verify meeting persistence with summary, decisions, and action items."""
    org = Organization(name="Tech Innovators", slug="tech-inno")
    db_session.add(org)
    await db_session.flush()

    ws = Workspace(organization_id=org.id, name="Sprint Planning")
    db_session.add(ws)
    await db_session.flush()

    meeting = Meeting(
        organization_id=org.id,
        workspace_id=ws.id,
        title="Q4 Architecture Review",
        source_type=SourceType.UPLOAD,
        status=ProcessingStatus.COMPLETED
    )
    db_session.add(meeting)
    await db_session.flush()

    # Add summary
    summary = MeetingSummary(
        meeting_id=meeting.id,
        executive_summary="Team agreed to migrate DB to Postgres with pgvector.",
        key_points=["Latency cut by 40%"],
        risks=["Replication lag"],
        open_questions=["Rollback SLA"],
        next_steps=["Runbook by Friday"]
    )
    db_session.add(summary)

    # Add decision
    decision = Decision(
        meeting_id=meeting.id,
        title="Postgres Cutover",
        decision_text="Migrate to Postgres next month",
        responsible_person="Alice",
        evidence_timestamp=59.0
    )
    db_session.add(decision)

    # Add action item
    action_item = ActionItem(
        meeting_id=meeting.id,
        task_description="Deliver runbook by Friday",
        owner_name="Alice",
        priority=Priority.HIGH,
        status=ActionItemStatus.OPEN,
        evidence_timestamp=43.0
    )
    db_session.add(action_item)
    await db_session.commit()

    # Query back
    stmt = select(Meeting).where(Meeting.id == meeting.id)
    res = await db_session.execute(stmt)
    retrieved = res.scalar_one()

    assert retrieved.title == "Q4 Architecture Review"
    assert retrieved.status == ProcessingStatus.COMPLETED

