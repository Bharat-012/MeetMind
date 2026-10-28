"""Organization-wide intelligence, cross-meeting synthesis, and decision history."""
from typing import List, Dict, Any, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.meeting import Meeting
from app.models.intelligence import Decision, ActionItem, DecisionStatus, ActionItemStatus
from app.services.rag_service import RAGService
from app.schemas.chat import GroundedAnswerResponse


class CrossMeetingService:
    """Provides organization-level synthesis, cross-meeting chat, and decision timeline tracking."""

    def __init__(self):
        self.rag_service = RAGService()

    async def chat_across_organization(
        self,
        db: AsyncSession,
        organization_id: str,
        query: str,
        workspace_id: Optional[str] = None,
        top_k: int = 8
    ) -> GroundedAnswerResponse:
        """Search and synthesize answers across all authorized meetings in an organization."""
        return await self.rag_service.answer_query(
            db=db,
            query=query,
            organization_id=organization_id,
            workspace_id=workspace_id,
            meeting_id=None,
            top_k=top_k
        )

    async def get_organization_decisions(
        self,
        db: AsyncSession,
        organization_id: str,
        workspace_id: Optional[str] = None,
        status: Optional[DecisionStatus] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve historical decisions across meetings with source links."""
        stmt = (
            select(Decision, Meeting.id, Meeting.title, Meeting.created_at)
            .join(Meeting, Decision.meeting_id == Meeting.id)
            .where(Meeting.organization_id == organization_id)
        )
        if workspace_id:
            stmt = stmt.where(Meeting.workspace_id == workspace_id)
        if status:
            stmt = stmt.where(Decision.status == status)

        stmt = stmt.order_by(Meeting.created_at.desc())
        res = await db.execute(stmt)

        decisions_list = []
        for dec, m_id, m_title, m_date in res.all():
            decisions_list.append({
                "id": dec.id,
                "meeting_id": m_id,
                "meeting_title": m_title,
                "meeting_date": m_date.isoformat() if m_date else None,
                "title": dec.title,
                "decision_text": dec.decision_text,
                "responsible_person": dec.responsible_person,
                "status": dec.status,
                "evidence_timestamp": dec.evidence_timestamp,
                "evidence_quote": dec.evidence_quote
            })
        return decisions_list

    async def get_organization_action_items(
        self,
        db: AsyncSession,
        organization_id: str,
        workspace_id: Optional[str] = None,
        status: Optional[ActionItemStatus] = None,
        owner: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Retrieve action items across all organization meetings."""
        stmt = (
            select(ActionItem, Meeting.id, Meeting.title, Meeting.created_at)
            .join(Meeting, ActionItem.meeting_id == Meeting.id)
            .where(Meeting.organization_id == organization_id)
        )
        if workspace_id:
            stmt = stmt.where(Meeting.workspace_id == workspace_id)
        if status:
            stmt = stmt.where(ActionItem.status == status)
        if owner:
            stmt = stmt.where(ActionItem.owner_name == owner)

        stmt = stmt.order_by(ActionItem.created_at.desc())
        res = await db.execute(stmt)

        actions_list = []
        for act, m_id, m_title, m_date in res.all():
            actions_list.append({
                "id": act.id,
                "meeting_id": m_id,
                "meeting_title": m_title,
                "meeting_date": m_date.isoformat() if m_date else None,
                "task_description": act.task_description,
                "owner_name": act.owner_name,
                "due_date": act.due_date,
                "priority": act.priority,
                "status": act.status,
                "evidence_timestamp": act.evidence_timestamp,
                "evidence_quote": act.evidence_quote
            })
        return actions_list
