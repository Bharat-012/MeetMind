"""Organization knowledge base, cross-meeting chat, and tenant isolation tests."""
import io
import pytest
from httpx import AsyncClient
from app.services.pipeline_service import PipelineService
from tests.conftest import TestAsyncSessionLocal


@pytest.mark.asyncio
async def test_cross_meeting_intelligence_and_tenant_isolation(client: AsyncClient):
    """Test cross-meeting search, organization Q&A, and strict multi-tenant boundary enforcement."""
    # 1. Create Organization A
    org_a_resp = await client.post("/api/organizations", json={"name": "Org A", "slug": "org-a"})
    org_a_id = org_a_resp.json()["id"]

    ws_a_resp = await client.get(f"/api/organizations/{org_a_id}/workspaces")
    ws_a_id = ws_a_resp.json()[0]["id"]

    # 2. Upload and process Meeting 1 in Org A
    file_content = b"TEST_AUDIO_CONTENT"
    files = {"file": ("meeting1.wav", io.BytesIO(file_content), "audio/wav")}
    m1_resp = await client.post(
        "/api/meetings/upload",
        data={"organization_id": org_a_id, "workspace_id": ws_a_id, "title": "Database Architecture Sync"},
        files=files
    )
    m1_id = m1_resp.json()["id"]

    pipeline = PipelineService(session_factory=TestAsyncSessionLocal)
    await pipeline.run_pipeline(m1_id)

    # 3. Create Organization B (Tenant Isolation Target)
    org_b_resp = await client.post("/api/organizations", json={"name": "Org B", "slug": "org-b"})
    org_b_id = org_b_resp.json()["id"]

    # 4. Search within Org A: should find Postgres/database matches
    search_a = await client.get(f"/api/organizations/{org_a_id}/search?q=postgres")
    assert search_a.status_code == 200
    results_a = search_a.json()
    assert len(results_a) > 0
    assert any("postgres" in r["text"].lower() for r in results_a)

    # 5. Search within Org B: MUST return empty list (No Tenant Leakage!)
    search_b = await client.get(f"/api/organizations/{org_b_id}/search?q=postgres")
    assert search_b.status_code == 200
    results_b = search_b.json()
    assert len(results_b) == 0

    # 6. Organization A Decisions Endpoint
    dec_a = await client.get(f"/api/organizations/{org_a_id}/decisions")
    assert dec_a.status_code == 200
    decisions_data = dec_a.json()
    assert len(decisions_data) >= 1
    assert "PostgreSQL" in decisions_data[0]["title"] or "database" in decisions_data[0]["title"].lower()

    # 7. Organization A Action Items Endpoint
    act_a = await client.get(f"/api/organizations/{org_a_id}/action-items")
    assert act_a.status_code == 200
    actions_data = act_a.json()
    assert len(actions_data) >= 1
    assert actions_data[0]["owner_name"] == "SPEAKER_01"

    # 8. Cross-Meeting Chat in Org A
    chat_a = await client.post(
        f"/api/organizations/{org_a_id}/chat",
        json={"query": "What was decided regarding database migration?"}
    )
    assert chat_a.status_code == 200
    chat_data = chat_a.json()
    assert chat_data["found_evidence"] is True
    assert len(chat_data["citations"]) > 0

    # 9. Cross-Meeting Chat in Org B: Must NOT find Org A's information
    chat_b = await client.post(
        f"/api/organizations/{org_b_id}/chat",
        json={"query": "What was decided regarding database migration?"}
    )
    assert chat_b.status_code == 200
    chat_b_data = chat_b.json()
    assert chat_b_data["found_evidence"] is False
    assert len(chat_b_data["citations"]) == 0
