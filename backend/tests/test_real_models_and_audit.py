"""End-to-End Validation and Real Model Audit Tests for MeetMind.

Verifies:
1. Real FasterWhisperProvider local inference.
2. Real Nemotron3DiarizationProvider local architecture and inference.
3. Pipeline retry idempotency (zero duplicates upon retry).
4. Media validation, error handling, and invalid inputs.
5. Model manager profiling and local-only provider integrity.
"""
import io
import math
import os
import struct
import tempfile
import wave
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.meeting import Meeting, ProcessingStatus
from app.models.transcript import TranscriptSegment, Speaker
from app.models.intelligence import MeetingSummary, ShortTranscript, Decision, ActionItem
from app.models.knowledge import KnowledgeChunk, EmbeddingRecord
from app.services.pipeline_service import PipelineService
from app.services.ai.faster_whisper_provider import FasterWhisperProvider
from app.services.ai.nemotron_diarization_provider import Nemotron3DiarizationProvider
from app.core.model_manager import LocalModelManager
from tests.conftest import TestAsyncSessionLocal


def _create_synthetic_wav(duration_seconds: float = 2.0, sample_rate: int = 16000) -> str:
    """Helper to create a temporary 16kHz mono WAV file."""
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp_path = tmp.name
    tmp.close()

    total_samples = int(duration_seconds * sample_rate)
    with wave.open(tmp_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        frames = []
        for i in range(total_samples):
            val = int(32767.0 * 0.3 * math.sin(2.0 * math.pi * 440.0 * i / sample_rate))
            frames.append(struct.pack("<h", val))
        wf.writeframes(b"".join(frames))
    return tmp_path


@pytest.mark.asyncio
async def test_real_faster_whisper_local_inference():
    """Verify that FasterWhisperProvider performs genuine local inference."""
    audio_path = _create_synthetic_wav(duration_seconds=1.5)
    try:
        # Load real local faster-whisper with tiny model on CPU
        provider = FasterWhisperProvider(model_size="tiny", device="cpu", compute_type="int8")
        assert isinstance(provider, FasterWhisperProvider)
        segments = await provider.transcribe(audio_path)
        # Real ASR ran on synthetic pure tone (no speech text expected, list returned without error)
        assert isinstance(segments, list)
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)


@pytest.mark.asyncio
async def test_real_nemotron_3_diarization_local_execution():
    """Verify that nvidia/Nemotron-3-Diarization runs genuine local inference."""
    audio_path = _create_synthetic_wav(duration_seconds=2.0)
    try:
        provider = Nemotron3DiarizationProvider()
        # Verify provider model ID
        assert provider.model_id == "nvidia/Nemotron-3-Diarization"
        turns = await provider.diarize(audio_path)
        # Real Sortformer frame classification ran; pure tone contains 0 speech turns
        assert isinstance(turns, list)
        # Check that loaded model has expected Sortformer 100M parameter architecture
        assert provider._model is not None
        num_params = sum(p.numel() for p in provider._model.parameters())
        assert num_params > 90_000_000
    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)


@pytest.mark.asyncio
async def test_pipeline_retry_idempotency_zero_duplicates(client: AsyncClient, db_session: AsyncSession):
    """Verify that retrying a meeting clears previous state and leaves zero duplicate records."""
    # 1. Setup organization and workspace
    org_resp = await client.post("/api/organizations", json={"name": "Audit Org", "slug": "audit-org"})
    assert org_resp.status_code == 201
    org_id = org_resp.json()["id"]

    ws_resp = await client.get(f"/api/organizations/{org_id}/workspaces")
    ws_id = ws_resp.json()[0]["id"]

    # 2. Upload meeting
    files = {"file": ("retry_audit.wav", io.BytesIO(b"AUDIO_DATA_FOR_AUDIT"), "audio/wav")}
    data = {"organization_id": org_id, "workspace_id": ws_id, "title": "Idempotency Audit Meeting"}
    upload_resp = await client.post("/api/meetings/upload", data=data, files=files)
    assert upload_resp.status_code == 201
    meeting_id = upload_resp.json()["id"]

    pipeline = PipelineService(session_factory=TestAsyncSessionLocal)

    # 3. First execution
    ok1 = await pipeline.run_pipeline(meeting_id)
    assert ok1 is True

    # Check counts after Run 1
    seg_count_1 = len(list((await db_session.execute(select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id))).scalars().all()))
    spk_count_1 = len(list((await db_session.execute(select(Speaker).where(Speaker.meeting_id == meeting_id))).scalars().all()))
    sum_count_1 = len(list((await db_session.execute(select(MeetingSummary).where(MeetingSummary.meeting_id == meeting_id))).scalars().all()))
    dec_count_1 = len(list((await db_session.execute(select(Decision).where(Decision.meeting_id == meeting_id))).scalars().all()))
    act_count_1 = len(list((await db_session.execute(select(ActionItem).where(ActionItem.meeting_id == meeting_id))).scalars().all()))
    chunk_count_1 = len(list((await db_session.execute(select(KnowledgeChunk).where(KnowledgeChunk.meeting_id == meeting_id))).scalars().all()))

    assert seg_count_1 > 0
    assert sum_count_1 == 1

    # 4. Trigger Retry execution via API
    retry_resp = await client.post(f"/api/meetings/{meeting_id}/retry")
    assert retry_resp.status_code == 200

    # Execute pipeline second time (simulating background worker rerun)
    ok2 = await pipeline.run_pipeline(meeting_id)
    assert ok2 is True

    # 5. Check counts after Run 2 — MUST BE EXACTLY IDENTICAL, ZERO DUPLICATION
    seg_count_2 = len(list((await db_session.execute(select(TranscriptSegment).where(TranscriptSegment.meeting_id == meeting_id))).scalars().all()))
    spk_count_2 = len(list((await db_session.execute(select(Speaker).where(Speaker.meeting_id == meeting_id))).scalars().all()))
    sum_count_2 = len(list((await db_session.execute(select(MeetingSummary).where(MeetingSummary.meeting_id == meeting_id))).scalars().all()))
    dec_count_2 = len(list((await db_session.execute(select(Decision).where(Decision.meeting_id == meeting_id))).scalars().all()))
    act_count_2 = len(list((await db_session.execute(select(ActionItem).where(ActionItem.meeting_id == meeting_id))).scalars().all()))
    chunk_count_2 = len(list((await db_session.execute(select(KnowledgeChunk).where(KnowledgeChunk.meeting_id == meeting_id))).scalars().all()))

    assert seg_count_2 == seg_count_1
    assert spk_count_2 == spk_count_1
    assert sum_count_2 == 1
    assert dec_count_2 == dec_count_1
    assert act_count_2 == act_count_1
    assert chunk_count_2 == chunk_count_1


@pytest.mark.asyncio
async def test_media_validation_rejections(client: AsyncClient):
    """Verify that unsupported media extensions and invalid payloads are strictly rejected."""
    org_resp = await client.post("/api/organizations", json={"name": "Validation Org", "slug": "val-org"})
    org_id = org_resp.json()["id"]
    ws_resp = await client.get(f"/api/organizations/{org_id}/workspaces")
    ws_id = ws_resp.json()[0]["id"]

    # 1. Reject unsupported extension (.exe)
    bad_file = {"file": ("malicious.exe", io.BytesIO(b"MZ\x90\x00"), "application/octet-stream")}
    bad_data = {"organization_id": org_id, "workspace_id": ws_id, "title": "Malicious Upload"}
    resp = await client.post("/api/meetings/upload", data=bad_data, files=bad_file)
    assert resp.status_code == 400
    assert "Unsupported media extension" in resp.json()["detail"]

    # 2. Reject unsupported URL scheme
    bad_url_payload = {
        "organization_id": org_id,
        "workspace_id": ws_id,
        "title": "Bad URL",
        "url": "ftp://files.example.com/audio.mp3"
    }
    url_resp = await client.post("/api/meetings/import-url", json=bad_url_payload)
    assert url_resp.status_code == 400
    assert "Unsupported or insecure URL" in url_resp.json()["detail"]


@pytest.mark.asyncio
async def test_hardware_profiling_and_no_cloud_leaks():
    """Verify hardware profiler correctly detects local CPU/RAM/GPU and no cloud fallbacks are active."""
    manager = LocalModelManager()
    profile = manager.get_hardware_profile()

    assert profile["cpu_cores"] > 0
    assert profile["ram_total_gb"] > 0.0

    # Verify model readiness report structure
    report = manager.get_full_readiness_report()
    assert report["cloud_fallback_enabled"] is False
    assert report["offline_mode_capable"] is True
    assert "asr" in report["models"]
    assert "diarization" in report["models"]
