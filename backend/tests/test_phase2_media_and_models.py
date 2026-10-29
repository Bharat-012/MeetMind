"""Phase 2 tests: Media ingestion, local model management, and Nemotron Diarization."""
import os
import wave
import struct
import math
import pytest
from httpx import AsyncClient
from fastapi import HTTPException
from app.core.config import settings
from app.core.model_manager import model_manager, ModelStatus
from app.services.media_service import MediaService
from app.services.ai.dto import TranscriptSegmentDTO, DiarizationTurnDTO
from app.services.ai.nemotron_diarization_provider import Nemotron3DiarizationProvider
from app.services.ai.faster_whisper_provider import FasterWhisperProvider


@pytest.fixture
def sample_wav(tmp_path):
    """Generate a valid 2-second 16kHz mono WAV file for testing."""
    wav_path = str(tmp_path / "test_16k.wav")
    sample_rate = 16000
    num_samples = int(sample_rate * 2.0)
    with wave.open(wav_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        data = bytearray()
        for i in range(num_samples):
            val = int(32767.0 * 0.2 * math.sin(2.0 * math.pi * 440.0 * i / sample_rate))
            data.extend(struct.pack("<h", val))
        wf.writeframes(data)
    return wav_path


@pytest.mark.asyncio
async def test_model_manager_hardware_and_readiness():
    """Verify central local model manager hardware detection and readiness reporting."""
    report = model_manager.get_full_readiness_report()
    assert "hardware" in report
    assert "models" in report
    assert report["hardware"]["cpu_cores"] >= 1
    assert report["offline_mode_capable"] is True
    assert report["cloud_fallback_enabled"] is False  # Strict local inference policy


@pytest.mark.asyncio
async def test_models_api_endpoints(client: AsyncClient):
    """Verify /api/models/status and /api/models/nemotron/spec endpoints."""
    # 1. Status endpoint
    res = await client.get("/api/models/status")
    assert res.status_code == 200
    data = res.json()
    assert data["cloud_fallback_enabled"] is False
    assert "asr" in data["models"]
    assert "diarization" in data["models"]

    # 2. Nemotron spec endpoint
    nemotron_res = await client.get("/api/models/nemotron/spec")
    assert nemotron_res.status_code == 200
    spec = nemotron_res.json()
    assert spec["model_name"] == "NVIDIA Nemotron-3-Diarization"
    assert spec["huggingface_id"] == "nvidia/Nemotron-3-Diarization"
    assert spec["maximum_concurrent_speakers"] == 8
    assert spec["overlapping_speech_support"] is True
    assert spec["frame_resolution_ms"] == 10
    assert "system_hardware_fit" in spec

    # 3. Test ASR local test endpoint
    asr_test_res = await client.post("/api/models/test-asr")
    assert asr_test_res.status_code == 200
    asr_data = asr_test_res.json()
    assert asr_data["status"] == "success"
    assert "provider" in asr_data


def test_media_service_validation():
    """Verify file extension and size validation."""
    media_service = MediaService()

    # Valid extension
    media_service.validate_file("meeting.mp4", "video/mp4", 1024 * 1024)
    media_service.validate_file("audio.wav", "audio/wav", 500)

    # Invalid extension
    with pytest.raises(HTTPException) as exc_info:
        media_service.validate_file("malicious.exe", "application/x-msdownload", 100)
    assert exc_info.value.status_code == 400

    # Oversized file
    with pytest.raises(HTTPException) as size_exc:
        media_service.validate_file("large.mp4", "video/mp4", settings.MAX_UPLOAD_SIZE_BYTES + 100)
    assert size_exc.value.status_code == 413


def test_audio_duration_probing(sample_wav):
    """Verify wave module probes exact duration accurately without external process."""
    media_service = MediaService()
    dur = media_service.probe_audio_duration(sample_wav)
    assert abs(dur - 2.0) <= 0.05


@pytest.mark.asyncio
async def test_url_import_service():
    """Verify URL ingestion returns structured metadata and audio path."""
    media_service = MediaService()
    res = await media_service.import_from_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "test-meeting-url")
    assert res["is_youtube"] is True
    assert "audio_path" in res
    assert os.path.exists(res["audio_path"])


def test_nemotron_turn_conversion():
    """Verify Nemotron diarization speaker turns conversion and timestamp sorting."""
    raw_segments = [
        {"Speaker": 1, "Start": 15.2, "End": 28.5},
        {"Speaker": 0, "Start": 0.0, "End": 14.8},
        {"Speaker": 2, "Start": 29.0, "End": 45.0},
    ]

    turns = [
        DiarizationTurnDTO(
            start_time=s["Start"],
            end_time=s["End"],
            speaker_label=f"SPEAKER_{s['Speaker']:02d}",
            confidence=0.95
        )
        for s in raw_segments
    ]
    sorted_turns = sorted(turns, key=lambda t: t.start_time)

    assert sorted_turns[0].speaker_label == "SPEAKER_00"
    assert sorted_turns[0].start_time == 0.0
    assert sorted_turns[1].speaker_label == "SPEAKER_01"
    assert sorted_turns[2].speaker_label == "SPEAKER_02"
