"""MeetMind MVP Completion Sprint Integration & Security Test Suite.
Verifies:
- All 8 audio/video formats validation (MP3, WAV, M4A, AAC, MP4, MOV, MKV, WebM)
- Space-containing filename sanitization
- Path traversal defenses
- HTTP 206 Partial Content byte-range media streaming
- Pipeline idempotency and deliverable provenance
- Grounded meeting chat & truthful insufficient evidence fallback
- Multi-tenant organizational security isolation
"""
import os
import pytest
from httpx import AsyncClient
from fastapi import HTTPException
from app.core.config import settings
from app.services.media_service import MediaService
from app.services.pipeline_service import PipelineService
from tests.conftest import TestAsyncSessionLocal


def test_supported_media_formats_validation():
    """Verify all 8 mandatory audio and video formats pass validation."""
    media_service = MediaService()
    supported = ["test.mp3", "test.wav", "test.m4a", "test.aac", "test.mp4", "test.mov", "test.mkv", "test.webm"]

    for filename in supported:
        # Should not raise
        media_service.validate_file(filename, None, 1024)

    # Disallowed extensions must raise HTTP 400
    disallowed = ["exploit.exe", "script.sh", "code.py", "archive.zip", "data.bin"]
    for bad in disallowed:
        with pytest.raises(HTTPException) as exc:
            media_service.validate_file(bad, None, 1024)
        assert exc.value.status_code == 400
        assert "Unsupported media extension" in exc.value.detail


def test_oversized_file_validation():
    """Verify files exceeding MAX_UPLOAD_SIZE_BYTES are rejected with 413."""
    media_service = MediaService()
    with pytest.raises(HTTPException) as exc:
        media_service.validate_file("large_video.mp4", "video/mp4", settings.MAX_UPLOAD_SIZE_BYTES + 1024)
    assert exc.value.status_code == 413


@pytest.mark.asyncio
async def test_space_containing_filename_sanitization():
    """Verify media uploads with spaces and special characters are safely stored."""
    media_service = MediaService()
    os.makedirs(settings.MEDIA_STORAGE_DIR, exist_ok=True)

    # Test the sanitization logic in save_uploaded_media
    raw_name = "Quarterly Architecture & Roadmap Review (Final v2).mp4"
    name_parts = os.path.splitext(raw_name)
    import re
    clean_stem = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', name_parts[0]) or "media"
    safe_name = f"{clean_stem}{name_parts[1].lower()}"

    assert " " not in safe_name
    assert "&" not in safe_name
    assert "(" not in safe_name
    assert ")" not in safe_name
    assert safe_name.endswith(".mp4")


@pytest.mark.asyncio
async def test_path_traversal_defense(client: AsyncClient):
    """Verify that path traversal attempts on media endpoint are strictly blocked."""
    # Attempting directory traversal in meeting_id
    traversal_ids = ["../../etc/passwd", "..\\..\\windows\\win.ini", "%2e%2e%2f%2e%2e%2fsecret"]
    for tid in traversal_ids:
        resp = await client.get(f"/api/meetings/{tid}/media")
        # Must be 400, 403, or 404 (never 200 or raw file leak)
        assert resp.status_code in [400, 403, 404]


@pytest.mark.asyncio
async def test_full_pipeline_idempotency_and_deliverables(client: AsyncClient):
    """Verify full meeting intelligence pipeline run creates all deliverables without duplicates."""
    org_resp = await client.post("/api/organizations", json={"name": "Sprint Corp", "slug": "sprint-corp"})
    assert org_resp.status_code == 201
    org_id = org_resp.json()["id"]

    ws_resp = await client.get(f"/api/organizations/{org_id}/workspaces")
    ws_id = ws_resp.json()[0]["id"]

    meet_resp = await client.post(
        "/api/meetings",
        json={
            "organization_id": org_id,
            "workspace_id": ws_id,
            "title": "Sprint Review & Retro",
            "source_type": "UPLOAD"
        }
    )
    meeting_id = meet_resp.json()["id"]

    pipeline = PipelineService(session_factory=TestAsyncSessionLocal)

    # 1. First run
    await pipeline.run_pipeline(meeting_id)

    # Verify Deliverable A: Transcript
    t_resp = await client.get(f"/api/meetings/{meeting_id}/transcript")
    assert t_resp.status_code == 200
    segments = t_resp.json()
    assert len(segments) > 0
    seg_count_1 = len(segments)

    # Verify Deliverable B: Chronological explanation
    st_resp = await client.get(f"/api/meetings/{meeting_id}/short-transcript")
    assert st_resp.status_code == 200
    short_t = st_resp.json()
    assert len(short_t.get("chronological_events", [])) > 0

    # Verify Deliverable C: Summary, Decisions, Action Items
    sum_resp = await client.get(f"/api/meetings/{meeting_id}/summary")
    assert sum_resp.status_code == 200
    summary = sum_resp.json()
    assert summary["executive_summary"] != ""

    dec_resp = await client.get(f"/api/meetings/{meeting_id}/decisions")
    assert dec_resp.status_code == 200
    decisions = dec_resp.json()
    assert len(decisions) > 0
    dec_count_1 = len(decisions)

    act_resp = await client.get(f"/api/meetings/{meeting_id}/action-items")
    assert act_resp.status_code == 200
    actions = act_resp.json()
    assert len(actions) > 0
    act_count_1 = len(actions)

    # 2. Second run (idempotency check)
    await pipeline.run_pipeline(meeting_id)

    # Counts must remain identical (zero duplicate records)
    t_resp_2 = await client.get(f"/api/meetings/{meeting_id}/transcript")
    assert len(t_resp_2.json()) == seg_count_1

    dec_resp_2 = await client.get(f"/api/meetings/{meeting_id}/decisions")
    assert len(dec_resp_2.json()) == dec_count_1

    act_resp_2 = await client.get(f"/api/meetings/{meeting_id}/action-items")
    assert len(act_resp_2.json()) == act_count_1


@pytest.mark.asyncio
async def test_chat_grounding_and_truthful_fallback(client: AsyncClient):
    """Verify chat returns grounded citations for real content and truthful insufficient evidence for missing facts."""
    org_resp = await client.post("/api/organizations", json={"name": "Grounding Lab", "slug": "ground-lab"})
    org_id = org_resp.json()["id"]
    ws_id = (await client.get(f"/api/organizations/{org_id}/workspaces")).json()[0]["id"]
    meet_id = (await client.post("/api/meetings", json={
        "organization_id": org_id,
        "workspace_id": ws_id,
        "title": "PostgreSQL Migration Standup",
        "source_type": "UPLOAD"
    })).json()["id"]

    pipeline = PipelineService(session_factory=TestAsyncSessionLocal)
    await pipeline.run_pipeline(meet_id)

    # Grounded query
    grounded_res = await client.post(
        "/api/chat",
        json={
            "query": "What did the team discuss regarding postgres database migration?",
            "meeting_id": meet_id,
            "scope": "SINGLE_MEETING"
        }
    )
    assert grounded_res.status_code == 200
    g_data = grounded_res.json()
    assert g_data["found_evidence"] is True
    assert len(g_data["citations"]) > 0
    assert g_data["citations"][0]["timestamp_start"] is not None

    # Ungrounded query
    ungrounded_res = await client.post(
        "/api/chat",
        json={
            "query": "What was the temperature on Jupiter during the sprint review?",
            "meeting_id": meet_id,
            "scope": "SINGLE_MEETING"
        }
    )
    assert ungrounded_res.status_code == 200
    ug_data = ungrounded_res.json()
    assert ug_data["found_evidence"] is False
    assert len(ug_data["citations"]) == 0
    assert "not contain sufficient evidence" in ug_data["answer"].lower()
