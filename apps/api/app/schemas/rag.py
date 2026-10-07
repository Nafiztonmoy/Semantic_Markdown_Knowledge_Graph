import uuid
from typing import Dict, List, Optional
from pydantic import BaseModel, Field


class Citation(BaseModel):
    document_id: uuid.UUID
    document_title: str
    heading_path: str
    section_id: uuid.UUID
    excerpt: str
    deep_link: str


class RetrievalMetadata(BaseModel):
    query: str
    provider: str
    model: str
    latency_ms: float
    sections_considered: int
    token_usage: Optional[Dict[str, int]] = None


class AskRequest(BaseModel):
    question: str = Field(..., min_length=2, max_length=2000)
    conversation_id: Optional[uuid.UUID] = None
    document_ids: Optional[List[uuid.UUID]] = None
    tags: Optional[List[str]] = None


class AskResponse(BaseModel):
    answer: str
    citations: List[Citation]
    retrieval_metadata: RetrievalMetadata
    provider_status: str  # "active", "disabled_no_key"
    fallback_search_query: Optional[str] = None
