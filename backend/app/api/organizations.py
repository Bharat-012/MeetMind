"""Organization and Workspace management endpoints."""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.organization import Organization, Workspace
from app.schemas.organization import (
    OrganizationCreate,
    OrganizationRead,
    WorkspaceRead
)


class WorkspaceCreateBody(BaseModel):
    name: str
    description: Optional[str] = None


router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.post("", response_model=OrganizationRead, status_code=status.HTTP_201_CREATED)
async def create_organization(payload: OrganizationCreate, db: AsyncSession = Depends(get_db)):
    """Create a new multi-tenant organization."""
    stmt = select(Organization).where(Organization.slug == payload.slug)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Organization with slug '{payload.slug}' already exists."
        )

    org = Organization(name=payload.name, slug=payload.slug)
    db.add(org)
    await db.flush()
    await db.refresh(org)

    # Automatically create default workspace for this organization
    default_ws = Workspace(
        organization_id=org.id,
        name="General Workspace",
        description="Default organization workspace"
    )
    db.add(default_ws)
    await db.flush()

    return org


@router.get("", response_model=List[OrganizationRead])
async def list_organizations(db: AsyncSession = Depends(get_db)):
    """List all registered organizations."""
    stmt = select(Organization).order_by(Organization.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("/{organization_id}/workspaces", response_model=WorkspaceRead, status_code=status.HTTP_201_CREATED)
async def create_workspace(organization_id: str, payload: WorkspaceCreateBody, db: AsyncSession = Depends(get_db)):
    """Create a workspace within an organization."""
    org_stmt = select(Organization).where(Organization.id == organization_id)
    org_res = await db.execute(org_stmt)
    if not org_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")

    ws = Workspace(
        organization_id=organization_id,
        name=payload.name,
        description=payload.description
    )
    db.add(ws)
    await db.flush()
    await db.refresh(ws)
    return ws


@router.get("/{organization_id}/workspaces", response_model=List[WorkspaceRead])
async def list_workspaces(organization_id: str, db: AsyncSession = Depends(get_db)):
    """List all workspaces within an organization."""
    stmt = select(Workspace).where(Workspace.organization_id == organization_id)
    result = await db.execute(stmt)
    return list(result.scalars().all())
