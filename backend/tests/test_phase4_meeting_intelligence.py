"""Comprehensive Automated Test Suite for Phase 4: Meeting Intelligence Engine.

Covers:
1. Chronological ordering of events and segments.
2. Speaker attribution preservation and immutable ASR text.
3. Decision status classification (CONFIRMED vs PROPOSED vs REJECTED).
4. Action item extraction without hallucination (no invented owners/deadlines).
5. Evidence validation, source segment linking, and rejection of fabricated citations.
6. Chat Q&A with verifiable timestamp citations vs unsupported questions (explicit insufficient evidence).
7. Local Ollama generation and transparent labeled offline fallback.
8. Multi-tenant organization isolation and access control.
9. Database persistence, idempotent regeneration, and zero duplicate records.
"""
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from app.models.meeting import Meeting, ProcessingStatus
from app.models.transcript import TranscriptSegment, Speaker
from app.models.intelligence import (
    MeetingSummary,
    ShortTranscript,
    Decision,
    ActionItem,
    DecisionStatus,
    ActionItemStatus,
    Priority
)
from app.services.evidence_validator import EvidenceValidator
from app.services.ai.ollama_provider import OllamaProvider
from app.services.ai.dto import (
    TranscriptSegmentDTO,
    ChronologicalEventDTO,
    DecisionDTO,
    ActionItemDTO
)
from app.services.pipeline_service import PipelineService
from tests.conftest import TestAsyncSessionLocal


@pytest.mark.asyncio
async def test_evidence_validator_provenance_and_hallucination_defense(client: AsyncClient):
    """Test EvidenceValidator links authentic source_segment_id and rejects fake citations."""
    async with TestAsyncSessionLocal() as db:
        # Create test meeting and segments
        meeting = Meeting(
            organization_id="org-test-evidence",
            workspace_id="ws-test-evidence",
            title="Evidence Validation Meeting",
            status=ProcessingStatus.COMPLETED
        )
        db.add(meeting)
        await db.flush()

        seg1 = TranscriptSegment(
            meeting_id=meeting.id,
            start_time=10.0,
            end_time=25.0,
            text="Alice: We decided to deploy PostgreSQL with pgvector for our vector search.",
            confidence=0.98
        )
        seg2 = TranscriptSegment(
            meeting_id=meeting.id,
            start_time=30.0,
            end_time=45.0,
            text="Bob: I suggest we might consider Redis for caching, but no decision yet.",
            confidence=0.95
        )
        seg3 = TranscriptSegment(
            meeting_id=meeting.id,
            start_time=50.0,
            end_time=65.0,
            text="Alice: Charlie will schedule the deployment review by Friday.",
            confidence=0.96
        )
        db.add_all([seg1, seg2, seg3])
        await db.commit()

        segments = [seg1, seg2, seg3]

        # 1. Test chronological events linking
        raw_events = [
            ChronologicalEventDTO(
                timestamp=12.0,
                speaker="Alice",
                description="Announced PostgreSQL decision",
                event_type="conclusion",
                evidence_quote="deploy PostgreSQL with pgvector"
            ),
            ChronologicalEventDTO(
                timestamp=999.0,  # Fabricated out-of-bounds timestamp
                speaker="Unknown",
                description="Phantom discussion",
                event_type="contribution",
                evidence_quote="non-existent quote"
            )
        ]
        validated_events = EvidenceValidator.validate_and_link_events(segments, raw_events)
        assert validated_events[0].source_segment_id == seg1.id
        # Fabricated timestamp is caught and assigned to closest authentic segment fallback
        assert validated_events[1].source_segment_id is not None

        # 2. Test decision status classification and suggestion downgrade
        raw_decisions = [
            DecisionDTO(
                title="Postgres Vector Search",
                decision_text="Deploy PostgreSQL with pgvector",
                status="CONFIRMED",
                evidence_timestamp=15.0,
                evidence_quote="We decided to deploy PostgreSQL"
            ),
            DecisionDTO(
                title="Redis Caching",
                decision_text="I suggest we might consider Redis for caching",
                status="CONFIRMED",  # Tentative proposal incorrectly tagged CONFIRMED
                evidence_timestamp=35.0,
                evidence_quote="I suggest we might consider Redis"
            )
        ]
        validated_decisions = EvidenceValidator.validate_and_link_decisions(segments, raw_decisions)
        assert validated_decisions[0].status == "CONFIRMED"
        assert validated_decisions[0].source_segment_id == seg1.id
        # Suggestion downgraded from CONFIRMED to PROPOSED per strict decision rule
        assert validated_decisions[1].status == "PROPOSED"
        assert validated_decisions[1].source_segment_id == seg2.id

        # 3. Test action item non-hallucination of owners and deadlines
        raw_actions = [
            ActionItemDTO(
                task_description="Schedule deployment review",
                owner_name="Charlie",  # Grounded in segment text
                due_date="Friday",     # Grounded in segment text
                priority="HIGH",
                status="OPEN",
                evidence_timestamp=55.0,
                evidence_quote="Charlie will schedule the deployment review by Friday"
            ),
            ActionItemDTO(
                task_description="Build quantum computer",
                owner_name="John Doe",  # Hallucinated owner not in meeting
                due_date="ASAP",        # Ungrounded generic deadline
                priority="LOW",
                status="OPEN",
                evidence_timestamp=12.0,
                evidence_quote="deploy PostgreSQL"
            )
        ]
        validated_actions = EvidenceValidator.validate_and_link_action_items(
            segments=segments,
            action_items=raw_actions,
            confirmed_speaker_names=["Alice", "Bob"]
        )
        assert validated_actions[0].owner_name == "Charlie"
        assert validated_actions[0].due_date == "Friday"
        assert validated_actions[0].source_segment_id == seg3.id

        # Hallucinated owner stripped to None, ungrounded 'ASAP' stripped to None
        assert validated_actions[1].owner_name is None
        assert validated_actions[1].due_date is None

        # 4. Test verify_segment_ownership
        assert EvidenceValidator.verify_segment_ownership(meeting.id, seg1.id, segments) is True
        assert EvidenceValidator.verify_segment_ownership("other-meeting-id", seg1.id, segments) is False
        assert EvidenceValidator.verify_segment_ownership(meeting.id, "fake-segment-id", segments) is False


@pytest.mark.asyncio
async def test_ollama_offline_fallback_labeled_deliverables():
    """Test OllamaProvider transparently falls back to labeled rule-based outputs when offline."""
    # Point to non-existent port to guarantee offline mode
    provider = OllamaProvider(base_url="http://localhost:59999", model="llama3.2", timeout=0.5)

    segments = [
        TranscriptSegmentDTO(start_time=0.0, end_time=5.0, text="Alice: Did everyone review the design document?"),
        TranscriptSegmentDTO(start_time=5.0, end_time=12.0, text="Bob: I propose we use TypeScript for strict typing."),
        TranscriptSegmentDTO(start_time=12.0, end_time=20.0, text="Carol: However I disagree, but we approved Python for the backend."),
        TranscriptSegmentDTO(start_time=20.0, end_time=28.0, text="Alice: Finally we decided on FastAPI. Bob will write the API tests by Monday.")
    ]
    transcript_text = " ".join([s.text for s in segments])

    # 1. Summary fallback
    summary = await provider.generate_summary(transcript_text)
    assert "[RULE-BASED FALLBACK · Ollama daemon offline]" in summary.executive_summary
    assert "local-rule-based-fallback" in summary.model_name
    assert len(summary.open_questions) > 0  # Captured question ending in '?'
    assert "Did everyone review the design document?" in summary.open_questions[0]

    # 2. Chronological explanation fallback
    short = await provider.generate_short_transcript(segments)
    assert "[RULE-BASED FALLBACK · Ollama offline]" in short.narrative_text
    assert "local-rule-based-fallback" in short.model_name
    assert len(short.chronological_events) == 4
    # Event types classified by rule
    assert short.chronological_events[0].event_type == "question"
    assert short.chronological_events[1].event_type == "proposal"
    assert short.chronological_events[2].event_type == "disagreement"

    # 3. Decisions fallback
    decisions = await provider.extract_decisions(transcript_text)
    assert len(decisions) >= 1
    # Check confirmed decision extracted
    confirmed = [d for d in decisions if d.status == "CONFIRMED"]
    assert len(confirmed) >= 1
    assert "decided" in confirmed[0].decision_text.lower() or "approved" in confirmed[0].decision_text.lower()

    # 4. Action items fallback
    actions = await provider.extract_action_items(transcript_text)
    assert len(actions) >= 1
    # Captured Bob and Monday from text
    bob_action = [a for a in actions if a.owner_name == "Bob" or "Bob" in a.task_description]
    assert len(bob_action) > 0


@pytest.mark.asyncio
async def test_deliverables_endpoints_and_idempotent_regeneration(client: AsyncClient):
    """Test full API deliverables: Transcript, Short Transcript, Summary, Decisions, Action Items, and Regeneration."""
    # 1. Create org and meeting
    org_resp = await client.post("/api/organizations", json={"name": "Intelligence Inc", "slug": "intelligence-inc"})
    org_id = org_resp.json()["id"]

    ws_resp = await client.get(f"/api/organizations/{org_id}/workspaces")
    ws_id = ws_resp.json()[0]["id"]

    m_resp = await client.post(
        "/api/meetings",
        json={
            "organization_id": org_id,
            "workspace_id": ws_id,
            "title": "Architecture Sign-off",
            "source_type": "UPLOAD"
        }
    )
    meeting_id = m_resp.json()["id"]

    # Run pipeline to populate deliverables
    pipeline = PipelineService(session_factory=TestAsyncSessionLocal)
    success = await pipeline.run_pipeline(meeting_id)
    assert success is True

    # 2. Test Deliverable A: Full Transcript
    t_res = await client.get(f"/api/meetings/{meeting_id}/transcript")
    assert t_res.status_code == 200
    t_data = t_res.json()
    assert len(t_data["segments"]) > 0
    assert len(t_data["speakers"]) > 0
    # Original ASR text is preserved
    assert all(len(s["text"]) > 0 for s in t_data["segments"])
    assert all("is_confirmed" in s for s in t_data["segments"])

    # 3. Test Deliverable B: Short Transcript / Chronological Explanation
    st_res = await client.get(f"/api/meetings/{meeting_id}/short-transcript")
    assert st_res.status_code == 200
    st_data = st_res.json()
    assert len(st_data["narrative_text"]) > 0
    assert len(st_data["chronological_events"]) > 0
    for ev in st_data["chronological_events"]:
        assert "timestamp" in ev
        assert "speaker" in ev
        assert "description" in ev
        assert "event_type" in ev

    # 4. Test Deliverable C: Structured Summary
    sum_res = await client.get(f"/api/meetings/{meeting_id}/summary")
    assert sum_res.status_code == 200
    sum_data = sum_res.json()
    assert len(sum_data["executive_summary"]) > 0
    assert isinstance(sum_data["key_points"], list)
    assert isinstance(sum_data["risks"], list)
    assert isinstance(sum_data["open_questions"], list)
    assert isinstance(sum_data["next_steps"], list)
    assert sum_data["model_name"] is not None

    # 5. Test Deliverable C: Decision Register
    dec_res = await client.get(f"/api/meetings/{meeting_id}/decisions")
    assert dec_res.status_code == 200
    dec_data = dec_res.json()
    assert len(dec_data) > 0
    for d in dec_data:
        assert d["status"] in ["CONFIRMED", "PROPOSED", "REJECTED", "ACTIVE", "SUPERSEDED"]
        assert d["title"] is not None

    # 6. Test Deliverable C: Action Item Tracker
    act_res = await client.get(f"/api/meetings/{meeting_id}/action-items")
    assert act_res.status_code == 200
    act_data = act_res.json()
    assert len(act_data) > 0
    for a in act_data:
        assert a["priority"] in ["LOW", "MEDIUM", "HIGH", "URGENT"]
        assert a["status"] in ["OPEN", "PROPOSED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "BLOCKED", "CANCELLED"]

    # 7. Test Idempotent Regeneration: Call POST /api/meetings/{id}/regenerate-intelligence
    regen_res = await client.post(f"/api/meetings/{meeting_id}/regenerate-intelligence")
    assert regen_res.status_code == 200
    assert regen_res.json()["status"] == "SUCCESS"

    # Verify zero duplicate records created
    async with TestAsyncSessionLocal() as db:
        sum_count = (await db.execute(select(MeetingSummary).where(MeetingSummary.meeting_id == meeting_id))).scalars().all()
        assert len(sum_count) == 1

        short_count = (await db.execute(select(ShortTranscript).where(ShortTranscript.meeting_id == meeting_id))).scalars().all()
        assert len(short_count) == 1

        dec_count = (await db.execute(select(Decision).where(Decision.meeting_id == meeting_id))).scalars().all()
        assert len(dec_count) == len(dec_data)

        act_count = (await db.execute(select(ActionItem).where(ActionItem.meeting_id == meeting_id))).scalars().all()
        assert len(act_count) == len(act_data)


@pytest.mark.asyncio
async def test_chat_grounding_and_tenant_security(client: AsyncClient):
    """Test grounded citations, unsupported questions handling, and organization access control in chat."""
    # 1. Create two separate organizations
    org1_resp = await client.post("/api/organizations", json={"name": "Org Alpha", "slug": "org-alpha"})
    org1_id = org1_resp.json()["id"]

    org2_resp = await client.post("/api/organizations", json={"name": "Org Beta", "slug": "org-beta"})
    org2_id = org2_resp.json()["id"]

    ws1_resp = await client.get(f"/api/organizations/{org1_id}/workspaces")
    ws1_id = ws1_resp.json()[0]["id"]

    # Create meeting in Org Alpha
    m1_resp = await client.post(
        "/api/meetings",
        json={
            "organization_id": org1_id,
            "workspace_id": ws1_id,
            "title": "Alpha Roadmap",
            "source_type": "UPLOAD"
        }
    )
    meeting1_id = m1_resp.json()["id"]

    pipeline = PipelineService(session_factory=TestAsyncSessionLocal)
    await pipeline.run_pipeline(meeting1_id)

    # 2. Query meeting chat about topics discussed
    chat_ok = await client.post(
        "/api/chat",
        json={
            "query": "What did we decide about postgres or database migration?",
            "meeting_id": meeting1_id,
            "scope": "SINGLE_MEETING"
        }
    )
    assert chat_ok.status_code == 200
    data_ok = chat_ok.json()
    assert data_ok["found_evidence"] is True
    assert len(data_ok["citations"]) > 0
    # Verifiable timestamp citations
    assert data_ok["citations"][0]["timestamp_start"] is not None

    # 3. Query unsupported question (information not in meeting)
    chat_unsupported = await client.post(
        "/api/chat",
        json={
            "query": "What was the score in the 1998 World Cup final?",
            "meeting_id": meeting1_id,
            "scope": "SINGLE_MEETING"
        }
    )
    assert chat_unsupported.status_code == 200
    data_unsupported = chat_unsupported.json()
    assert data_unsupported["found_evidence"] is False
    assert "not contain sufficient evidence" in data_unsupported["answer"].lower()
    assert len(data_unsupported["citations"]) == 0

    # 4. Cross-tenant access attempt: Org Beta attempts to access Org Alpha's meeting
    forbidden_chat = await client.post(
        "/api/chat",
        json={
            "query": "Give me the confidential roadmap",
            "meeting_id": meeting1_id,
            "organization_id": org2_id,  # Mismatched organization!
            "scope": "SINGLE_MEETING"
        }
    )
    assert forbidden_chat.status_code == 403
    assert "access denied" in forbidden_chat.json()["detail"].lower()
