"""Organization-level knowledge, cross-meeting chat, and decision timeline APIs."""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.intelligence import DecisionStatus, ActionItemStatus
from app.schemas.chat import GroundedAnswerResponse
from app.services.cross_meeting_service import CrossMeetingService
from app.services.rag_service import RAGService

router = APIRouter(prefix="/organizations/{organization_id}", tags=["Organizational Knowledge"])
cross_meeting_service = CrossMeetingService()
rag_service = RAGService()


class OrgChatRequest(BaseModel):
    query: str
    workspace_id: Optional[str] = None
    top_k: int = 8


@router.post("/chat", response_model=GroundedAnswerResponse)
async def chat_across_organization(
    organization_id: str,
    payload: OrgChatRequest,
    db: AsyncSession = Depends(get_db)
):
    """Ask questions across all authorized meetings in an organization with grounded citations."""
    return await cross_meeting_service.chat_across_organization(
        db=db,
        organization_id=organization_id,
        query=payload.query,
        workspace_id=payload.workspace_id,
        top_k=payload.top_k
    )


@router.get("/decisions", response_model=List[Dict[str, Any]])
async def list_organization_decisions(
    organization_id: str,
    workspace_id: Optional[str] = Query(None),
    status: Optional[DecisionStatus] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve historical decisions across all meetings in the organization."""
    return await cross_meeting_service.get_organization_decisions(
        db=db,
        organization_id=organization_id,
        workspace_id=workspace_id,
        status=status
    )


@router.get("/action-items", response_model=List[Dict[str, Any]])
async def list_organization_action_items(
    organization_id: str,
    workspace_id: Optional[str] = Query(None),
    status: Optional[ActionItemStatus] = Query(None),
    owner: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve action items across all meetings in the organization."""
    return await cross_meeting_service.get_organization_action_items(
        db=db,
        organization_id=organization_id,
        workspace_id=workspace_id,
        status=status,
        owner=owner
    )


@router.get("/search", response_model=List[Dict[str, Any]])
async def search_organization_knowledge(
    organization_id: str,
    q: str = Query(..., description="Search query string"),
    workspace_id: Optional[str] = Query(None),
    top_k: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db)
):
    """Perform hybrid search (vector + keyword) across organization meetings."""
    return await rag_service.search(
        db=db,
        organization_id=organization_id,
        query=q,
        workspace_id=workspace_id,
        top_k=top_k
    )
