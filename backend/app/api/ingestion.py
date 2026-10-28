"""Media upload, URL ingestion, and pipeline execution endpoints."""
from typing import Optional
from fastapi import (
    APIRouter,
    Depends,
    UploadFile,
    File,
    Form,
    BackgroundTasks,
    HTTPException,
    status
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.meeting import Meeting, MediaAsset, ProcessingStatus, SourceType
from app.schemas.meeting import MeetingRead, URLImportRequest
from app.services.media_service import MediaService
from app.services.pipeline_service import PipelineService

router = APIRouter(prefix="/meetings", tags=["Ingestion"])
media_service = MediaService()
pipeline_service = PipelineService()


@router.post("/upload", response_model=MeetingRead, status_code=status.HTTP_201_CREATED)
async def upload_meeting_media(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    organization_id: str = Form(...),
    workspace_id: str = Form(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    project_id: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db)
):
    """Upload media file and initiate background AI processing pipeline."""
    media_title = title or (file.filename or "Uploaded Meeting").rsplit(".", 1)[0]

    # Create meeting record in UPLOADED state
    meeting = Meeting(
        organization_id=organization_id,
        workspace_id=workspace_id,
        project_id=project_id,
        title=media_title,
        description=description,
        source_type=SourceType.UPLOAD,
        original_filename=file.filename,
        status=ProcessingStatus.UPLOADED
    )
    db.add(meeting)
    await db.flush()
    await db.refresh(meeting)

    # Validate and save file to storage
    file_path, file_size = await media_service.save_uploaded_media(meeting.id, file)

    media_asset = MediaAsset(
        meeting_id=meeting.id,
        file_path=file_path,
        file_size_bytes=file_size,
        mime_type=file.content_type or "application/octet-stream"
    )
    db.add(media_asset)
    await db.commit()
    await db.refresh(meeting)

    # Trigger background pipeline
    background_tasks.add_task(pipeline_service.run_pipeline, meeting.id)

    return meeting


@router.post("/import-url", response_model=MeetingRead, status_code=status.HTTP_201_CREATED)
async def import_media_url(
    payload: URLImportRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Import online video or meeting URL and trigger processing."""
    source_type = SourceType.YOUTUBE if "youtube.com" in payload.url or "youtu.be" in payload.url else SourceType.UPLOAD
    meeting_title = payload.title or f"Imported Media ({payload.url[:40]})"

    meeting = Meeting(
        organization_id=payload.organization_id,
        workspace_id=payload.workspace_id,
        project_id=payload.project_id,
        title=meeting_title,
        source_type=source_type,
        source_url=payload.url,
        status=ProcessingStatus.UPLOADED
    )
    db.add(meeting)
    await db.flush()
    await db.refresh(meeting)

    # Create empty asset placeholder
    media_asset = MediaAsset(
        meeting_id=meeting.id,
        file_path=payload.url,
        file_size_bytes=0,
        mime_type="video/url",
        media_metadata={"source_url": payload.url}
    )
    db.add(media_asset)
    await db.commit()
    await db.refresh(meeting)

    background_tasks.add_task(pipeline_service.run_pipeline, meeting.id)

    return meeting


@router.post("/{meeting_id}/retry", response_model=MeetingRead)
async def retry_processing(
    meeting_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Retry failed processing for a meeting."""
    stmt = select(Meeting).where(Meeting.id == meeting_id)
    res = await db.execute(stmt)
    meeting = res.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    meeting.status = ProcessingStatus.QUEUED
    meeting.error_message = None
    await db.commit()

    background_tasks.add_task(pipeline_service.run_pipeline, meeting.id)
    return meeting
