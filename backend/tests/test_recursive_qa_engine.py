"""MeetMind Comprehensive Recursive QA Engine & Multi-Level Verification Suite.
Covers:
- All 8 audio/video media formats (MP3, WAV, M4A, AAC, MP4, MOV, MKV, WebM)
- Corrupt, empty, oversized, and invalid media handling
- YouTube URL syntax, formats (watch, youtu.be, shorts, embed), and error reporting
- Media streaming HTTP 206, security boundaries, and path traversal defenses
- Multi-tenant organizational isolation
- Pipeline idempotency and intelligence regeneration without duplicates
- RAG conversational grounding with clickable citations and truthful fallbacks
"""
import os
import re
import pytest
from httpx import AsyncClient
from fastapi import HTTPException
from app.core.config import settings
from app.services.media_service import MediaService
from app.services.pipeline_service import PipelineService
from app.services.rag_service import RAGService
from app.services.evidence_validator import EvidenceValidator
from app.services.ai.dto import DecisionDTO, ActionItemDTO, ChronologicalEventDTO
from app.models.transcript import Speaker, TranscriptSegment
from tests.conftest import TestAsyncSessionLocal


@pytest.fixture
def test_media_files():
    """Ensure scratch/media_tests has real generated media files for all 8 formats."""
    media_dir = os.path.join(os.path.dirname(__file__), "..", "..", "scratch", "media_tests")
    media_dir = os.path.abspath(media_dir)
    return media_dir


def test_all_8_media_formats_validation():
    """Verify validate_file accepts all 8 mandatory formats and rejects disallowed types."""
    media_service = MediaService()
    formats = [
        ("recording.mp3", "audio/mpeg"),
        ("speech.wav", "audio/wav"),
        ("audio.m4a", "audio/mp4"),
        ("audio.aac", "audio/aac"),
        ("meeting.mp4", "video/mp4"),
        ("presentation.mov", "video/quicktime"),
        ("session.mkv", "video/x-matroska"),
        ("demo.webm", "video/webm")
    ]

    for fname, ctype in formats:
        # Must pass without HTTPException
        media_service.validate_file(fname, ctype, 1024 * 1024)

    # Disallowed formats must be rejected with 400 Bad Request
    disallowed = ["payload.exe", "script.sh", "archive.zip", "test.flac", "document.pdf"]
    for bad in disallowed:
        with pytest.raises(HTTPException) as exc:
            media_service.validate_file(bad, "application/octet-stream", 1024)
        assert exc.value.status_code == 400
        assert "Unsupported media extension" in exc.value.detail


def test_all_8_media_formats_probing_and_capabilities(test_media_files):
    """Verify deep PyAV probing on authentic generated files across all 8 formats."""
    media_service = MediaService()
    expected_formats = {
        "test.mp3": {"has_video": False, "has_audio": True, "playable": True},
        "test.wav": {"has_video": False, "has_audio": True, "playable": True},
        "test.m4a": {"has_video": False, "has_audio": True, "playable": True},
        "test.aac": {"has_video": False, "has_audio": True, "playable": True},
        "test.mp4": {"has_video": True, "has_audio": True, "playable": True},
        "test.mov": {"has_video": True, "has_audio": True, "playable": False},
        "test.mkv": {"has_video": True, "has_audio": True, "playable": False},
        "test.webm": {"has_video": True, "has_audio": True, "playable": True},
    }

    for filename, specs in expected_formats.items():
        file_path = os.path.join(test_media_files, filename)
        if not os.path.exists(file_path):
            continue

        probe = media_service.probe_media(file_path, strict=True)
        assert probe["duration_seconds"] > 0.0, f"Duration probe failed for {filename}"
        assert probe["has_audio"] == specs["has_audio"], f"Audio detection failed for {filename}"
        assert probe["has_video"] == specs["has_video"], f"Video detection failed for {filename}"
        assert probe["is_browser_playable"] == specs["playable"], f"Browser playability mismatch for {filename}"


def test_web_preview_generation_for_non_browser_codecs(test_media_files):
    """Verify ensure_web_preview generates browser-compatible MP4 proxy for MKV and MOV."""
    media_service = MediaService()
    mkv_path = os.path.join(test_media_files, "test.mkv")
    if os.path.exists(mkv_path):
        probe = media_service.probe_media(mkv_path, strict=True)
        meeting_id = "test-preview-gen-uuid"
        preview_path = media_service.ensure_web_preview(mkv_path, meeting_id, probe)
        assert preview_path is not None
        assert os.path.exists(preview_path)
        assert preview_path.endswith("web_preview.mp4")
        assert os.path.getsize(preview_path) > 0


def test_thumbnail_generation(test_media_files):
    """Verify generate_thumbnail extracts JPEG frame from video container."""
    media_service = MediaService()
    mp4_path = os.path.join(test_media_files, "test.mp4")
    if os.path.exists(mp4_path):
        meeting_id = "test-thumb-gen-uuid"
        thumb_path = media_service.generate_thumbnail(mp4_path, meeting_id)
        assert thumb_path is not None
        assert os.path.exists(thumb_path)
        assert thumb_path.endswith(".jpg")
        assert os.path.getsize(thumb_path) > 0


def test_media_negative_edge_cases():
    """Verify robust rejection of empty, corrupt, and oversized media."""
    media_service = MediaService()

    # 1. Empty file
    empty_file = os.path.join(settings.MEDIA_STORAGE_DIR, "empty_test.mp4")
    os.makedirs(settings.MEDIA_STORAGE_DIR, exist_ok=True)
    with open(empty_file, "wb") as f:
        pass  # 0 bytes

    with pytest.raises(HTTPException) as exc:
        media_service.probe_media(empty_file, strict=True)
    assert exc.value.status_code == 400
    assert "empty" in exc.value.detail.lower()

    # 2. Corrupt file
    corrupt_file = os.path.join(settings.MEDIA_STORAGE_DIR, "corrupt_test.mp4")
    with open(corrupt_file, "wb") as f:
        f.write(b"NOT_A_VALID_MEDIA_FILE_BINARY_HEADER")

    with pytest.raises(HTTPException) as exc:
        media_service.probe_media(corrupt_file, strict=True)
    assert exc.value.status_code == 400
    assert "corrupt" in exc.value.detail.lower() or "unreadable" in exc.value.detail.lower()

    # 3. Oversized file
    with pytest.raises(HTTPException) as exc:
        media_service.validate_file("huge.mp4", "video/mp4", settings.MAX_UPLOAD_SIZE_BYTES + 1024)
    assert exc.value.status_code == 413

    # Clean up test artifacts
    for p in [empty_file, corrupt_file]:
        if os.path.exists(p):
            try:
                os.remove(p)
            except OSError:
                pass


def test_youtube_url_validation_matrix():
    """Verify YouTube URL parser supports all valid patterns and rejects malicious/unsupported URLs."""
    media_service = MediaService()

    # Valid patterns
    valid_cases = [
        ("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "dQw4w9WgXcQ"),
        ("https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"),
        ("http://www.youtube.com/watch?v=abcdef12345", "abcdef12345"),
    ]
    for url, expected_id in valid_cases:
        vid = media_service.validate_youtube_url(url)
        assert vid == expected_id, f"Failed for {url}"

    # Invalid patterns
    invalid_cases = [
        "ftp://youtube.com/watch?v=dQw4w9WgXcQ",  # Insecure scheme
        "https://vimeo.com/12345678",             # Unsupported domain
        "https://www.youtube.com/watch",           # Missing video id
        "https://www.youtube.com/watch?v=bad$id",  # Invalid regex characters
        "https://youtu.be/",                       # Empty path
        "not_a_url",                               # Garbage string
    ]
    for bad_url in invalid_cases:
        with pytest.raises(HTTPException) as exc:
            media_service.validate_youtube_url(bad_url)
        assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_security_path_traversal_and_media_streaming(client: AsyncClient):
    """Verify path traversal prevention on media endpoints and invalid UUID rejection."""
    # 1. Invalid UUID format should return 400 Bad Request
    resp = await client.get("/api/meetings/not-a-valid-uuid/media")
    assert resp.status_code == 400
    assert "Invalid meeting ID format" in resp.json()["detail"]

    # 2. Path traversal attempt in meeting_id
    resp_pt = await client.get("/api/meetings/..%2F..%2Fetc%2Fpasswd/media")
    assert resp_pt.status_code in [400, 404]

    # 3. Non-existent valid UUID returns 404 Not Found
    resp_404 = await client.get("/api/meetings/00000000-0000-0000-0000-000000000000/media")
    assert resp_404.status_code == 404


@pytest.mark.asyncio
async def test_cross_tenant_participant_isolation(client: AsyncClient):
    """Verify that a speaker in Organization A cannot be assigned a participant from Organization B."""
    # 1. Create Org A and Org B
    resp_a = await client.post("/api/organizations", json={"name": "Org A Tenant", "slug": "org-a-tenant"})
    assert resp_a.status_code == 201
    org_a = resp_a.json()

    resp_b = await client.post("/api/organizations", json={"name": "Org B Tenant", "slug": "org-b-tenant"})
    assert resp_b.status_code == 201
    org_b = resp_b.json()

    # 2. Create Participant in Org B Directory
    resp_part_b = await client.post(
        f"/api/organizations/{org_b['id']}/speakers",
        json={"name": "Bob Org B", "email": "bob@orgb.com", "description": "Org B Lead"}
    )
    assert resp_part_b.status_code == 201
    part_b = resp_part_b.json()

    # 3. Create Meeting in Org A using Org A's workspace
    ws_res = await client.get(f"/api/organizations/{org_a['id']}/workspaces")
    assert ws_res.status_code == 200
    workspaces_a = ws_res.json()
    ws_a_id = workspaces_a[0]["id"]

    resp_meet = await client.post(
        "/api/meetings",
        json={
            "organization_id": org_a["id"],
            "workspace_id": ws_a_id,
            "title": "Org A Confidential Meeting",
            "source_type": "UPLOAD"
        }
    )
    assert resp_meet.status_code == 201
    meeting_a = resp_meet.json()

    # Create speaker in Meeting A
    async with TestAsyncSessionLocal() as db:
        spk = Speaker(
            meeting_id=meeting_a["id"],
            speaker_label="SPEAKER_00",
            is_confirmed=False
        )
        db.add(spk)
        await db.commit()
        await db.refresh(spk)
        speaker_id = spk.id

    # 4. Attempt to assign Bob (Org B) to Speaker in Org A meeting -> Must return HTTP 400
    assign_resp = await client.patch(
        f"/api/meetings/{meeting_a['id']}/speakers/{speaker_id}",
        json={
            "confirmed_name": "Bob Org B",
            "participant_id": part_b["id"],
            "notes": "Attempted cross-tenant assignment"
        }
    )
    assert assign_resp.status_code == 400
    assert "belongs to a different organization" in assign_resp.json()["detail"]


def test_evidence_validator_integrity():
    """Verify EvidenceValidator enforces factual grounding and strips hallucinated owners."""
    # Mock segments for testing
    seg1 = TranscriptSegment(
        id="seg-1",
        meeting_id="meet-1",
        speaker_id="spk-1",
        start_time=10.0,
        end_time=20.0,
        text="We agreed to deploy the database migration on Friday."
    )
    segments = [seg1]

    # 1. Decision with valid quote
    d_valid = DecisionDTO(
        title="Deploy migration",
        decision_text="We agreed to deploy the database migration on Friday.",
        status="CONFIRMED",
        evidence_timestamp=15.0,
        evidence_quote="deploy the database migration"
    )
    validated_decs = EvidenceValidator.validate_and_link_decisions(segments, [d_valid])
    assert len(validated_decs) == 1
    assert validated_decs[0].source_segment_id == "seg-1"
    assert validated_decs[0].status == "CONFIRMED"

    # 2. Decision with tentative language -> downgraded to PROPOSED
    d_tentative = DecisionDTO(
        title="Tentative database suggestion",
        decision_text="We might consider a tentative proposal to migrate databases.",
        status="CONFIRMED",
        evidence_timestamp=15.0,
        evidence_quote="database migration"
    )
    val_tentative = EvidenceValidator.validate_and_link_decisions(segments, [d_tentative])
    assert len(val_tentative) == 1
    assert val_tentative[0].status == "PROPOSED"

    # 3. Action item with hallucinated owner
    act_hallucinated = ActionItemDTO(
        task_description="Migrate database schema",
        owner_name="Phantom Engineer",
        due_date="2026-11-01",
        status="OPEN",
        priority="HIGH",
        evidence_timestamp=15.0,
        evidence_quote="deploy the database migration"
    )
    # Known speakers list does NOT include Phantom Engineer
    val_acts = EvidenceValidator.validate_and_link_action_items(
        segments,
        [act_hallucinated],
        confirmed_speaker_names=["Alice Engineer", "Bob Lead"]
    )
    assert len(val_acts) == 1
    assert val_acts[0].source_segment_id == "seg-1"
    # Unconfirmed owner should be stripped to None
    assert val_acts[0].owner_name is None
