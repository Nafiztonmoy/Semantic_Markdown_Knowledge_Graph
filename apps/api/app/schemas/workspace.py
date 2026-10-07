import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from apps.api.app.schemas.auth import UserResponse


class WorkspaceCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    slug: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None


class WorkspaceUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=100)
    description: Optional[str] = None


class WorkspaceResponse(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    description: Optional[str] = None
    created_by: uuid.UUID
    created_at: datetime
    updated_at: datetime
    user_role: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class WorkspaceMemberResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    user_id: uuid.UUID
    role: str
    joined_at: datetime
    user: Optional[UserResponse] = None

    model_config = ConfigDict(from_attributes=True)


class WorkspaceMemberAddRequest(BaseModel):
    email: str
    role: str = Field(..., pattern="^(owner|editor|viewer)$")


class WorkspaceMemberUpdateRequest(BaseModel):
    role: str = Field(..., pattern="^(owner|editor|viewer)$")
