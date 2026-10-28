"""Meeting endpoints for creation, retrieval, and deliverables."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.meeting import Meeting, ProcessingStatus, SourceType
from app.models.transcript import TranscriptSegment, Speaker
from app.models.intelligence import (
    MeetingSummary,
    ShortTranscript,
    Decision,
    ActionItem,
    ActionItemStatus
)
from app.schemas.meeting import (
    MeetingCreate,
    MeetingRead,
    MeetingListResponse,
    ProcessingStatusResponse
)
from app.schemas.transcript import (
    TranscriptSegmentRead,
    SpeakerRead,
    SpeakerUpdateRequest,
    FullTranscriptResponse
)
from app.schemas.intelligence import (
    MeetingSummaryRead,
    ShortTranscriptRead,
    DecisionRead,
    ActionItemRead,
    ActionItemStatusUpdate
)

router = APIRouter(prefix="/meetings", tags=["Meetings"])


@router.post("", response_model=MeetingRead, status_code=status.HTTP_201_CREATED)
async def create_meeting(payload: MeetingCreate, db: AsyncSession = Depends(get_db)):
    """Create a new meeting record."""
    meeting = Meeting(
        organization_id=payload.organization_id,
        workspace_id=payload.workspace_id,
        project_id=payload.project_id,
        title=payload.title,
        description=payload.description,
        source_type=payload.source_type,
        status=ProcessingStatus.UPLOADED
    )
    db.add(meeting)
    await db.flush()
    await db.refresh(meeting)
    return meeting


@router.get("", response_model=MeetingListResponse)
async def list_meetings(
    organization_id: str = Query(..., description="Organization ID filter"),
    workspace_id: Optional[str] = Query(None, description="Workspace ID filter"),
    status: Optional[ProcessingStatus] = Query(None, description="Processing status filter"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """List meetings with multi-tenant filtering."""
    query = select(Meeting).where(Meeting.organization_id == organization_id)
    if workspace_id:
        query = query.where(Meeting.workspace_id == workspace_id)
    if status:
        query = query.where(Meeting.status == status)

    query = query.order_by(Meeting.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    items = list(result.scalars().all())

    return MeetingListResponse(items=items, total=len(items))


@router.get("/{meeting_id}", response_model=MeetingRead)
async def get_meeting(meeting_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve meeting metadata."""
    stmt = select(Meeting).where(Meeting.id == meeting_id)
    result = await db.execute(stmt)
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    return meeting


@router.get("/{meeting_id}/status", response_model=ProcessingStatusResponse)
async def get_meeting_status(meeting_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve current processing status and progress."""
    stmt = select(Meeting).where(Meeting.id == meeting_id)
    result = await db.execute(stmt)
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    progress = 100 if meeting.status == ProcessingStatus.COMPLETED else 50
    return ProcessingStatusResponse(
        meeting_id=meeting.id,
        status=meeting.status,
        progress_percent=progress,
        stage=meeting.status,
        error_details=meeting.error_message
    )


@router.get("/{meeting_id}/transcript", response_model=FullTranscriptResponse)
async def get_full_transcript(meeting_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve full timestamped transcript segments and speakers."""
    stmt = select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id).order_by(TranscriptSegment.start_time.asc())
    res = await db.execute(stmt)
    segments = list(res.scalars().all())

    spk_stmt = select(Speaker).where(Speaker.meeting_id == meeting_id)
    spk_res = await db.execute(spk_stmt)
    speakers = list(spk_res.scalars().all())

    return FullTranscriptResponse(
        meeting_id=meeting_id,
        segments=segments,
        speakers=speakers
    )


@router.get("/{meeting_id}/summary", response_model=MeetingSummaryRead)
async def get_meeting_summary(meeting_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve structured meeting summary."""
    stmt = select(MeetingSummary).where(MeetingSummary.meeting_id == meeting_id)
    result = await db.execute(stmt)
    summary = result.scalar_one_or_none()
    if not summary:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Summary not yet available")
    return summary


@router.get("/{meeting_id}/short-transcript", response_model=ShortTranscriptRead)
async def get_short_transcript(meeting_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve concise chronological explanation."""
    stmt = select(ShortTranscript).where(ShortTranscript.meeting_id == meeting_id)
    result = await db.execute(stmt)
    short_transcript = result.scalar_one_or_none()
    if not short_transcript:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Short transcript not yet available")
    return short_transcript


@router.get("/{meeting_id}/decisions", response_model=List[DecisionRead])
async def list_meeting_decisions(meeting_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve extracted decisions."""
    stmt = select(Decision).where(Decision.meeting_id == meeting_id).order_by(Decision.created_at.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{meeting_id}/action-items", response_model=List[ActionItemRead])
async def list_meeting_action_items(meeting_id: str, db: AsyncSession = Depends(get_db)):
    """Retrieve extracted action items."""
    stmt = select(ActionItem).where(ActionItem.meeting_id == meeting_id).order_by(ActionItem.created_at.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.patch("/{meeting_id}/speakers/{speaker_id}", response_model=SpeakerRead)
async def update_speaker(
    meeting_id: str,
    speaker_id: str,
    payload: SpeakerUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Map or update a speaker's confirmed display name."""
    stmt = select(Speaker).where(Speaker.meeting_id == meeting_id, Speaker.id == speaker_id)
    result = await db.execute(stmt)
    speaker = result.scalar_one_or_none()
    if not speaker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Speaker not found")

    speaker.confirmed_name = payload.confirmed_name
    if payload.participant_id:
        speaker.participant_id = payload.participant_id

    await db.flush()
    await db.refresh(speaker)
    return speaker


@router.patch("/{meeting_id}/action-items/{action_item_id}", response_model=ActionItemRead)
async def update_action_item_status(
    meeting_id: str,
    action_item_id: str,
    payload: ActionItemStatusUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update an action item's status (e.g. COMPLETED, IN_PROGRESS)."""
    stmt = select(ActionItem).where(ActionItem.meeting_id == meeting_id, ActionItem.id == action_item_id)
    result = await db.execute(stmt)
    action_item = result.scalar_one_or_none()
    if not action_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Action item not found")

    action_item.status = payload.status
    await db.flush()
    await db.refresh(action_item)
    return action_item

