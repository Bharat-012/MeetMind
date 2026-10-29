"""Media upload, URL ingestion, video streaming, and pipeline execution endpoints."""
import os
import uuid
import urllib.parse
from typing import Optional, Dict, Any
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
from starlette.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.models.meeting import Meeting, MediaAsset, ProcessingStatus, SourceType
from app.models.organization import Workspace
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
    media_service.validate_file(file.filename or "", file.content_type, 0)

    # Ensure valid workspace_id: fallback to default workspace if needed
    ws_stmt = select(Workspace).where(Workspace.id == workspace_id)
    ws_res = await db.execute(ws_stmt)
    if not ws_res.scalar_one_or_none():
        fb_stmt = select(Workspace).where(Workspace.organization_id == organization_id)
        fb_res = await db.execute(fb_stmt)
        fb_ws = fb_res.scalar_one_or_none()
        if fb_ws:
            workspace_id = fb_ws.id

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

    # Save file safely to storage
    file_path, file_size = await media_service.save_uploaded_media(meeting.id, file)

    # Probe media metadata and codecs
    probe = media_service.probe_media(file_path)
    meeting.duration_seconds = probe.get("duration_seconds")

    # Generate web preview proxy if video format is not browser-playable (e.g. MKV, ProRes MOV)
    preview_path = media_service.ensure_web_preview(file_path, meeting.id, probe)
    thumb_path = None
    if probe.get("has_video"):
        thumb_path = media_service.generate_thumbnail(file_path, meeting.id)

    media_metadata = {
        "original_filename": file.filename,
        "has_video": probe.get("has_video", False),
        "has_audio": probe.get("has_audio", True),
        "video_codec": probe.get("video_codec"),
        "audio_codec": probe.get("audio_codec"),
        "width": probe.get("width"),
        "height": probe.get("height"),
        "fps": probe.get("fps"),
        "is_browser_playable": probe.get("is_browser_playable", True),
        "preview_path": preview_path,
        "thumbnail_path": thumb_path,
        "extension": probe.get("extension")
    }

    media_asset = MediaAsset(
        meeting_id=meeting.id,
        file_path=file_path,
        file_size_bytes=file_size,
        mime_type=probe.get("mime_type") or file.content_type or "application/octet-stream",
        media_metadata=media_metadata
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
    """Import online YouTube video URL, download permitted media, and trigger pipeline."""
    # Validate YouTube URL
    video_id = media_service.validate_youtube_url(payload.url)
    canonical_url = f"https://www.youtube.com/watch?v={video_id}"

    # Ensure valid workspace_id: fallback to default workspace if needed
    ws_id = payload.workspace_id
    ws_stmt = select(Workspace).where(Workspace.id == ws_id)
    ws_res = await db.execute(ws_stmt)
    if not ws_res.scalar_one_or_none():
        fb_stmt = select(Workspace).where(Workspace.organization_id == payload.organization_id)
        fb_res = await db.execute(fb_stmt)
        fb_ws = fb_res.scalar_one_or_none()
        if fb_ws:
            ws_id = fb_ws.id

    # Check for duplicate meeting URL within the organization workspace
    dup_stmt = select(Meeting).where(
        Meeting.organization_id == payload.organization_id,
        Meeting.workspace_id == ws_id,
        Meeting.source_url == canonical_url,
        Meeting.status.in_([ProcessingStatus.COMPLETED, ProcessingStatus.TRANSCRIBING, ProcessingStatus.DIARIZING])
    )
    dup_res = await db.execute(dup_stmt)
    existing_meeting = dup_res.scalar_one_or_none()
    if existing_meeting:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This YouTube video has already been ingested in this workspace: '{existing_meeting.title}' (ID: {existing_meeting.id})."
        )

    meeting_title = payload.title or f"YouTube Video ({video_id})"

    meeting = Meeting(
        organization_id=payload.organization_id,
        workspace_id=ws_id,
        project_id=payload.project_id,
        title=meeting_title,
        source_type=SourceType.YOUTUBE,
        source_url=canonical_url,
        status=ProcessingStatus.UPLOADED
    )
    db.add(meeting)
    await db.flush()
    await db.refresh(meeting)

    # Legitimately import metadata and permitted media from YouTube
    url_info = await media_service.import_from_url(canonical_url, meeting.id)

    meeting.title = payload.title or url_info.get("title") or meeting.title
    meeting.duration_seconds = url_info.get("duration")

    media_asset = MediaAsset(
        meeting_id=meeting.id,
        file_path=url_info.get("media_path") or url_info.get("audio_path"),
        audio_path=url_info.get("audio_path"),
        file_size_bytes=url_info.get("file_size_bytes", 0),
        mime_type=url_info.get("mime_type", "video/mp4"),
        media_metadata={
            "source_url": canonical_url,
            "video_id": video_id,
            "title": url_info.get("title"),
            "thumbnail_url": url_info.get("thumbnail_url"),
            "channel": url_info.get("channel"),
            "is_youtube": True,
            "has_video": url_info.get("has_video", False),
            "is_browser_playable": url_info.get("is_browser_playable", True),
            "video_codec": url_info.get("video_codec"),
            "audio_codec": url_info.get("audio_codec")
        }
    )
    db.add(media_asset)
    await db.commit()
    await db.refresh(meeting)

    background_tasks.add_task(pipeline_service.run_pipeline, meeting.id)

    return meeting


@router.get("/{meeting_id}/media")
async def get_meeting_media(
    meeting_id: str,
    original: bool = False,
    db: AsyncSession = Depends(get_db)
):
    """Stream meeting media with HTTP byte-range support (HTTP 206) for video seeking."""
    # 1. Validate UUID format to prevent path traversal
    try:
        uuid.UUID(meeting_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid meeting ID format")

    # 2. Query MediaAsset
    stmt = select(MediaAsset).where(MediaAsset.meeting_id == meeting_id)
    res = await db.execute(stmt)
    asset = res.scalar_one_or_none()
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media asset not found")

    target_file = asset.file_path
    mime_type = asset.mime_type or "application/octet-stream"

    # If web_preview.mp4 exists and original was not requested, serve browser-compatible preview
    meta = asset.media_metadata or {}
    preview_file = meta.get("preview_path")
    if not original and preview_file and os.path.exists(preview_file):
        target_file = preview_file
        mime_type = "video/mp4"

    # Fallback to audio_path if original file_path is missing or not playable
    if (not target_file or not os.path.exists(target_file)) and asset.audio_path and os.path.exists(asset.audio_path):
        target_file = asset.audio_path
        mime_type = "audio/wav"

    if not target_file or not os.path.exists(target_file):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Media file not found on disk")

    # 3. Path traversal defense: ensure target file is strictly inside MEDIA_STORAGE_DIR
    canonical_target = os.path.realpath(target_file)
    canonical_root = os.path.realpath(settings.MEDIA_STORAGE_DIR)
    if not canonical_target.startswith(canonical_root):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied: invalid storage path")

    # 4. Return FileResponse with inline disposition for video/audio streaming (supports Range headers)
    return FileResponse(
        path=canonical_target,
        media_type=mime_type,
        content_disposition_type="inline"
    )


@router.get("/{meeting_id}/media-info")
async def get_meeting_media_info(
    meeting_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieve detailed media capabilities, codecs, and playback support."""
    stmt = select(Meeting).where(Meeting.id == meeting_id)
    res = await db.execute(stmt)
    meeting = res.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")

    asset_stmt = select(MediaAsset).where(MediaAsset.meeting_id == meeting_id)
    asset_res = await db.execute(asset_stmt)
    asset = asset_res.scalar_one_or_none()

    if not asset:
        return {
            "has_media": False,
            "has_video": False,
            "media_url": None,
            "thumbnail_url": None,
            "is_browser_playable": False,
            "duration_seconds": meeting.duration_seconds or 0.0,
            "codec_warning": None
        }

    meta = asset.media_metadata or {}
    has_video = meta.get("has_video", asset.mime_type.startswith("video/"))
    is_playable = meta.get("is_browser_playable", True)
    if meta.get("preview_path") and os.path.exists(meta["preview_path"]):
        is_playable = True  # web_preview.mp4 is browser-playable

    codec_warning = None
    if has_video and not is_playable:
        codec_warning = f"Video format ({meta.get('video_codec', 'unknown')}) may not be directly playable in some browsers. Audio playback is active."

    return {
        "has_media": True,
        "has_video": has_video,
        "mime_type": asset.mime_type,
        "media_url": f"http://localhost:8000/api/meetings/{meeting_id}/media",
        "thumbnail_url": meta.get("thumbnail_url"),
        "duration_seconds": meeting.duration_seconds or meta.get("duration_seconds", 0.0),
        "is_browser_playable": is_playable,
        "video_codec": meta.get("video_codec"),
        "audio_codec": meta.get("audio_codec"),
        "width": meta.get("width"),
        "height": meta.get("height"),
        "codec_warning": codec_warning,
        "is_youtube": meta.get("is_youtube", False),
        "video_id": meta.get("video_id"),
        "channel": meta.get("channel"),
        "source_type": meeting.source_type.value if hasattr(meeting.source_type, "value") else str(meeting.source_type),
        "source_url": meeting.source_url,
        "status": meeting.status.value if hasattr(meeting.status, "value") else str(meeting.status),
        "error_message": meeting.error_message
    }


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
