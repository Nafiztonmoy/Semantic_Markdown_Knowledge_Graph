from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.app.core.database import get_db

router = APIRouter(tags=["Health"])


@router.get("/health/live")
async def health_live():
    return {"status": "ok", "service": "nexusdocs-api"}


@router.get("/health/ready")
async def health_ready(db: AsyncSession = Depends(get_db)):
    try:
        # Check Postgres and pgvector
        res = await db.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector';"))
        row = res.first()
        if not row:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="pgvector extension not loaded in database",
            )
        return {
            "status": "ready",
            "database": "connected",
            "pgvector": "installed",
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Database readiness check failed: {str(e)}",
        )
