"""Local Model & Hardware Management API Endpoints."""
import os
import wave
import struct
import math
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, status
from app.core.config import settings
from app.core.model_manager import model_manager, ModelStatus
from app.services.ai.factory import get_asr_provider, get_diarization_provider

router = APIRouter(prefix="/models", tags=["Local Models & Hardware"])


@router.get("/status")
async def get_models_status() -> Dict[str, Any]:
    """Inspect local hardware acceleration, installed packages, and local AI model readiness."""
    return model_manager.get_full_readiness_report()


@router.post("/test-asr")
async def test_local_asr_inference() -> Dict[str, Any]:
    """Execute local ASR on a synthetic audio sample to verify genuine local inference."""
    # Generate 2-second synthetic 16kHz mono audio tone
    test_dir = os.path.join(settings.MEDIA_STORAGE_DIR, "system_test")
    os.makedirs(test_dir, exist_ok=True)
    test_audio_path = os.path.join(test_dir, "asr_test_tone.wav")

    sample_rate = 16000
    duration_s = 2.0
    freq_hz = 440.0
    num_samples = int(sample_rate * duration_s)

    with wave.open(test_audio_path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        raw_data = bytearray()
        for i in range(num_samples):
            val = int(32767.0 * 0.3 * math.sin(2.0 * math.pi * freq_hz * i / sample_rate))
            raw_data.extend(struct.pack("<h", val))
        wf.writeframes(raw_data)

    asr = get_asr_provider()
    try:
        segments = await asr.transcribe(test_audio_path)
        return {
            "status": "success",
            "provider": type(asr).__name__,
            "is_real_model": type(asr).__name__ == "FasterWhisperProvider",
            "segments_count": len(segments),
            "test_file": test_audio_path
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Local ASR test failed: {str(e)}"
        )


@router.get("/nemotron/spec")
async def get_nemotron_spec() -> Dict[str, Any]:
    """Retrieve detailed specification and diagnostic status for NVIDIA Nemotron-3-Diarization."""
    hw = model_manager.get_hardware_profile()
    diar_status = model_manager.check_diarization_readiness()

    return {
        "model_name": "NVIDIA Nemotron-3-Diarization",
        "huggingface_id": "nvidia/Nemotron-3-Diarization",
        "architecture": "Sortformer (Transformer-based multi-speaker diarization)",
        "parameter_count": "~100 Million",
        "maximum_concurrent_speakers": 8,
        "overlapping_speech_support": True,
        "frame_resolution_ms": 10,
        "sampling_rate_hz": 16000,
        "license": "OpenMDW 1.1 / NVIDIA Open Model License (Permissive commercial use)",
        "system_hardware_fit": {
            "gpu_detected": hw["gpu_name"],
            "vram_mb": hw["vram_total_mb"],
            "recommended_vram_mb": 1500,
            "can_run_on_cuda": hw["cuda_available"] and (hw["vram_total_mb"] or 0) >= 1500,
            "cpu_fallback_supported": True
        },
        "readiness": diar_status
    }

