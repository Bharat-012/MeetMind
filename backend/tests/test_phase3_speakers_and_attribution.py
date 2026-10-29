"""Phase 3: Speaker Directory, Participant Management, and Attribution Integration Tests."""
import io
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.meeting import Meeting, ProcessingStatus
from app.models.transcript import Speaker, TranscriptSegment, MeetingParticipant, SpeakerAssignment
from app.models.organization import Organization, AuditLog
from app.services.pipeline_service import PipelineService
from tests.conftest import TestAsyncSessionLocal


@pytest.mark.asyncio
async def test_speaker_directory_crud(client: AsyncClient):
    """Verify organization-scoped speaker directory CRUD and search."""
    # 1. Create Organization
    org_res = await client.post("/api/organizations", json={"name": "Acme Global", "slug": "acme-global"})
    assert org_res.status_code == 201
    org_id = org_res.json()["id"]

    # 2. Create Speaker Profiles
    p1_res = await client.post(
        f"/api/organizations/{org_id}/speakers",
        json={"name": "Alice Smith", "email": "alice@acme.com", "description": "VP of Engineering"}
    )
    assert p1_res.status_code == 201
    p1 = p1_res.json()
    assert p1["name"] == "Alice Smith"
    assert p1["email"] == "alice@acme.com"
    assert p1["description"] == "VP of Engineering"
    assert p1["total_meetings"] == 0
    p1_id = p1["id"]

    p2_res = await client.post(
        f"/api/organizations/{org_id}/speakers",
        json={"name": "Bob Jones", "email": "bob@acme.com", "description": "Product Director"}
    )
    assert p2_res.status_code == 201
    p2_id = p2_res.json()["id"]

    # Reject duplicate name in same org
    dup_res = await client.post(
        f"/api/organizations/{org_id}/speakers",
        json={"name": "Alice Smith", "email": "alice2@acme.com"}
    )
    assert dup_res.status_code == 400

    # 3. List and Search
    list_res = await client.get(f"/api/organizations/{org_id}/speakers")
    assert list_res.status_code == 200
    assert len(list_res.json()) == 2

    search_res = await client.get(f"/api/organizations/{org_id}/speakers?q=Engineering")
    assert search_res.status_code == 200
    assert len(search_res.json()) == 1
    assert search_res.json()[0]["name"] == "Alice Smith"

    # 4. Update Profile
    upd_res = await client.patch(
        f"/api/organizations/{org_id}/speakers/{p1_id}",
        json={"description": "Chief Technology Officer", "email": "cto@acme.com"}
    )
    assert upd_res.status_code == 200
    assert upd_res.json()["description"] == "Chief Technology Officer"
    assert upd_res.json()["email"] == "cto@acme.com"

    # 5. Delete Profile
    del_res = await client.delete(f"/api/organizations/{org_id}/speakers/{p2_id}")
    assert del_res.status_code == 200
    assert del_res.json()["deleted"] is True

    # Confirm deletion
    get_res = await client.get(f"/api/organizations/{org_id}/speakers/{p2_id}")
    assert get_res.status_code == 404


@pytest.mark.asyncio
async def test_organization_data_isolation(client: AsyncClient):
    """Verify tenant isolation: Org A cannot access or assign Org B speaker profiles."""
    org_a = (await client.post("/api/organizations", json={"name": "Org A", "slug": "org-a"})).json()
    org_b = (await client.post("/api/organizations", json={"name": "Org B", "slug": "org-b"})).json()

    # Create speaker in Org B
    p_b = (await client.post(
        f"/api/organizations/{org_b['id']}/speakers",
        json={"name": "Secret Agent B", "email": "agent@orgb.com"}
    )).json()

    # Org A tries to fetch Org B speaker
    cross_get = await client.get(f"/api/organizations/{org_a['id']}/speakers/{p_b['id']}")
    assert cross_get.status_code == 404

    # Setup meeting in Org A
    ws_a = (await client.get(f"/api/organizations/{org_a['id']}/workspaces")).json()[0]
    files = {"file": ("audio_a.wav", io.BytesIO(b"MOCK_BYTES"), "audio/wav")}
    data = {"organization_id": org_a["id"], "workspace_id": ws_a["id"], "title": "Org A Meeting"}
    meeting_a = (await client.post("/api/meetings/upload", data=data, files=files)).json()

    pipeline = PipelineService(session_factory=TestAsyncSessionLocal)
    await pipeline.run_pipeline(meeting_a["id"])

    # Get speaker from Meeting A
    t_res = (await client.get(f"/api/meetings/{meeting_a['id']}/transcript")).json()
    speaker_id = t_res["speakers"][0]["id"]

    # Try assigning Org B participant to Org A meeting speaker -> MUST FAIL with 400
    bad_assign = await client.patch(
        f"/api/meetings/{meeting_a['id']}/speakers/{speaker_id}",
        json={"confirmed_name": "Tampered Name", "participant_id": p_b["id"]}
    )
    assert bad_assign.status_code == 400
    assert "different organization" in bad_assign.json()["detail"]


@pytest.mark.asyncio
async def test_speaker_assignment_correction_and_audit(client: AsyncClient):
    """Verify assigning anonymous speaker, correcting assignment, unassigning, and audit log trail."""
    org = (await client.post("/api/organizations", json={"name": "Audit Test Org", "slug": "audit-test-org"})).json()
    ws = (await client.get(f"/api/organizations/{org['id']}/workspaces")).json()[0]

    # Create participant profile
    participant = (await client.post(
        f"/api/organizations/{org['id']}/speakers",
        json={"name": "Dr. Clara Oswald", "email": "clara@tardis.org", "description": "Time Traveler"}
    )).json()

    # Upload & process meeting
    files = {"file": ("diar_test.wav", io.BytesIO(b"AUDIO_DATA"), "audio/wav")}
    data = {"organization_id": org["id"], "workspace_id": ws["id"], "title": "Diarization Attribution Meeting"}
    meeting = (await client.post("/api/meetings/upload", data=data, files=files)).json()

    pipeline = PipelineService(session_factory=TestAsyncSessionLocal)
    await pipeline.run_pipeline(meeting["id"])

    # Fetch initial transcript
    t_initial = (await client.get(f"/api/meetings/{meeting['id']}/transcript")).json()
    speaker_0 = t_initial["speakers"][0]
    initial_label = speaker_0["speaker_label"]
    speaker_id = speaker_0["id"]

    assert speaker_0["is_confirmed"] is False
    assert speaker_0["confirmed_name"] is None

    # Step 1: Assign speaker to participant profile
    assign_res = await client.patch(
        f"/api/meetings/{meeting['id']}/speakers/{speaker_id}",
        json={
            "confirmed_name": "Dr. Clara Oswald",
            "participant_id": participant["id"],
            "notes": "Confirmed by team lead based on voice and agenda"
        }
    )
    assert assign_res.status_code == 200
    assigned = assign_res.json()
    assert assigned["confirmed_name"] == "Dr. Clara Oswald"
    assert assigned["is_confirmed"] is True
    assert assigned["participant_id"] == participant["id"]
    # Original diarization label is strictly preserved!
    assert assigned["speaker_label"] == initial_label

    # Step 2: Correct assignment (e.g. user made mistake and clarifies name)
    correct_res = await client.patch(
        f"/api/meetings/{meeting['id']}/speakers/{speaker_id}",
        json={
            "confirmed_name": "Clara Oswald (Guest)",
            "participant_id": participant["id"],
            "notes": "Clarified guest title"
        }
    )
    assert correct_res.status_code == 200
    assert correct_res.json()["confirmed_name"] == "Clara Oswald (Guest)"

    # Step 3: Unassign speaker
    unassign_res = await client.post(f"/api/meetings/{meeting['id']}/speakers/{speaker_id}/unassign")
    assert unassign_res.status_code == 200
    unassigned = unassign_res.json()
    assert unassigned["confirmed_name"] is None
    assert unassigned["is_confirmed"] is False
    assert unassigned["participant_id"] is None
    assert unassigned["speaker_label"] == initial_label

    # Step 4: Verify complete audit history trail
    audit_res = await client.get(f"/api/meetings/{meeting['id']}/speakers/{speaker_id}/audit-history")
    assert audit_res.status_code == 200
    logs = audit_res.json()
    assert len(logs) == 3
    # Most recent first
    assert logs[0]["action"] == "UNASSIGN_SPEAKER"
    assert logs[1]["action"] == "CORRECT_SPEAKER_ASSIGNMENT"
    assert logs[1]["previous_name"] == "Dr. Clara Oswald"
    assert logs[1]["new_name"] == "Clara Oswald (Guest)"
    assert logs[2]["action"] == "ASSIGN_SPEAKER"
    assert logs[2]["new_name"] == "Dr. Clara Oswald"


@pytest.mark.asyncio
async def test_speaker_independence_across_different_meetings(client: AsyncClient):
    """Verify that SPEAKER_00 in Meeting 1 is strictly independent of SPEAKER_00 in Meeting 2."""
    org = (await client.post("/api/organizations", json={"name": "Multi-Meeting Org", "slug": "multi-meeting-org"})).json()
    ws = (await client.get(f"/api/organizations/{org['id']}/workspaces")).json()[0]

    pipeline = PipelineService(session_factory=TestAsyncSessionLocal)

    # Meeting 1
    f1 = {"file": ("meet1.wav", io.BytesIO(b"MOCK1"), "audio/wav")}
    m1 = (await client.post("/api/meetings/upload", data={"organization_id": org["id"], "workspace_id": ws["id"], "title": "Meeting One"}, files=f1)).json()
    await pipeline.run_pipeline(m1["id"])

    # Meeting 2
    f2 = {"file": ("meet2.wav", io.BytesIO(b"MOCK2"), "audio/wav")}
    m2 = (await client.post("/api/meetings/upload", data={"organization_id": org["id"], "workspace_id": ws["id"], "title": "Meeting Two"}, files=f2)).json()
    await pipeline.run_pipeline(m2["id"])

    # Fetch speakers
    t1 = (await client.get(f"/api/meetings/{m1['id']}/transcript")).json()
    t2 = (await client.get(f"/api/meetings/{m2['id']}/transcript")).json()

    s1_spk0 = t1["speakers"][0]
    s2_spk0 = t2["speakers"][0]

    assert s1_spk0["speaker_label"] == s2_spk0["speaker_label"]  # Both have label e.g. SPEAKER_00
    assert s1_spk0["id"] != s2_spk0["id"]  # Different primary keys!

    # Assign Meeting 1 SPEAKER_00 to "Alice"
    await client.patch(
        f"/api/meetings/{m1['id']}/speakers/{s1_spk0['id']}",
        json={"confirmed_name": "Alice"}
    )

    # Re-fetch both meetings
    t1_updated = (await client.get(f"/api/meetings/{m1['id']}/transcript")).json()
    t2_updated = (await client.get(f"/api/meetings/{m2['id']}/transcript")).json()

    # Meeting 1 is Alice
    assert t1_updated["speakers"][0]["confirmed_name"] == "Alice"
    assert t1_updated["speakers"][0]["is_confirmed"] is True

    # Meeting 2 remains unassigned! Zero cross-meeting bleed or assumption!
    assert t2_updated["speakers"][0]["confirmed_name"] is None
    assert t2_updated["speakers"][0]["is_confirmed"] is False


@pytest.mark.asyncio
async def test_speaker_stats_and_participation_history(client: AsyncClient):
    """Verify speaker contribution statistics and organization-level participation history."""
    org = (await client.post("/api/organizations", json={"name": "Stats Org", "slug": "stats-org"})).json()
    ws = (await client.get(f"/api/organizations/{org['id']}/workspaces")).json()[0]

    # Create speaker profile
    participant = (await client.post(
        f"/api/organizations/{org['id']}/speakers",
        json={"name": "Sarah Connor", "email": "sarah@resistance.com"}
    )).json()

    # Upload meeting
    files = {"file": ("stats.wav", io.BytesIO(b"MOCK_AUDIO"), "audio/wav")}
    meeting = (await client.post(
        "/api/meetings/upload",
        data={"organization_id": org["id"], "workspace_id": ws["id"], "title": "Judgment Day Planning"},
        files=files
    )).json()

    pipeline = PipelineService(session_factory=TestAsyncSessionLocal)
    await pipeline.run_pipeline(meeting["id"])

    # Assign speaker 0 to Sarah
    t_res = (await client.get(f"/api/meetings/{meeting['id']}/transcript")).json()
    spk_id = t_res["speakers"][0]["id"]
    await client.patch(
        f"/api/meetings/{meeting['id']}/speakers/{spk_id}",
        json={"confirmed_name": "Sarah Connor", "participant_id": participant["id"]}
    )

    # 1. Verify meeting speaker stats endpoint
    stats_res = await client.get(f"/api/meetings/{meeting['id']}/speakers/stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert len(stats) >= 2
    assert stats[0]["total_seconds"] > 0.0
    assert stats[0]["segment_count"] > 0
    assert stats[0]["percentage"] > 0.0

    # 2. Verify speaker profile history
    history_res = await client.get(f"/api/organizations/{org['id']}/speakers/{participant['id']}/history")
    assert history_res.status_code == 200
    history = history_res.json()
    assert history["participant"]["name"] == "Sarah Connor"
    assert history["participant"]["total_meetings"] == 1
    assert history["participant"]["total_talk_time_seconds"] > 0.0
    assert len(history["appearances"]) == 1
    assert history["appearances"][0]["meeting_title"] == "Judgment Day Planning"
    assert len(history["recent_segments"]) > 0

    # 3. Verify transcript timestamps were preserved after assignment
    t_after = (await client.get(f"/api/meetings/{meeting['id']}/transcript")).json()
    for s_before, s_after in zip(t_res["segments"], t_after["segments"]):
        assert s_before["start_time"] == s_after["start_time"]
        assert s_before["end_time"] == s_after["end_time"]
        assert s_before["text"] == s_after["text"]


@pytest.mark.asyncio
async def test_ollama_offline_behavior_labeled_fallback():
    """Verify that when local Ollama is offline, outputs are clearly labeled rule-based fallbacks."""
    from app.services.ai.ollama_provider import OllamaProvider
    from app.services.ai.dto import TranscriptSegmentDTO

    # Direct to unreachable port to guarantee offline simulation
    offline_provider = OllamaProvider(base_url="http://127.0.0.1:59999", timeout=1.0)

    # 1. Summary
    summary = await offline_provider.generate_summary("We decided to migrate to Postgres. John will finish the schema by Friday.")
    assert "RULE-BASED FALLBACK" in summary.executive_summary
    assert "ollama offline" in summary.model_name.lower()

    # 2. Short Transcript
    segs = [TranscriptSegmentDTO(start_time=0.0, end_time=5.0, text="Hello world", speaker_label="SPEAKER_00")]
    narrative = await offline_provider.generate_short_transcript(segs)
    assert "RULE-BASED FALLBACK" in narrative.narrative_text
    assert "ollama offline" in narrative.model_name.lower()

    # 3. Grounded Q&A
    context = [{"meeting_id": "m1", "start_time": 10.0, "end_time": 20.0, "speaker": "Alice", "text": "We approved the Q3 budget."}]
    answer = await offline_provider.answer_question("What was approved?", context)
    assert "RULE-BASED FALLBACK" in answer.answer
    assert answer.found_evidence is True
    assert len(answer.citations) > 0

