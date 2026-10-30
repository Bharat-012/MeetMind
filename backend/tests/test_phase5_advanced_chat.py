"""Phase 5: Advanced AI Meeting Chat & Knowledge Intelligence integration tests.
Verifies grounded Q&A, evidence citations, multi-tenant isolation, suggested questions,
conversation persistence, and SSE streaming.
"""
import pytest
from httpx import AsyncClient
from app.services.pipeline_service import PipelineService
from app.services.ai.local_embedding_provider import LocalSentenceEmbeddingProvider
from tests.conftest import TestAsyncSessionLocal


@pytest.mark.asyncio
async def test_local_semantic_embedding_provider():
    """Verify genuine local sentence transformer embedding produces 384-dimensional normalized vectors."""
    provider = LocalSentenceEmbeddingProvider()
    assert provider.model_name == "sentence-transformers/all-MiniLM-L6-v2"
    assert provider.dimension == 384

    embeddings = await provider.embed_documents(["Deployment schedule finalized for Friday.", "Database schema migration."])
    assert len(embeddings) == 2
    assert len(embeddings[0]) == 384
    assert len(embeddings[1]) == 384

    # Check non-zero and reasonable norms
    norm_sq = sum(x * x for x in embeddings[0])
    assert abs(norm_sq - 1.0) < 1e-2  # L2 normalized


@pytest.mark.asyncio
async def test_suggested_questions_endpoint(client: AsyncClient):
    """Test grounded suggested questions generation for meetings and organizations."""
    # 1. Create Org and Meeting
    org_resp = await client.post("/api/organizations", json={"name": "Intelligence Group", "slug": "intel-grp"})
    assert org_resp.status_code == 201
    org_id = org_resp.json()["id"]

    ws_resp = await client.get(f"/api/organizations/{org_id}/workspaces")
    ws_id = ws_resp.json()[0]["id"]

    meet_resp = await client.post(
        "/api/meetings",
        json={
            "organization_id": org_id,
            "workspace_id": ws_id,
            "title": "Sprint Planning Q4",
            "source_type": "UPLOAD"
        }
    )
    meeting_id = meet_resp.json()["id"]

    # Run pipeline to populate decisions and summary
    pipeline = PipelineService(session_factory=TestAsyncSessionLocal)
    await pipeline.run_pipeline(meeting_id)

    # 2. Get suggested questions for specific meeting
    res_meet = await client.get(f"/api/chat/suggested-questions?meeting_id={meeting_id}")
    assert res_meet.status_code == 200
    data_meet = res_meet.json()
    assert data_meet["meeting_id"] == meeting_id
    assert len(data_meet["questions"]) >= 2
    assert any("decis" in q.lower() or "action" in q.lower() or "topic" in q.lower() for q in data_meet["questions"])

    # 3. Get suggested questions for organization
    res_org = await client.get(f"/api/chat/suggested-questions?organization_id={org_id}")
    assert res_org.status_code == 200
    data_org = res_org.json()
    assert data_org["organization_id"] == org_id
    assert len(data_org["questions"]) >= 3


@pytest.mark.asyncio
async def test_persistent_conversation_crud_and_messages(client: AsyncClient):
    """Test conversation creation, listing, messaging, history retrieval, and deletion."""
    # 1. Create Org and Meeting
    org_resp = await client.post("/api/organizations", json={"name": "Conversational Labs", "slug": "conv-labs"})
    org_id = org_resp.json()["id"]

    ws_resp = await client.get(f"/api/organizations/{org_id}/workspaces")
    ws_id = ws_resp.json()[0]["id"]

    meet_resp = await client.post(
        "/api/meetings",
        json={
            "organization_id": org_id,
            "workspace_id": ws_id,
            "title": "Security Architecture Review",
            "source_type": "UPLOAD"
        }
    )
    meeting_id = meet_resp.json()["id"]

    pipeline = PipelineService(session_factory=TestAsyncSessionLocal)
    await pipeline.run_pipeline(meeting_id)

    # 2. Create Conversation
    create_conv_resp = await client.post(
        "/api/chat/conversations",
        json={
            "organization_id": org_id,
            "workspace_id": ws_id,
            "meeting_id": meeting_id,
            "title": "Security Questions",
            "scope": "SINGLE_MEETING"
        }
    )
    assert create_conv_resp.status_code == 201
    conv = create_conv_resp.json()
    conv_id = conv["id"]
    assert conv["title"] == "Security Questions"
    assert conv["messages"] == []

    # 3. List Conversations
    list_resp = await client.get(f"/api/chat/conversations?meeting_id={meeting_id}")
    assert list_resp.status_code == 200
    convs = list_resp.json()
    assert len(convs) >= 1
    assert convs[0]["id"] == conv_id

    # 4. Post Message into Conversation
    msg_resp = await client.post(
        f"/api/chat/conversations/{conv_id}/messages",
        json={"content": "What did the team discuss regarding postgres migration?"}
    )
    assert msg_resp.status_code == 200
    ans_data = msg_resp.json()
    assert ans_data["found_evidence"] is True
    assert "pgvector" in ans_data["answer"]
    assert len(ans_data["citations"]) > 0

    # 5. Fetch Conversation and check message history
    get_conv_resp = await client.get(f"/api/chat/conversations/{conv_id}")
    assert get_conv_resp.status_code == 200
    conv_detail = get_conv_resp.json()
    assert len(conv_detail["messages"]) == 2
    assert conv_detail["messages"][0]["sender"] == "USER"
    assert "postgres" in conv_detail["messages"][0]["content"]
    assert conv_detail["messages"][1]["sender"] == "ASSISTANT"
    assert len(conv_detail["messages"][1]["citations"]) > 0

    # 6. Delete Conversation
    del_resp = await client.delete(f"/api/chat/conversations/{conv_id}")
    assert del_resp.status_code == 200
    assert del_resp.json()["ok"] is True

    # 7. Confirm 404 after deletion
    get_again = await client.get(f"/api/chat/conversations/{conv_id}")
    assert get_again.status_code == 404


@pytest.mark.asyncio
async def test_multi_tenant_isolation(client: AsyncClient):
    """Test that querying a meeting belonging to another organization is forbidden."""
    # Org A
    org_a = (await client.post("/api/organizations", json={"name": "Org Alpha", "slug": "org-alpha"})).json()
    ws_a = (await client.get(f"/api/organizations/{org_a['id']}/workspaces")).json()[0]
    meet_a = (await client.post("/api/meetings", json={
        "organization_id": org_a["id"],
        "workspace_id": ws_a["id"],
        "title": "Alpha Confidential Sync",
        "source_type": "UPLOAD"
    })).json()

    # Org B
    org_b = (await client.post("/api/organizations", json={"name": "Org Beta", "slug": "org-beta"})).json()

    # Cross-tenant attempt: Org B attempts to query Meeting from Org A
    forbidden_resp = await client.post(
        "/api/chat",
        json={
            "query": "What did they talk about?",
            "meeting_id": meet_a["id"],
            "organization_id": org_b["id"],
            "scope": "SINGLE_MEETING"
        }
    )
    assert forbidden_resp.status_code == 403
    assert "Access denied" in forbidden_resp.json()["detail"]


@pytest.mark.asyncio
async def test_chat_sse_stream_endpoint(client: AsyncClient):
    """Test SSE streaming endpoint produces proper event stream tokens and final citations."""
    org = (await client.post("/api/organizations", json={"name": "Stream Org", "slug": "stream-org"})).json()
    ws = (await client.get(f"/api/organizations/{org['id']}/workspaces")).json()[0]
    meet = (await client.post("/api/meetings", json={
        "organization_id": org["id"],
        "workspace_id": ws["id"],
        "title": "Streamed Meeting Sync",
        "source_type": "UPLOAD"
    })).json()

    pipeline = PipelineService(session_factory=TestAsyncSessionLocal)
    await pipeline.run_pipeline(meet["id"])

    # Stream query
    stream_resp = await client.post(
        "/api/chat/stream",
        json={
            "query": "What was the decision about database migration?",
            "meeting_id": meet["id"],
            "scope": "SINGLE_MEETING"
        }
    )
    assert stream_resp.status_code == 200
    assert "text/event-stream" in stream_resp.headers["content-type"]

    body_text = stream_resp.text
    assert "data: " in body_text
    assert '"type": "start"' in body_text
    assert '"type": "token"' in body_text
    assert '"type": "done"' in body_text
    assert '"found_evidence": true' in body_text
