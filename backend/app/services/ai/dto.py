"""Data Transfer Objects for AI provider outputs."""
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any


@dataclass
class WordTimingDTO:
    word: str
    start: float
    end: float
    confidence: Optional[float] = None


@dataclass
class TranscriptSegmentDTO:
    start_time: float
    end_time: float
    text: str
    speaker_label: Optional[str] = None
    confidence: Optional[float] = None
    words: List[WordTimingDTO] = field(default_factory=list)


@dataclass
class DiarizationTurnDTO:
    start_time: float
    end_time: float
    speaker_label: str
    confidence: Optional[float] = None


@dataclass
class SummaryDTO:
    executive_summary: str
    key_points: List[str]
    risks: List[str]
    open_questions: List[str]
    next_steps: List[str]
    model_name: str = "mock-summary-v1"


@dataclass
class ChronologicalEventDTO:
    timestamp: float
    speaker: str
    description: str


@dataclass
class ShortTranscriptDTO:
    narrative_text: str
    chronological_events: List[ChronologicalEventDTO]
    model_name: str = "mock-short-transcript-v1"


@dataclass
class DecisionDTO:
    title: str = "Decision"
    decision_text: str = ""
    category: str = "General"
    responsible_person: Optional[str] = None
    evidence_timestamp: Optional[float] = None
    evidence_quote: Optional[str] = None


@dataclass
class ActionItemDTO:
    task_description: str
    owner_name: Optional[str]
    due_date: Optional[str]
    priority: str
    evidence_timestamp: Optional[float]
    evidence_quote: Optional[str]


@dataclass
class GroundedAnswerDTO:
    answer: str
    citations: List[Dict[str, Any]]
    found_evidence: bool


@dataclass
class EmotionDTO:
    start_time: float
    end_time: float
    emotion_label: str
    confidence: float
    acoustic_features: Dict[str, Any] = field(default_factory=dict)

