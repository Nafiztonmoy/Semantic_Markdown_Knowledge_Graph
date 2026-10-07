import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.app.api.deps import WorkspaceRoleChecker
from apps.api.app.core.database import get_db
from apps.api.app.models.entities import WorkspaceMembership
from apps.api.app.schemas.rag import AskRequest, AskResponse
from apps.api.app.services.rag_service import RAGAssistantService

router = APIRouter(tags=["RAG Assistant"])


@router.post("/workspaces/{id}/ask", response_model=AskResponse)
async def ask_workspace_question(
    id: uuid.UUID,
    payload: AskRequest,
    membership: WorkspaceMembership = Depends(WorkspaceRoleChecker(required_role="viewer")),
    db: AsyncSession = Depends(get_db),
):
    rag_service = RAGAssistantService(db)
    return await rag_service.answer_question(workspace_id=id, request=payload)
