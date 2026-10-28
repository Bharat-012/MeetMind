"""Chat API tests for single-meeting and organization Q&A."""
import pytest
from httpx import AsyncClient
from app.services.pipeline_service import PipelineService
from tests.conftest import TestAsyncSessionLocal


@pytest.mark.asyncio
async def test_chat_api_with_grounded_answer(client: AsyncClient):
    """Test grounded answer generation with citations from meeting transcript."""
    # 1. Create Organization and Meeting
    org_resp = await client.post("/api/organizations", json={"name": "Research Lab", "slug": "research-lab"})
    org_id = org_resp.json()["id"]

    ws_resp = await client.get(f"/api/organizations/{org_id}/workspaces")
    ws_id = ws_resp.json()[0]["id"]

    meet_resp = await client.post(
        "/api/meetings",
        json={
            "organization_id": org_id,
            "workspace_id": ws_id,
            "title": "Postgres Migration Sync",
            "source_type": "UPLOAD"
        }
    )
    meeting_id = meet_resp.json()["id"]

    # Run pipeline so the meeting has transcript segments and indexed knowledge
    pipeline = PipelineService(session_factory=TestAsyncSessionLocal)
    await pipeline.run_pipeline(meeting_id)

    # 2. Chat with meeting about postgres migration
    chat_resp = await client.post(
        "/api/chat",
        json={
            "query": "What did the team decide about postgres database migration?",
            "meeting_id": meeting_id,
            "scope": "SINGLE_MEETING"
        }
    )
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()
    assert chat_data["found_evidence"] is True
    assert "pgvector" in chat_data["answer"]
    assert len(chat_data["citations"]) > 0


@pytest.mark.asyncio
async def test_chat_api_without_evidence(client: AsyncClient):
    """Test that chat truthfully reports missing evidence when meeting doesn't contain it."""
    chat_resp = await client.post(
        "/api/chat",
        json={
            "query": "What was the weather in Antarctica?",
            "scope": "SINGLE_MEETING"
        }
    )
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()
    assert chat_data["found_evidence"] is False
    assert "not contain sufficient evidence" in chat_data["answer"]
    assert len(chat_data["citations"]) == 0
