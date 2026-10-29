"""Central Local Model & Hardware Management Layer for MeetMind.

Enforces strict local inference policy:
- No third-party cloud AI fallbacks (OpenAI, Anthropic, Gemini cloud inference).
- Local ASR (faster-whisper).
- Local Diarization (NVIDIA Nemotron-3-Diarization).
- Local LLM (Ollama or local deterministic extractor).
- Local Embeddings (Sentence-Transformers or local vector projector).
"""
import os
import shutil
import subprocess
import logging
from typing import Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger("meetmind.model_manager")


class ModelStatus:
    READY = "READY"
    DOWNLOADED = "DOWNLOADED"
    MISSING_WEIGHTS = "MISSING_WEIGHTS"
    MISSING_DEPENDENCY = "MISSING_DEPENDENCY"
    SERVICE_OFFLINE = "SERVICE_OFFLINE"
    MOCK_MODE = "MOCK_MODE"
    FAILED = "FAILED"


class LocalModelManager:
    """Manages discovery, hardware profiling, readiness, and lifecycle of local models."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LocalModelManager, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if getattr(self, "_initialized", False):
            return
        self._initialized = True
        self.ffmpeg_path = self._detect_ffmpeg()

    def _detect_ffmpeg(self) -> Optional[str]:
        """Detect FFmpeg binary from PATH or common system installations."""
        # 1. System PATH
        which_ffmpeg = shutil.which("ffmpeg")
        if which_ffmpeg:
            return which_ffmpeg

        # 2. Configured or known paths on Windows
        candidate_paths = [
            r"C:\Program Files\Softdeluxe\Free Download Manager\ffmpeg.exe",
            r"C:\Program Files\BlueStacks_nxt\ffmpeg.exe",
            r"C:\ffmpeg\bin\ffmpeg.exe",
            os.path.expanduser(r"~\AppData\Local\Microsoft\WinGet\Links\ffmpeg.exe"),
        ]
        for p in candidate_paths:
            if os.path.exists(p):
                return p
        return None

    def get_hardware_profile(self) -> Dict[str, Any]:
        """Inspect host CPU, RAM, GPU, and CUDA acceleration support."""
        profile: Dict[str, Any] = {
            "os": os.name,
            "cpu_cores": os.cpu_count() or 1,
            "gpu_available": False,
            "gpu_name": None,
            "vram_total_mb": None,
            "cuda_available": False,
            "ffmpeg_available": self.ffmpeg_path is not None,
            "ffmpeg_path": self.ffmpeg_path,
            "ram_total_gb": 16.0,
            "ram_available_gb": 8.0,
        }

        # Check system RAM with psutil if available
        try:
            import psutil
            mem = psutil.virtual_memory()
            profile["ram_total_gb"] = round(mem.total / (1024 ** 3), 2)
            profile["ram_available_gb"] = round(mem.available / (1024 ** 3), 2)
        except Exception:
            pass

        # Check torch CUDA if torch installed
        try:
            import torch
            profile["cuda_available"] = torch.cuda.is_available()
            if torch.cuda.is_available():
                profile["gpu_available"] = True
                profile["gpu_name"] = torch.cuda.get_device_name(0)
                profile["vram_total_mb"] = torch.cuda.get_device_properties(0).total_memory // (1024 * 1024)
        except ImportError:
            # Fallback to nvidia-smi probe
            try:
                res = subprocess.run(
                    ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=3
                )
                if res.returncode == 0 and res.stdout.strip():
                    parts = res.stdout.strip().split(",")
                    profile["gpu_available"] = True
                    profile["gpu_name"] = parts[0].strip()
                    if len(parts) > 1:
                        profile["vram_total_mb"] = int(float(parts[1].strip()))
            except Exception:
                pass

        return profile

    def check_asr_readiness(self) -> Dict[str, Any]:
        """Check status of faster-whisper local ASR model."""
        if settings.ASR_PROVIDER == "mock":
            return {
                "provider": "mock",
                "model_name": "MockASRProvider",
                "status": ModelStatus.MOCK_MODE,
                "is_local": True,
                "details": "Deterministic mock provider active for unit tests."
            }

        try:
            import faster_whisper  # noqa: F401
            return {
                "provider": "faster_whisper",
                "model_size": settings.FASTER_WHISPER_MODEL_SIZE,
                "device": settings.WHISPER_DEVICE,
                "compute_type": settings.WHISPER_COMPUTE_TYPE,
                "status": ModelStatus.READY,
                "is_local": True,
                "details": f"faster-whisper is installed and configured for {settings.FASTER_WHISPER_MODEL_SIZE} on {settings.WHISPER_DEVICE}."
            }
        except ImportError:
            return {
                "provider": "faster_whisper",
                "status": ModelStatus.MISSING_DEPENDENCY,
                "is_local": True,
                "details": "faster-whisper library is not installed in the active Python environment."
            }

    def check_diarization_readiness(self) -> Dict[str, Any]:
        """Check status of NVIDIA Nemotron-3-Diarization model."""
        if settings.DIARIZATION_PROVIDER == "mock":
            return {
                "provider": "mock",
                "model_name": "MockDiarizationProvider",
                "status": ModelStatus.MOCK_MODE,
                "is_local": True,
                "details": "Deterministic mock provider active for unit tests."
            }

        # Check official NVIDIA Nemotron-3-Diarization requirements
        model_id = "nvidia/Nemotron-3-Diarization"
        try:
            import torch  # noqa: F401
            import transformers  # noqa: F401
            return {
                "provider": "nemotron_3_diarization",
                "model_id": model_id,
                "license": "OpenMDW 1.1 / NVIDIA Open Model License",
                "status": ModelStatus.READY,
                "is_local": True,
                "details": "Transformers and torch installed. Model loaded locally on first execution."
            }
        except ImportError as exc:
            return {
                "provider": "nemotron_3_diarization",
                "model_id": model_id,
                "license": "OpenMDW 1.1 / NVIDIA Open Model License",
                "status": ModelStatus.MISSING_DEPENDENCY,
                "is_local": True,
                "details": f"Missing runtime dependency: {exc}. Install torch and transformers."
            }

    def check_llm_readiness(self) -> Dict[str, Any]:
        """Check status of local LLM (Ollama or local rule extractor)."""
        if settings.LLM_PROVIDER == "mock":
            return {
                "provider": "mock",
                "status": ModelStatus.MOCK_MODE,
                "is_local": True,
                "details": "Deterministic mock LLM provider active."
            }

        if settings.LLM_PROVIDER == "ollama":
            import urllib.request
            try:
                url = f"{settings.OLLAMA_BASE_URL}/api/version"
                req = urllib.request.Request(url, headers={"User-Agent": "MeetMind"})
                with urllib.request.urlopen(req, timeout=2) as resp:
                    if resp.status == 200:
                        return {
                            "provider": "ollama",
                            "base_url": settings.OLLAMA_BASE_URL,
                            "model": settings.OLLAMA_MODEL,
                            "status": ModelStatus.READY,
                            "is_local": True,
                            "details": f"Local Ollama instance connected with model {settings.OLLAMA_MODEL}."
                        }
            except Exception:
                return {
                    "provider": "ollama",
                    "base_url": settings.OLLAMA_BASE_URL,
                    "model": settings.OLLAMA_MODEL,
                    "status": ModelStatus.SERVICE_OFFLINE,
                    "is_local": True,
                    "details": f"Cannot reach local Ollama daemon at {settings.OLLAMA_BASE_URL}. Ensure 'ollama serve' is running."
                }

        return {
            "provider": settings.LLM_PROVIDER,
            "status": ModelStatus.READY,
            "is_local": True,
            "details": "Local rule-based intelligence active."
        }

    def check_embedding_readiness(self) -> Dict[str, Any]:
        """Check status of local embedding provider."""
        if settings.EMBEDDING_PROVIDER == "mock":
            return {
                "provider": "mock",
                "status": ModelStatus.MOCK_MODE,
                "dimensions": 384,
                "is_local": True,
                "details": "Deterministic local hash-projector active."
            }

        try:
            import sentence_transformers  # noqa: F401
            return {
                "provider": "sentence_transformers",
                "model_name": settings.EMBEDDING_MODEL_NAME,
                "dimensions": 384,
                "status": ModelStatus.READY,
                "is_local": True,
                "details": f"sentence-transformers is installed with {settings.EMBEDDING_MODEL_NAME}."
            }
        except ImportError:
            return {
                "provider": "sentence_transformers",
                "model_name": settings.EMBEDDING_MODEL_NAME,
                "status": ModelStatus.MISSING_DEPENDENCY,
                "is_local": True,
                "details": "sentence-transformers library not installed."
            }

    def get_full_readiness_report(self) -> Dict[str, Any]:
        """Generate comprehensive system and local model readiness audit."""
        hw = self.get_hardware_profile()
        return {
            "hardware": hw,
            "models": {
                "asr": self.check_asr_readiness(),
                "diarization": self.check_diarization_readiness(),
                "llm": self.check_llm_readiness(),
                "embedding": self.check_embedding_readiness(),
            },
            "offline_mode_capable": True,
            "cloud_fallback_enabled": False  # Strictly False per policy
        }


model_manager = LocalModelManager()

