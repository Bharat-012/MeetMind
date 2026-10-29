"""Organization-level Speaker Directory and Participant Management APIs."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, distinct, delete
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.organization import Organization, AuditLog
from app.models.meeting import Meeting
from app.models.transcript import MeetingParticipant, Speaker, SpeakerAssignment, TranscriptSegment
from app.schemas.transcript import (
    ParticipantCreate,
    ParticipantUpdate,
    ParticipantRead,
    MeetingAppearanceRead,
    ParticipantHistoryRead,
    TranscriptSegmentRead,
)

router = APIRouter(prefix="/organizations/{organization_id}/speakers", tags=["Speaker Directory"])


async def _verify_org_exists(organization_id: str, db: AsyncSession) -> Organization:
    """Ensure organization exists, raising 404 if missing."""
    stmt = select(Organization).where(Organization.id == organization_id)
    res = await db.execute(stmt)
    org = res.scalar_one_or_none()
    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Organization '{organization_id}' not found."
        )
    return org


async def _get_participant_stats(participant_id: str, db: AsyncSession) -> tuple[int, float]:
    """Calculate total meetings attended and total speaking duration in seconds."""
    # Count distinct meetings where this participant was assigned
    meeting_stmt = (
        select(func.count(distinct(Speaker.meeting_id)))
        .where(Speaker.participant_id == participant_id)
    )
    meeting_res = await db.execute(meeting_stmt)
    total_meetings = meeting_res.scalar() or 0

    # Sum duration of segments where speaker.participant_id == participant_id
    seg_stmt = (
        select(func.sum(TranscriptSegment.end_time - TranscriptSegment.start_time))
        .join(Speaker, TranscriptSegment.speaker_id == Speaker.id)
        .where(Speaker.participant_id == participant_id)
    )
    seg_res = await db.execute(seg_stmt)
    total_duration = seg_res.scalar() or 0.0

    return int(total_meetings), round(float(total_duration), 2)


@router.post("", response_model=ParticipantRead, status_code=status.HTTP_201_CREATED)
async def create_speaker_profile(
    organization_id: str,
    payload: ParticipantCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new organization-scoped speaker/participant profile."""
    await _verify_org_exists(organization_id, db)

    # Check for duplicate name in the same organization
    dup_stmt = select(MeetingParticipant).where(
        MeetingParticipant.organization_id == organization_id,
        MeetingParticipant.name == payload.name
    )
    dup_res = await db.execute(dup_stmt)
    if dup_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"A speaker profile with name '{payload.name}' already exists in this organization."
        )

    profile = MeetingParticipant(
        organization_id=organization_id,
        name=payload.name.strip(),
        email=payload.email.strip() if payload.email else None,
        description=payload.description.strip() if payload.description else None,
        avatar_url=payload.avatar_url
    )
    db.add(profile)
    await db.flush()
    await db.refresh(profile)

    # Audit log
    audit = AuditLog(
        organization_id=organization_id,
        action="CREATE_SPEAKER_PROFILE",
        resource_type="meeting_participant",
        resource_id=profile.id,
        details={"name": profile.name, "email": profile.email}
    )
    db.add(audit)
    await db.commit()
    await db.refresh(profile)

    return ParticipantRead(
        id=profile.id,
        organization_id=profile.organization_id,
        name=profile.name,
        email=profile.email,
        description=profile.description,
        avatar_url=profile.avatar_url,
        total_meetings=0,
        total_talk_time_seconds=0.0,
        created_at=profile.created_at,
        updated_at=profile.updated_at
    )


@router.get("", response_model=List[ParticipantRead])
async def list_speaker_profiles(
    organization_id: str,
    q: Optional[str] = Query(None, description="Search by name, email, or description"),
    db: AsyncSession = Depends(get_db)
):
    """List all speaker profiles in an organization with participation statistics."""
    await _verify_org_exists(organization_id, db)

    query = select(MeetingParticipant).where(MeetingParticipant.organization_id == organization_id)
    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        query = query.where(
            (MeetingParticipant.name.ilike(search_pattern)) |
            (MeetingParticipant.email.ilike(search_pattern)) |
            (MeetingParticipant.description.ilike(search_pattern))
        )

    query = query.order_by(MeetingParticipant.name.asc())
    result = await db.execute(query)
    participants = list(result.scalars().all())

    # Calculate stats for each speaker
    output: List[ParticipantRead] = []
    for p in participants:
        total_meetings, total_duration = await _get_participant_stats(p.id, db)
        output.append(
            ParticipantRead(
                id=p.id,
                organization_id=p.organization_id,
                name=p.name,
                email=p.email,
                description=p.description,
                avatar_url=p.avatar_url,
                total_meetings=total_meetings,
                total_talk_time_seconds=total_duration,
                created_at=p.created_at,
                updated_at=p.updated_at
            )
        )

    return output


@router.get("/{participant_id}", response_model=ParticipantRead)
async def get_speaker_profile(
    organization_id: str,
    participant_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve details and statistics for a specific speaker profile."""
    await _verify_org_exists(organization_id, db)

    stmt = select(MeetingParticipant).where(
        MeetingParticipant.id == participant_id,
        MeetingParticipant.organization_id == organization_id
    )
    result = await db.execute(stmt)
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Speaker profile '{participant_id}' not found in this organization."
        )

    total_meetings, total_duration = await _get_participant_stats(p.id, db)
    return ParticipantRead(
        id=p.id,
        organization_id=p.organization_id,
        name=p.name,
        email=p.email,
        description=p.description,
        avatar_url=p.avatar_url,
        total_meetings=total_meetings,
        total_talk_time_seconds=total_duration,
        created_at=p.created_at,
        updated_at=p.updated_at
    )


@router.patch("/{participant_id}", response_model=ParticipantRead)
async def update_speaker_profile(
    organization_id: str,
    participant_id: str,
    payload: ParticipantUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update an existing speaker profile."""
    await _verify_org_exists(organization_id, db)

    stmt = select(MeetingParticipant).where(
        MeetingParticipant.id == participant_id,
        MeetingParticipant.organization_id == organization_id
    )
    result = await db.execute(stmt)
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Speaker profile '{participant_id}' not found."
        )

    prev_name = p.name
    if payload.name is not None and payload.name.strip():
        # Check duplicate name if changing
        if payload.name.strip() != p.name:
            dup_stmt = select(MeetingParticipant).where(
                MeetingParticipant.organization_id == organization_id,
                MeetingParticipant.name == payload.name.strip()
            )
            dup_res = await db.execute(dup_stmt)
            if dup_res.scalar_one_or_none():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Another speaker profile with name '{payload.name}' already exists."
                )
        p.name = payload.name.strip()

    if payload.email is not None:
        p.email = payload.email.strip() if payload.email.strip() else None
    if payload.description is not None:
        p.description = payload.description.strip() if payload.description.strip() else None
    if payload.avatar_url is not None:
        p.avatar_url = payload.avatar_url

    # Update confirmed_name in linked speakers if name changed
    if payload.name and payload.name.strip() != prev_name:
        linked_spks = await db.execute(select(Speaker).where(Speaker.participant_id == p.id))
        for spk in linked_spks.scalars().all():
            spk.confirmed_name = p.name

    audit = AuditLog(
        organization_id=organization_id,
        action="UPDATE_SPEAKER_PROFILE",
        resource_type="meeting_participant",
        resource_id=p.id,
        details={"previous_name": prev_name, "updated_name": p.name}
    )
    db.add(audit)
    await db.commit()
    await db.refresh(p)

    total_meetings, total_duration = await _get_participant_stats(p.id, db)
    return ParticipantRead(
        id=p.id,
        organization_id=p.organization_id,
        name=p.name,
        email=p.email,
        description=p.description,
        avatar_url=p.avatar_url,
        total_meetings=total_meetings,
        total_talk_time_seconds=total_duration,
        created_at=p.created_at,
        updated_at=p.updated_at
    )


@router.delete("/{participant_id}", status_code=status.HTTP_200_OK)
async def delete_speaker_profile(
    organization_id: str,
    participant_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a speaker profile and unlink from meetings (preserves original meeting speaker labels)."""
    await _verify_org_exists(organization_id, db)

    stmt = select(MeetingParticipant).where(
        MeetingParticipant.id == participant_id,
        MeetingParticipant.organization_id == organization_id
    )
    result = await db.execute(stmt)
    p = result.scalar_one_or_none()
    if not p:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Speaker profile '{participant_id}' not found."
        )

    # Unlink any meetings' speakers pointing to this participant
    spk_stmt = select(Speaker).where(Speaker.participant_id == participant_id)
    spk_res = await db.execute(spk_stmt)
    for spk in spk_res.scalars().all():
        spk.participant_id = None
        spk.is_confirmed = False

    audit = AuditLog(
        organization_id=organization_id,
        action="DELETE_SPEAKER_PROFILE",
        resource_type="meeting_participant",
        resource_id=participant_id,
        details={"deleted_name": p.name}
    )
    db.add(audit)
    await db.delete(p)
    await db.commit()

    return {"deleted": True, "id": participant_id, "name": p.name}


@router.get("/{participant_id}/meetings", response_model=List[MeetingAppearanceRead])
async def list_speaker_meetings(
    organization_id: str,
    participant_id: str,
    db: AsyncSession = Depends(get_db)
):
    """List all meetings in which this speaker has appeared."""
    await _verify_org_exists(organization_id, db)

    spk_stmt = (
        select(Speaker, Meeting)
        .join(Meeting, Speaker.meeting_id == Meeting.id)
        .where(
            Speaker.participant_id == participant_id,
            Meeting.organization_id == organization_id
        )
        .order_by(Meeting.created_at.desc())
    )
    res = await db.execute(spk_stmt)
    rows = list(res.all())

    appearances: List[MeetingAppearanceRead] = []
    for spk, meeting in rows:
        # Calculate segments and talk time for this meeting
        stats_stmt = (
            select(
                func.count(TranscriptSegment.id),
                func.sum(TranscriptSegment.end_time - TranscriptSegment.start_time)
            )
            .where(TranscriptSegment.speaker_id == spk.id)
        )
        stats_res = await db.execute(stats_stmt)
        seg_count, talk_time = stats_res.one()

        appearances.append(
            MeetingAppearanceRead(
                meeting_id=meeting.id,
                meeting_title=meeting.title,
                speaker_id=spk.id,
                speaker_label=spk.speaker_label,
                segment_count=int(seg_count or 0),
                talk_time_seconds=round(float(talk_time or 0.0), 2),
                meeting_created_at=meeting.created_at
            )
        )

    return appearances


@router.get("/{participant_id}/history", response_model=ParticipantHistoryRead)
async def get_speaker_history(
    organization_id: str,
    participant_id: str,
    limit_segments: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve full participation history, meetings attended, and recent transcript segments."""
    await _verify_org_exists(organization_id, db)

    # 1. Profile
    p_stmt = select(MeetingParticipant).where(
        MeetingParticipant.id == participant_id,
        MeetingParticipant.organization_id == organization_id
    )
    p_res = await db.execute(p_stmt)
    p = p_res.scalar_one_or_none()
    if not p:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Speaker profile '{participant_id}' not found."
        )

    total_meetings, total_duration = await _get_participant_stats(p.id, db)
    participant_read = ParticipantRead(
        id=p.id,
        organization_id=p.organization_id,
        name=p.name,
        email=p.email,
        description=p.description,
        avatar_url=p.avatar_url,
        total_meetings=total_meetings,
        total_talk_time_seconds=total_duration,
        created_at=p.created_at,
        updated_at=p.updated_at
    )

    # 2. Meetings appearances
    appearances = await list_speaker_meetings(organization_id, participant_id, db)

    # 3. Recent transcript segments spoken by this participant
    seg_stmt = (
        select(TranscriptSegment, Speaker.speaker_label, Speaker.confirmed_name, Speaker.is_confirmed)
        .join(Speaker, TranscriptSegment.speaker_id == Speaker.id)
        .join(Meeting, TranscriptSegment.meeting_id == Meeting.id)
        .where(
            Speaker.participant_id == participant_id,
            Meeting.organization_id == organization_id
        )
        .order_by(TranscriptSegment.created_at.desc(), TranscriptSegment.start_time.asc())
        .limit(limit_segments)
    )
    seg_res = await db.execute(seg_stmt)
    seg_rows = list(seg_res.all())

    recent_segments: List[TranscriptSegmentRead] = []
    for seg, spk_label, conf_name, is_conf in seg_rows:
        recent_segments.append(
            TranscriptSegmentRead(
                id=seg.id,
                meeting_id=seg.meeting_id,
                speaker_id=seg.speaker_id,
                speaker_label=spk_label,
                speaker_name=conf_name or spk_label,
                is_confirmed=is_conf,
                start_time=seg.start_time,
                end_time=seg.end_time,
                text=seg.text,
                confidence=seg.confidence,
                words=seg.words
            )
        )

    return ParticipantHistoryRead(
        participant=participant_read,
        appearances=appearances,
        recent_segments=recent_segments
    )

