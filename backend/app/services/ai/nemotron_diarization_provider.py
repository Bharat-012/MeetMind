"""NVIDIA Nemotron-3-Diarization Provider.

Primary required speaker diarization model for MeetMind.
Model: nvidia/Nemotron-3-Diarization (100M parameter Sortformer).
Capabilities:
- Up to 8 concurrent speakers.
- Overlapping speech detection.
- 10ms frame resolution with Arrival-Order Speaker Cache (AOSC).
- Local execution via Hugging Face Transformers or NeMo.
"""
import os
import logging
from typing import List, Optional
from app.services.ai.dto import DiarizationTurnDTO

logger = logging.getLogger("meetmind.diarization.nemotron")


class Nemotron3DiarizationProvider:
    """NVIDIA Nemotron-3-Diarization local inference provider."""

    MODEL_ID = "nvidia/Nemotron-3-Diarization"

    def __init__(
        self,
        model_id: Optional[str] = None,
        device: Optional[str] = None,
        hf_token: Optional[str] = None
    ):
        self.model_id = model_id or self.MODEL_ID
        self.device = device or "auto"
        self.hf_token = hf_token
        self._model = None
        self._processor = None

    def _ensure_model_loaded(self):
        """Load processor and model from local cache or Hugging Face repository."""
        if self._model is not None and self._processor is not None:
            return

        try:
            import torch
            from transformers import AutoModelForAudioFrameClassification, AutoProcessor
        except ImportError as exc:
            logger.error(f"Cannot load Nemotron-3-Diarization: {exc}")
            raise RuntimeError(
                f"Nemotron-3-Diarization requires 'torch' and 'transformers'. "
                f"Install with: pip install torch torchaudio transformers. Error: {exc}"
            ) from exc

        logger.info(f"Loading Nemotron-3-Diarization ({self.model_id})...")
        try:
            self._processor = AutoProcessor.from_pretrained(
                self.model_id,
                token=self.hf_token
            )
            self._model = AutoModelForAudioFrameClassification.from_pretrained(
                self.model_id,
                token=self.hf_token,
                device_map=self.device
            )
            self._model.eval()
            logger.info(f"Nemotron-3-Diarization successfully loaded on {self._model.device}.")
        except Exception as e:
            logger.error(f"Failed to load Nemotron-3-Diarization model weights: {e}")
            raise RuntimeError(
                f"Failed to download or load '{self.model_id}': {e}. "
                f"Verify network connectivity for initial download or Hugging Face access token."
            ) from e

    async def diarize(self, audio_path: str) -> List[DiarizationTurnDTO]:
        """Run Nemotron-3-Diarization inference on a 16kHz mono audio file."""
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file for diarization not found at: {audio_path}")

        # Run model loading and inference in worker thread
        import asyncio
        loop = asyncio.get_running_loop()

        def _do_diarize():
            import torch
            from transformers.audio_utils import load_audio

            self._ensure_model_loaded()
            target_sr = getattr(self._processor.feature_extractor, "sampling_rate", 16000)

            # Load audio at expected sampling rate
            audio_array = load_audio(audio_path, sampling_rate=target_sr)
            inputs = self._processor(
                audio_array,
                sampling_rate=target_sr,
                return_tensors="pt"
            )

            device = self._model.device
            inputs = {k: v.to(device) for k, v in inputs.items()}

            with torch.inference_mode():
                outputs = self._model(**inputs)
                logits = outputs.logits  # Shape: (1, num_frames, 8)

            # Extract speaker turns using processor helper
            speaker_segments = self._processor.extract_speaker_dict(
                logits,
                inputs.get("attention_mask")
            )[0]

            turns: List[DiarizationTurnDTO] = []
            for seg in speaker_segments:
                speaker_num = seg.get("Speaker", 0)
                start_sec = round(float(seg.get("Start", 0.0)), 2)
                end_sec = round(float(seg.get("End", 0.0)), 2)
                turns.append(
                    DiarizationTurnDTO(
                        start_time=start_sec,
                        end_time=end_sec,
                        speaker_label=f"SPEAKER_{speaker_num:02d}",
                        confidence=0.95
                    )
                )

            return sorted(turns, key=lambda t: t.start_time)

        return await loop.run_in_executor(None, _do_diarize)

