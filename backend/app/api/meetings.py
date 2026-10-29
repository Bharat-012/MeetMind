"""Meeting endpoints for creation, retrieval, and deliverables."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.meeting import Meeting, ProcessingStatus, SourceType
from app.models.organization import AuditLog
from app.models.transcript import TranscriptSegment, Speaker, SpeakerAssignment, MeetingParticipant
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
    SpeakerStatsRead,
    SpeakerAssignmentAuditRead,
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
    await db.commit()
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
    """Retrieve full timestamped transcript segments and speakers with attribution data."""
    # 1. Fetch speakers for meeting
    spk_stmt = select(Speaker).where(Speaker.meeting_id == meeting_id)
    spk_res = await db.execute(spk_stmt)
    speakers = list(spk_res.scalars().all())
    speaker_dict = {s.id: s for s in speakers}

    # 2. Fetch segments
    stmt = select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id).order_by(TranscriptSegment.start_time.asc())
    res = await db.execute(stmt)
    segments = list(res.scalars().all())

    # Calculate speech duration per speaker
    speaker_duration: dict[str, float] = {}
    speaker_seg_count: dict[str, int] = {}
    total_speech_duration = 0.0

    enhanced_segments: List[TranscriptSegmentRead] = []
    for seg in segments:
        dur = max(0.0, seg.end_time - seg.start_time)
        total_speech_duration += dur
        spk = speaker_dict.get(seg.speaker_id) if seg.speaker_id else None

        spk_label = spk.speaker_label if spk else None
        spk_name = (spk.confirmed_name or spk.speaker_label) if spk else "Unassigned"
        is_conf = spk.is_confirmed if spk else False

        if spk:
            speaker_duration[spk.id] = speaker_duration.get(spk.id, 0.0) + dur
            speaker_seg_count[spk.id] = speaker_seg_count.get(spk.id, 0) + 1

        enhanced_segments.append(
            TranscriptSegmentRead(
                id=seg.id,
                meeting_id=seg.meeting_id,
                speaker_id=seg.speaker_id,
                speaker_label=spk_label,
                speaker_name=spk_name,
                is_confirmed=is_conf,
                start_time=seg.start_time,
                end_time=seg.end_time,
                text=seg.text,
                confidence=seg.confidence,
                words=seg.words
            )
        )

    # Enrich speakers with talk time stats
    enhanced_speakers: List[SpeakerRead] = []
    for s in speakers:
        talk_time = round(speaker_duration.get(s.id, 0.0), 2)
        count = speaker_seg_count.get(s.id, 0)
        pct = round((talk_time / total_speech_duration * 100.0), 1) if total_speech_duration > 0 else 0.0
        enhanced_speakers.append(
            SpeakerRead(
                id=s.id,
                meeting_id=s.meeting_id,
                speaker_label=s.speaker_label,
                confirmed_name=s.confirmed_name,
                is_confirmed=s.is_confirmed,
                participant_id=s.participant_id,
                total_talk_time_seconds=talk_time,
                segment_count=count,
                talk_time_percentage=pct
            )
        )

    return FullTranscriptResponse(
        meeting_id=meeting_id,
        segments=enhanced_segments,
        speakers=enhanced_speakers
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
    """Assign or correct a speaker's confirmed display name and profile with audit logging."""
    meeting_stmt = select(Meeting).where(Meeting.id == meeting_id)
    m_res = await db.execute(meeting_stmt)
    meeting = m_res.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    stmt = select(Speaker).where(Speaker.meeting_id == meeting_id, Speaker.id == speaker_id)
    result = await db.execute(stmt)
    speaker = result.scalar_one_or_none()
    if not speaker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Speaker not found")

    prev_name = speaker.confirmed_name
    prev_participant_id = speaker.participant_id

    # If participant_id is provided, verify it belongs to the same organization
    if payload.participant_id:
        p_stmt = select(MeetingParticipant).where(
            MeetingParticipant.id == payload.participant_id,
            MeetingParticipant.organization_id == meeting.organization_id
        )
        p_res = await db.execute(p_stmt)
        participant = p_res.scalar_one_or_none()
        if not participant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected participant profile belongs to a different organization or does not exist."
            )
        speaker.participant_id = participant.id
        speaker.confirmed_name = payload.confirmed_name.strip() if payload.confirmed_name else participant.name
    else:
        speaker.confirmed_name = payload.confirmed_name.strip()

    speaker.is_confirmed = True

    # Manage SpeakerAssignment record
    if speaker.participant_id:
        assign_stmt = select(SpeakerAssignment).where(SpeakerAssignment.speaker_id == speaker.id)
        assign_res = await db.execute(assign_stmt)
        assignment = assign_res.scalar_one_or_none()
        if assignment:
            assignment.participant_id = speaker.participant_id
            assignment.assigned_by_user_id = payload.user_id
            assignment.notes = payload.notes
        else:
            db.add(SpeakerAssignment(
                speaker_id=speaker.id,
                participant_id=speaker.participant_id,
                assigned_by_user_id=payload.user_id,
                notes=payload.notes,
                assignment_source="MANUAL_CONFIRMED"
            ))

    # Record AuditLog entry
    action_type = "CORRECT_SPEAKER_ASSIGNMENT" if prev_name else "ASSIGN_SPEAKER"
    audit = AuditLog(
        organization_id=meeting.organization_id,
        user_id=payload.user_id,
        action=action_type,
        resource_type="speaker",
        resource_id=speaker.id,
        details={
            "meeting_id": meeting_id,
            "speaker_label": speaker.speaker_label,
            "previous_name": prev_name,
            "new_name": speaker.confirmed_name,
            "previous_participant_id": prev_participant_id,
            "new_participant_id": speaker.participant_id,
            "notes": payload.notes
        }
    )
    db.add(audit)
    await db.commit()
    await db.refresh(speaker)

    return SpeakerRead(
        id=speaker.id,
        meeting_id=speaker.meeting_id,
        speaker_label=speaker.speaker_label,
        confirmed_name=speaker.confirmed_name,
        is_confirmed=speaker.is_confirmed,
        participant_id=speaker.participant_id
    )


@router.post("/{meeting_id}/speakers/{speaker_id}/unassign", response_model=SpeakerRead)
async def unassign_speaker(
    meeting_id: str,
    speaker_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Revert a speaker assignment back to anonymous unassigned state."""
    meeting_stmt = select(Meeting).where(Meeting.id == meeting_id)
    m_res = await db.execute(meeting_stmt)
    meeting = m_res.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    stmt = select(Speaker).where(Speaker.meeting_id == meeting_id, Speaker.id == speaker_id)
    result = await db.execute(stmt)
    speaker = result.scalar_one_or_none()
    if not speaker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Speaker not found")

    prev_name = speaker.confirmed_name
    prev_participant_id = speaker.participant_id

    speaker.confirmed_name = None
    speaker.participant_id = None
    speaker.is_confirmed = False

    # Remove any SpeakerAssignment
    await db.execute(delete(SpeakerAssignment).where(SpeakerAssignment.speaker_id == speaker.id))

    audit = AuditLog(
        organization_id=meeting.organization_id,
        action="UNASSIGN_SPEAKER",
        resource_type="speaker",
        resource_id=speaker.id,
        details={
            "meeting_id": meeting_id,
            "speaker_label": speaker.speaker_label,
            "previous_name": prev_name,
            "previous_participant_id": prev_participant_id
        }
    )
    db.add(audit)
    await db.commit()
    await db.refresh(speaker)

    return SpeakerRead(
        id=speaker.id,
        meeting_id=speaker.meeting_id,
        speaker_label=speaker.speaker_label,
        confirmed_name=None,
        is_confirmed=False,
        participant_id=None
    )


@router.get("/{meeting_id}/speakers/{speaker_id}/audit-history", response_model=List[SpeakerAssignmentAuditRead])
async def get_speaker_audit_history(
    meeting_id: str,
    speaker_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve complete audit history of assignments and corrections for a speaker."""
    stmt = (
        select(AuditLog)
        .where(
            AuditLog.resource_id == speaker_id,
            AuditLog.action.in_(["ASSIGN_SPEAKER", "CORRECT_SPEAKER_ASSIGNMENT", "UNASSIGN_SPEAKER"])
        )
        .order_by(AuditLog.created_at.desc())
    )
    res = await db.execute(stmt)
    logs = list(res.scalars().all())

    history: List[SpeakerAssignmentAuditRead] = []
    for l in logs:
        details = l.details or {}
        history.append(
            SpeakerAssignmentAuditRead(
                id=l.id,
                action=l.action,
                speaker_id=l.resource_id,
                meeting_id=details.get("meeting_id", meeting_id),
                speaker_label=details.get("speaker_label", "Unknown"),
                previous_name=details.get("previous_name"),
                new_name=details.get("new_name"),
                previous_participant_id=details.get("previous_participant_id"),
                new_participant_id=details.get("new_participant_id"),
                assigned_by_user_id=l.user_id,
                notes=details.get("notes"),
                created_at=l.created_at
            )
        )
    return history


@router.get("/{meeting_id}/speakers/stats", response_model=List[SpeakerStatsRead])
async def get_meeting_speaker_stats(
    meeting_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Calculate speaking time, segment count, and talk percentage for each speaker."""
    spk_stmt = select(Speaker).where(Speaker.meeting_id == meeting_id)
    spk_res = await db.execute(spk_stmt)
    speakers = list(spk_res.scalars().all())

    seg_stmt = select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id)
    seg_res = await db.execute(seg_stmt)
    segments = list(seg_res.scalars().all())

    total_speech_sec = sum(max(0.0, s.end_time - s.start_time) for s in segments)

    stats: List[SpeakerStatsRead] = []
    for spk in speakers:
        spk_segs = [s for s in segments if s.speaker_id == spk.id]
        spk_sec = sum(max(0.0, s.end_time - s.start_time) for s in spk_segs)
        pct = round((spk_sec / total_speech_sec * 100.0), 1) if total_speech_sec > 0 else 0.0
        stats.append(
            SpeakerStatsRead(
                speaker_id=spk.id,
                speaker_label=spk.speaker_label,
                display_name=spk.confirmed_name or spk.speaker_label,
                is_confirmed=spk.is_confirmed,
                total_seconds=round(spk_sec, 2),
                segment_count=len(spk_segs),
                percentage=pct
            )
        )
    return sorted(stats, key=lambda x: x.total_seconds, reverse=True)


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
    await db.commit()
    await db.refresh(action_item)
    return action_item
