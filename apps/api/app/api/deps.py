import uuid
from typing import Optional
from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.app.core.database import get_db
from apps.api.app.core.security import decode_token
from apps.api.app.models.entities import User, WorkspaceMembership

ROLE_HIERARCHY = {"viewer": 1, "editor": 2, "owner": 3}


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None),
) -> User:
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    elif access_token:
        token = access_token

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_token(token)
    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    try:
        user_uuid = uuid.UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user id in token",
        )

    user = await db.get(User, user_uuid)
    if not user or user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


class WorkspaceRoleChecker:
    def __init__(self, required_role: str = "viewer"):
        self.required_role = required_role

    async def __call__(
        self,
        id: uuid.UUID,
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> WorkspaceMembership:
        q = select(WorkspaceMembership).where(
            WorkspaceMembership.workspace_id == id,
            WorkspaceMembership.user_id == user.id,
        )
        res = await db.execute(q)
        membership = res.scalar_one_or_none()

        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You are not a member of this workspace",
            )

        user_level = ROLE_HIERARCHY.get(membership.role.lower(), 0)
        required_level = ROLE_HIERARCHY.get(self.required_role.lower(), 0)

        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation requires '{self.required_role}' role or higher",
            )

        return membership
