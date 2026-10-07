import re
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.app.api.deps import WorkspaceRoleChecker, get_current_user
from apps.api.app.core.database import get_db
from apps.api.app.models.entities import User, Workspace, WorkspaceMembership
from apps.api.app.schemas.auth import UserResponse
from apps.api.app.schemas.workspace import (
    WorkspaceCreateRequest,
    WorkspaceMemberAddRequest,
    WorkspaceMemberResponse,
    WorkspaceMemberUpdateRequest,
    WorkspaceResponse,
    WorkspaceUpdateRequest,
)

router = APIRouter(tags=["Workspaces"])


def slugify(text: str) -> str:
    s = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[\s_-]+", "-", s)


@router.get("/workspaces", response_model=List[WorkspaceResponse])
async def list_user_workspaces(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(Workspace, WorkspaceMembership.role)
        .join(WorkspaceMembership, WorkspaceMembership.workspace_id == Workspace.id)
        .where(WorkspaceMembership.user_id == user.id)
        .order_by(Workspace.name)
    )
    rows = (await db.execute(q)).all()
    results = []
    for ws, role in rows:
        data = WorkspaceResponse.model_validate(ws)
        data.user_role = role
        results.append(data)
    return results


@router.post("/workspaces", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
async def create_workspace(
    payload: WorkspaceCreateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base_slug = payload.slug or slugify(payload.name)
    slug = base_slug
    # Ensure unique slug
    idx = 1
    while True:
        existing = (await db.execute(select(Workspace).where(Workspace.slug == slug))).scalar_one_or_none()
        if not existing:
            break
        slug = f"{base_slug}-{idx}"
        idx += 1

    new_ws = Workspace(
        name=payload.name,
        slug=slug,
        description=payload.description,
        created_by=user.id,
    )
    db.add(new_ws)
    await db.flush()

    membership = WorkspaceMembership(
        workspace_id=new_ws.id,
        user_id=user.id,
        role="owner",
    )
    db.add(membership)
    await db.commit()
    await db.refresh(new_ws)

    res = WorkspaceResponse.model_validate(new_ws)
    res.user_role = "owner"
    return res


@router.get("/workspaces/{id}", response_model=WorkspaceResponse)
async def get_workspace(
    id: uuid.UUID,
    membership: WorkspaceMembership = Depends(WorkspaceRoleChecker(required_role="viewer")),
    db: AsyncSession = Depends(get_db),
):
    ws = await db.get(Workspace, id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    res = WorkspaceResponse.model_validate(ws)
    res.user_role = membership.role
    return res


@router.patch("/workspaces/{id}", response_model=WorkspaceResponse)
async def update_workspace(
    id: uuid.UUID,
    payload: WorkspaceUpdateRequest,
    membership: WorkspaceMembership = Depends(WorkspaceRoleChecker(required_role="editor")),
    db: AsyncSession = Depends(get_db),
):
    ws = await db.get(Workspace, id)
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")

    if payload.name is not None:
        ws.name = payload.name
    if payload.description is not None:
        ws.description = payload.description

    await db.commit()
    await db.refresh(ws)
    res = WorkspaceResponse.model_validate(ws)
    res.user_role = membership.role
    return res


@router.get("/workspaces/{id}/members", response_model=List[WorkspaceMemberResponse])
async def list_workspace_members(
    id: uuid.UUID,
    membership: WorkspaceMembership = Depends(WorkspaceRoleChecker(required_role="viewer")),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(WorkspaceMembership, User)
        .join(User, User.id == WorkspaceMembership.user_id)
        .where(WorkspaceMembership.workspace_id == id)
        .order_by(WorkspaceMembership.joined_at)
    )
    rows = (await db.execute(q)).all()
    results = []
    for mem, usr in rows:
        m_res = WorkspaceMemberResponse.model_validate(mem)
        m_res.user = UserResponse.model_validate(usr)
        results.append(m_res)
    return results


@router.post("/workspaces/{id}/members", response_model=WorkspaceMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_workspace_member(
    id: uuid.UUID,
    payload: WorkspaceMemberAddRequest,
    membership: WorkspaceMembership = Depends(WorkspaceRoleChecker(required_role="owner")),
    db: AsyncSession = Depends(get_db),
):
    user_q = select(User).where(User.email == payload.email.lower())
    target_user = (await db.execute(user_q)).scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User with that email address not found")

    existing_m = (
        await db.execute(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == id,
                WorkspaceMembership.user_id == target_user.id,
            )
        )
    ).scalar_one_or_none()
    if existing_m:
        raise HTTPException(status_code=400, detail="User is already a member of this workspace")

    new_mem = WorkspaceMembership(
        workspace_id=id,
        user_id=target_user.id,
        role=payload.role.lower(),
    )
    db.add(new_mem)
    await db.commit()
    await db.refresh(new_mem)

    res = WorkspaceMemberResponse.model_validate(new_mem)
    res.user = UserResponse.model_validate(target_user)
    return res


@router.patch("/workspaces/{id}/members/{user_id}", response_model=WorkspaceMemberResponse)
async def update_member_role(
    id: uuid.UUID,
    user_id: uuid.UUID,
    payload: WorkspaceMemberUpdateRequest,
    membership: WorkspaceMembership = Depends(WorkspaceRoleChecker(required_role="owner")),
    db: AsyncSession = Depends(get_db),
):
    mem_q = select(WorkspaceMembership).where(
        WorkspaceMembership.workspace_id == id,
        WorkspaceMembership.user_id == user_id,
    )
    target_m = (await db.execute(mem_q)).scalar_one_or_none()
    if not target_m:
        raise HTTPException(status_code=404, detail="Membership not found")

    target_m.role = payload.role.lower()
    await db.commit()
    await db.refresh(target_m)

    target_user = await db.get(User, user_id)
    res = WorkspaceMemberResponse.model_validate(target_m)
    if target_user:
        res.user = UserResponse.model_validate(target_user)
    return res


@router.delete("/workspaces/{id}/members/{user_id}")
async def remove_workspace_member(
    id: uuid.UUID,
    user_id: uuid.UUID,
    membership: WorkspaceMembership = Depends(WorkspaceRoleChecker(required_role="owner")),
    db: AsyncSession = Depends(get_db),
):
    # Cannot remove workspace creator or only owner
    ws = await db.get(Workspace, id)
    if ws and ws.created_by == user_id:
        raise HTTPException(status_code=400, detail="Cannot remove workspace creator")

    del_q = delete(WorkspaceMembership).where(
        WorkspaceMembership.workspace_id == id,
        WorkspaceMembership.user_id == user_id,
    )
    res = await db.execute(del_q)
    if res.rowcount == 0:
        raise HTTPException(status_code=404, detail="Member not found")

    await db.commit()
    return {"message": "Member removed successfully"}
