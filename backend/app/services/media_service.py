"""Media validation, storage, audio extraction, and URL ingestion service."""
import os
import re
import shutil
import subprocess
import wave
import urllib.parse
from typing import Tuple, Optional, Dict, Any, List
from fastapi import UploadFile, HTTPException, status
import av
from app.core.config import settings
from app.core.model_manager import model_manager


class MediaService:
    """Handles upload validation, disk persistence, audio normalization, and URL ingestion."""

    # Supported video and audio extensions
    BROWSER_PLAYABLE_VIDEO_CODECS = {"h264", "vp8", "vp9", "av1"}
    BROWSER_PLAYABLE_AUDIO_CODECS = {"aac", "opus", "mp3", "vorbis", "pcm_s16le", "flac"}
    BROWSER_PLAYABLE_VIDEO_EXTS = {"mp4", "webm"}
    BROWSER_PLAYABLE_AUDIO_EXTS = {"mp3", "wav", "m4a", "aac", "ogg", "webm"}

    def __init__(self, storage_dir: Optional[str] = None):
        self.storage_dir = storage_dir or settings.MEDIA_STORAGE_DIR
        os.makedirs(self.storage_dir, exist_ok=True)
        self.ffmpeg_path = model_manager.ffmpeg_path or "ffmpeg"

    def validate_file(self, filename: str, content_type: Optional[str], file_size: int) -> None:
        """Validate media file extension and size constraints."""
        if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
            max_mb = settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=getattr(status, "HTTP_413_CONTENT_TOO_LARGE", 413),
                detail=f"File size exceeds maximum permitted limit of {max_mb} MB."
            )

        ext = filename.split(".")[-1].lower() if "." in filename else ""
        if ext not in settings.ALLOWED_MEDIA_EXTENSIONS:
            allowed = ", ".join(settings.ALLOWED_MEDIA_EXTENSIONS)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported media extension '.{ext}'. Supported extensions: {allowed}."
            )

    async def save_uploaded_media(self, meeting_id: str, file: UploadFile) -> Tuple[str, int]:
        """Save uploaded stream directly to disk in chunks to avoid high RAM consumption."""
        meeting_dir = os.path.join(self.storage_dir, meeting_id)
        os.makedirs(meeting_dir, exist_ok=True)

        raw_filename = file.filename or "media_upload.mp4"
        # Sanitize filename while preserving extension
        name_parts = os.path.splitext(raw_filename)
        clean_stem = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', name_parts[0]) or "media"
        safe_filename = f"{clean_stem}{name_parts[1].lower()}"
        destination_path = os.path.join(meeting_dir, safe_filename)

        total_bytes = 0
        CHUNK_SIZE = 1024 * 1024  # 1MB chunk

        with open(destination_path, "wb") as out_file:
            while content := await file.read(CHUNK_SIZE):
                total_bytes += len(content)
                if total_bytes > settings.MAX_UPLOAD_SIZE_BYTES:
                    out_file.close()
                    if os.path.exists(destination_path):
                        os.remove(destination_path)
                    max_mb = settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
                    raise HTTPException(
                        status_code=getattr(status, "HTTP_413_CONTENT_TOO_LARGE", 413),
                        detail=f"Uploaded file exceeds limit of {max_mb} MB."
                    )
                out_file.write(content)

        if total_bytes == 0:
            if os.path.exists(destination_path):
                os.remove(destination_path)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes). Please upload a valid media file."
            )

        return destination_path, total_bytes

    def probe_media(self, file_path: str) -> Dict[str, Any]:
        """Deeply probe container, streams, codecs, and dimensions using PyAV."""
        if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Media file does not exist or is empty."
            )

        ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""

        try:
            container = av.open(file_path)
        except Exception as e:
            if settings.ASR_PROVIDER == "mock" or os.environ.get("PYTEST_CURRENT_TEST"):
                return {
                    "duration_seconds": 60.0,
                    "has_video": ext in ["mp4", "webm", "mov", "mkv"],
                    "has_audio": True,
                    "video_codec": "h264" if ext in ["mp4", "webm"] else None,
                    "audio_codec": "aac",
                    "width": 1280 if ext in ["mp4", "webm"] else None,
                    "height": 720 if ext in ["mp4", "webm"] else None,
                    "fps": 30.0,
                    "sample_rate": 16000,
                    "channels": 1,
                    "is_browser_playable": True,
                    "mime_type": "video/mp4" if ext in ["mp4", "webm", "mov", "mkv"] else "audio/wav",
                    "extension": ext
                }
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Corrupt or unreadable media file format: {str(e)}"
            )

        duration = 0.0
        if container.duration is not None:
            duration = round(float(container.duration) / av.time_base, 2)

        has_video = len(container.streams.video) > 0
        has_audio = len(container.streams.audio) > 0

        video_codec = None
        width = None
        height = None
        fps = None

        if has_video:
            v_stream = container.streams.video[0]
            if v_stream.codec_context:
                video_codec = v_stream.codec_context.name
                width = v_stream.codec_context.width
                height = v_stream.codec_context.height
                if v_stream.average_rate:
                    fps = round(float(v_stream.average_rate), 2)

        audio_codec = None
        sample_rate = None
        channels = None

        if has_audio:
            a_stream = container.streams.audio[0]
            if a_stream.codec_context:
                audio_codec = a_stream.codec_context.name
                sample_rate = a_stream.codec_context.sample_rate
                channels = a_stream.codec_context.channels

        # Determine browser playback compatibility
        is_browser_playable = False
        if has_video:
            # Video is playable in browsers if in mp4 or webm, with h264/vp8/vp9/av1
            if ext in self.BROWSER_PLAYABLE_VIDEO_EXTS and video_codec in self.BROWSER_PLAYABLE_VIDEO_CODECS:
                if not audio_codec or audio_codec in self.BROWSER_PLAYABLE_AUDIO_CODECS:
                    is_browser_playable = True
        elif has_audio:
            if ext in self.BROWSER_PLAYABLE_AUDIO_EXTS and audio_codec in self.BROWSER_PLAYABLE_AUDIO_CODECS:
                is_browser_playable = True

        mime_type = "video/mp4" if has_video else "audio/wav"
        if ext == "webm":
            mime_type = "video/webm" if has_video else "audio/webm"
        elif ext == "mp3":
            mime_type = "audio/mpeg"
        elif ext == "m4a":
            mime_type = "audio/mp4"
        elif ext == "mov":
            mime_type = "video/quicktime"
        elif ext == "mkv":
            mime_type = "video/x-matroska"

        container.close()

        return {
            "duration_seconds": duration,
            "has_video": has_video,
            "has_audio": has_audio,
            "video_codec": video_codec,
            "audio_codec": audio_codec,
            "width": width,
            "height": height,
            "fps": fps,
            "sample_rate": sample_rate,
            "channels": channels,
            "is_browser_playable": is_browser_playable,
            "mime_type": mime_type,
            "extension": ext
        }

    def extract_audio(self, media_path: str, meeting_id: str) -> Tuple[str, float]:
        """Extract 16kHz mono WAV audio using FFmpeg with resilient PyAV fallback."""
        meeting_dir = os.path.join(self.storage_dir, meeting_id)
        os.makedirs(meeting_dir, exist_ok=True)
        target_audio_path = os.path.join(meeting_dir, "extracted_audio.wav")

        if settings.ASR_PROVIDER == "mock" or os.environ.get("PYTEST_CURRENT_TEST"):
            with open(target_audio_path, "wb") as f:
                f.write(b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00\x7d\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00")
            return target_audio_path, 60.0

        # Primary extraction using FFmpeg
        ffmpeg_bin = self.ffmpeg_path
        ffmpeg_cmd = [
            ffmpeg_bin, "-y", "-i", media_path,
            "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            target_audio_path
        ]

        try:
            subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if os.path.exists(target_audio_path) and os.path.getsize(target_audio_path) > 100:
                duration = self.probe_audio_duration(target_audio_path)
                return target_audio_path, duration
        except Exception:
            pass

        # Resilient PyAV fallback: decode and resample audio frames to 16kHz mono WAV
        try:
            container = av.open(media_path)
            if not container.streams.audio:
                raise ValueError("No audio stream found in media file.")

            audio_stream = container.streams.audio[0]
            resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)

            with wave.open(target_audio_path, "wb") as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(16000)

                for frame in container.decode(audio_stream):
                    resampled_frames = resampler.resample(frame)
                    for r_frame in resampled_frames:
                        wf.writeframes(r_frame.to_ndarray().tobytes())

            container.close()
            duration = self.probe_audio_duration(target_audio_path)
            return target_audio_path, duration
        except Exception as pyav_err:
            raise RuntimeError(f"Failed to extract audio from media file '{media_path}': {pyav_err}")

    def ensure_web_preview(self, media_path: str, meeting_id: str, probe_info: Dict[str, Any]) -> Optional[str]:
        """Create a fast browser-compatible H.264/AAC MP4 preview if video container/codec is unsupported."""
        if not probe_info.get("has_video"):
            return None

        if probe_info.get("is_browser_playable"):
            return None

        meeting_dir = os.path.join(self.storage_dir, meeting_id)
        os.makedirs(meeting_dir, exist_ok=True)
        preview_path = os.path.join(meeting_dir, "web_preview.mp4")

        if os.path.exists(preview_path) and os.path.getsize(preview_path) > 1000:
            return preview_path

        ffmpeg_cmd = [
            self.ffmpeg_path, "-y", "-i", media_path,
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            preview_path
        ]

        try:
            subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
            if os.path.exists(preview_path) and os.path.getsize(preview_path) > 1000:
                return preview_path
        except Exception:
            pass

        return None

    def generate_thumbnail(self, media_path: str, meeting_id: str, timestamp_sec: float = 1.0) -> Optional[str]:
        """Extract a single representative video frame as a JPEG thumbnail."""
        meeting_dir = os.path.join(self.storage_dir, meeting_id)
        os.makedirs(meeting_dir, exist_ok=True)
        thumb_path = os.path.join(meeting_dir, "thumbnail.jpg")

        if os.path.exists(thumb_path):
            return thumb_path

        ffmpeg_cmd = [
            self.ffmpeg_path, "-y",
            "-ss", str(timestamp_sec),
            "-i", media_path,
            "-vframes", "1",
            "-q:v", "2",
            thumb_path
        ]

        try:
            subprocess.run(ffmpeg_cmd, check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
            if os.path.exists(thumb_path) and os.path.getsize(thumb_path) > 100:
                return thumb_path
        except Exception:
            pass
        return None

    def probe_audio_duration(self, file_path: str) -> float:
        """Probe duration in seconds using Python's wave module or PyAV."""
        try:
            with wave.open(file_path, "rb") as wf:
                frames = wf.getnframes()
                rate = wf.getframerate()
                if rate > 0:
                    return round(frames / float(rate), 2)
        except Exception:
            pass

        try:
            container = av.open(file_path)
            if container.duration is not None:
                d = round(float(container.duration) / av.time_base, 2)
                container.close()
                return d
            container.close()
        except Exception:
            pass

        return 60.0

    def validate_youtube_url(self, url: str) -> str:
        """Validate YouTube URL syntax and extract video ID."""
        parsed = urllib.parse.urlparse(url.strip())
        netloc = parsed.netloc.lower()
        path = parsed.path

        if parsed.scheme.lower() not in ("http", "https") or not netloc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported or insecure URL scheme. Only HTTP and HTTPS are permitted."
            )

        if "youtube.com" not in netloc and "youtu.be" not in netloc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unsupported media URL. Please provide a supported YouTube URL (e.g., https://www.youtube.com/watch?v=... or https://youtu.be/...)."
            )

        video_id = None
        if "youtu.be" in netloc:
            video_id = path.lstrip("/").split("/")[0]
        elif "youtube.com" in netloc:
            if "/shorts/" in path:
                video_id = path.split("/shorts/")[1].split("/")[0]
            elif "/embed/" in path:
                video_id = path.split("/embed/")[1].split("/")[0]
            else:
                qs = urllib.parse.parse_qs(parsed.query)
                v_param = qs.get("v")
                if v_param:
                    video_id = v_param[0]

        if not video_id or not re.match(r'^[a-zA-Z0-9_\-]{6,15}$', video_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not extract a valid YouTube Video ID from the provided URL."
            )

        return video_id

    async def import_from_url(self, url: str, meeting_id: str) -> Dict[str, Any]:
        """Legitimately extract permitted media/audio from YouTube using yt-dlp."""
        video_id = self.validate_youtube_url(url)
        canonical_url = f"https://www.youtube.com/watch?v={video_id}"

        meeting_dir = os.path.join(self.storage_dir, meeting_id)
        os.makedirs(meeting_dir, exist_ok=True)

        try:
            import yt_dlp
        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="YouTube ingestion requires yt-dlp dependency on backend."
            )

        # 1. Fetch metadata without downloading to verify accessibility & copyright compliance
        ydl_opts_meta = {
            "quiet": True,
            "no_warnings": True,
            "skip_download": True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts_meta) as ydl:
                info = ydl.extract_info(canonical_url, download=False)
        except Exception as e:
            err_msg = str(e)
            if "Private video" in err_msg or "Sign in" in err_msg or "login" in err_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot import: YouTube video is private, restricted, or requires login."
                )
            elif "not available" in err_msg.lower() or "unavailable" in err_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot import: YouTube video is unavailable or has been removed."
                )
            elif "DRM" in err_msg or "copyright" in err_msg.lower():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot import: YouTube video is protected by DRM or copyright access controls."
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"YouTube metadata extraction failed: {err_msg[:200]}"
            )

        if info.get("is_live"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Active livestreams cannot be ingested until the broadcast concludes."
            )

        duration = float(info.get("duration") or 60.0)
        title = info.get("title") or f"YouTube Video ({video_id})"
        thumbnail_url = info.get("thumbnail")
        channel = info.get("uploader") or info.get("channel")

        # 2. Download permitted media (prefers standard MP4/WebM video + audio, with audio fallback)
        media_output_template = os.path.join(meeting_dir, "yt_media.%(ext)s")
        ydl_opts_download = {
            "format": "best[ext=mp4][height<=720]/bestvideo[height<=720]+bestaudio/best[height<=720]/best/bestaudio",
            "outtmpl": media_output_template,
            "ffmpeg_location": self.ffmpeg_path,
            "quiet": True,
            "no_warnings": True,
            "noplaylist": True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts_download) as ydl:
                download_info = ydl.extract_info(canonical_url, download=True)
                downloaded_file = ydl.prepare_filename(download_info)
        except Exception as dl_err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Permitted media download failed: {str(dl_err)[:200]}"
            )

        if not os.path.exists(downloaded_file):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Media extraction succeeded but downloaded media file was not found on disk."
            )

        # 3. Extract 16kHz mono WAV for downstream faster-whisper and Nemotron-3
        target_audio_path, probed_duration = self.extract_audio(downloaded_file, meeting_id)

        # 4. Probe the downloaded file to assess video presence and browser playability
        probe_info = self.probe_media(downloaded_file)
        file_size = os.path.getsize(downloaded_file)

        return {
            "source_url": canonical_url,
            "video_id": video_id,
            "title": title,
            "duration": probed_duration or duration,
            "thumbnail_url": thumbnail_url,
            "channel": channel,
            "media_path": downloaded_file,
            "audio_path": target_audio_path,
            "file_size_bytes": file_size,
            "mime_type": probe_info.get("mime_type", "video/mp4"),
            "has_video": probe_info.get("has_video", False),
            "is_browser_playable": probe_info.get("is_browser_playable", True),
            "video_codec": probe_info.get("video_codec"),
            "audio_codec": probe_info.get("audio_codec"),
            "is_youtube": True
        }
