import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.app.api.deps import WorkspaceRoleChecker
from apps.api.app.core.database import get_db
from apps.api.app.models.entities import WorkspaceMembership
from apps.api.app.schemas.search import SearchResponse
from apps.api.app.services.search_service import HybridSearchService

router = APIRouter(tags=["Search"])


@router.get("/workspaces/{id}/search", response_model=SearchResponse)
async def hybrid_search(
    id: uuid.UUID,
    q: str = Query(..., min_length=1, max_length=1000),
    mode: str = Query("all", pattern="^(all|keyword|semantic)$"),
    tags: Optional[List[str]] = Query(None),
    status: Optional[str] = Query("published"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    membership: WorkspaceMembership = Depends(WorkspaceRoleChecker(required_role="viewer")),
    db: AsyncSession = Depends(get_db),
):
    search_service = HybridSearchService(db)
    items = await search_service.search(
        workspace_id=id,
        query=q,
        mode=mode,
        tags=tags,
        status=status,
        limit=limit,
        offset=offset,
    )

    return SearchResponse(
        query=q,
        mode=mode,
        total=len(items),
        limit=limit,
        offset=offset,
        items=items,
    )
