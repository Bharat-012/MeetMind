"""Health endpoint tests."""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_check(client: AsyncClient):
    """Verify system health endpoint returns operational status and database connection."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app_name"] == "MeetMind"
    assert data["database"] == "healthy"
    assert "providers" in data
    assert data["providers"]["asr"] == "mock"

