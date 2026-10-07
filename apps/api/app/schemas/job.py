import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class JobResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    document_id: Optional[uuid.UUID] = None
    job_type: str
    status: str
    progress: float
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
