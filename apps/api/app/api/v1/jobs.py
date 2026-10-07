import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.app.api.deps import get_current_user
from apps.api.app.core.database import get_db
from apps.api.app.models.entities import IndexingJob, User
from apps.api.app.schemas.job import JobResponse

router = APIRouter(tags=["Jobs"])


@router.get("/jobs/{id}", response_model=JobResponse)
async def get_job_status(
    id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(IndexingJob, id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobResponse.model_validate(job)
