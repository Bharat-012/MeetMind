"""Meetings API integration tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_meeting_api_crud_and_status(client: AsyncClient):
    """Test meeting creation, retrieval, and status reporting via REST API."""
    # 1. Create Organization
    org_resp = await client.post("/api/organizations", json={"name": "Global Corp", "slug": "global-corp"})
    assert org_resp.status_code == 201
    org = org_resp.json()
    org_id = org["id"]

    # 2. Get the auto-created default workspace
    ws_resp = await client.get(f"/api/organizations/{org_id}/workspaces")
    assert ws_resp.status_code == 200
    workspaces = ws_resp.json()
    assert len(workspaces) >= 1
    ws_id = workspaces[0]["id"]

    # 3. Create Meeting
    meet_resp = await client.post(
        "/api/meetings",
        json={
            "organization_id": org_id,
            "workspace_id": ws_id,
            "title": "Roadmap Kickoff",
            "description": "Quarterly planning",
            "source_type": "UPLOAD"
        }
    )
    assert meet_resp.status_code == 201
    meeting = meet_resp.json()
    meeting_id = meeting["id"]
    assert meeting["title"] == "Roadmap Kickoff"
    assert meeting["status"] == "UPLOADED"

    # 4. List meetings with organization filter
    list_resp = await client.get(f"/api/meetings?organization_id={org_id}")
    assert list_resp.status_code == 200
    list_data = list_resp.json()
    assert list_data["total"] == 1
    assert list_data["items"][0]["id"] == meeting_id

    # 5. Get meeting status
    status_resp = await client.get(f"/api/meetings/{meeting_id}/status")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    assert status_data["meeting_id"] == meeting_id
    assert status_data["status"] == "UPLOADED"

