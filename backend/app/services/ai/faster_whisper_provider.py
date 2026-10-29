"""Real Local Speech-to-Text Provider using faster-whisper.

Runs entirely locally without external cloud API calls.
Preserves sentence-level and word-level timestamps.
"""
import os
import logging
from typing import List, Optional
from app.core.config import settings
from app.services.ai.dto import TranscriptSegmentDTO, WordTimingDTO

logger = logging.getLogger("meetmind.asr.faster_whisper")


class FasterWhisperProvider:
    """Production local ASR engine powered by faster-whisper / CTranslate2."""

    def __init__(
        self,
        model_size: Optional[str] = None,
        device: Optional[str] = None,
        compute_type: Optional[str] = None
    ):
        self.model_size = model_size or settings.FASTER_WHISPER_MODEL_SIZE
        self.device = device or settings.WHISPER_DEVICE
        self.compute_type = compute_type or settings.WHISPER_COMPUTE_TYPE
        self._model = None

    def _get_model(self):
        """Lazy load WhisperModel to avoid cold-start overhead when not in use."""
        if self._model is None:
            try:
                from faster_whisper import WhisperModel
                logger.info(
                    f"Loading faster-whisper model '{self.model_size}' "
                    f"on device '{self.device}' with compute_type '{self.compute_type}'..."
                )
                self._model = WhisperModel(
                    self.model_size,
                    device=self.device,
                    compute_type=self.compute_type
                )
            except Exception as e:
                logger.error(f"Failed to load faster-whisper model: {e}")
                raise RuntimeError(
                    f"Could not initialize local faster-whisper ASR: {e}. "
                    f"Ensure 'faster-whisper' is installed and {self.device} is configured."
                ) from e
        return self._model

    async def transcribe(
        self,
        audio_path: str,
        language: Optional[str] = None
    ) -> List[TranscriptSegmentDTO]:
        """Transcribe local audio file and return timestamped segments."""
        if not os.path.exists(audio_path):
            raise FileNotFoundError(f"Audio file not found at: {audio_path}")

        model = self._get_model()

        # Run transcription in thread to avoid blocking async event loop
        import asyncio
        loop = asyncio.get_running_loop()

        def _do_transcribe():
            segments_generator, info = model.transcribe(
                audio_path,
                language=language,
                beam_size=5,
                word_timestamps=True,
                vad_filter=True,
                vad_parameters=dict(min_silence_duration_ms=500)
            )
            return list(segments_generator), info

        segments_raw, info = await loop.run_in_executor(None, _do_transcribe)
        logger.info(
            f"Transcription finished: detected language '{info.language}' "
            f"with probability {info.language_probability:.2f}, {len(segments_raw)} segments."
        )

        dtos: List[TranscriptSegmentDTO] = []
        for seg in segments_raw:
            words_dto: List[WordTimingDTO] = []
            if seg.words:
                for w in seg.words:
                    words_dto.append(
                        WordTimingDTO(
                            word=w.word.strip(),
                            start=round(w.start, 2),
                            end=round(w.end, 2),
                            confidence=round(w.probability, 3) if hasattr(w, "probability") else None
                        )
                    )

            dtos.append(
                TranscriptSegmentDTO(
                    start_time=round(seg.start, 2),
                    end_time=round(seg.end, 2),
                    text=seg.text.strip(),
                    speaker_label=None,  # Populated downstream by diarization
                    confidence=round(getattr(seg, "avg_logprob", 0.0), 3),
                    words=words_dto
                )
            )

        return dtos

