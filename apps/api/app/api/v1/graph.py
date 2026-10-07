import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.app.api.deps import WorkspaceRoleChecker
from apps.api.app.core.database import get_db
from apps.api.app.models.entities import WorkspaceMembership
from apps.api.app.schemas.graph import GraphResponse
from apps.api.app.services.graph_service import KnowledgeGraphService

router = APIRouter(tags=["Knowledge Graph"])


@router.get("/workspaces/{id}/graph", response_model=GraphResponse)
async def get_workspace_graph(
    id: uuid.UUID,
    include_tags: bool = Query(True),
    include_wiki_links: bool = Query(True),
    include_semantic_edges: bool = Query(True),
    min_similarity: float = Query(0.65, ge=0.0, le=1.0),
    selected_tag: Optional[str] = Query(None),
    limit: int = Query(150, ge=1, le=500),
    membership: WorkspaceMembership = Depends(WorkspaceRoleChecker(required_role="viewer")),
    db: AsyncSession = Depends(get_db),
):
    graph_service = KnowledgeGraphService(db)
    return await graph_service.get_workspace_graph(
        workspace_id=id,
        include_tags=include_tags,
        include_wiki_links=include_wiki_links,
        include_semantic_edges=include_semantic_edges,
        min_similarity=min_similarity,
        selected_tag=selected_tag,
        limit=limit,
    )
