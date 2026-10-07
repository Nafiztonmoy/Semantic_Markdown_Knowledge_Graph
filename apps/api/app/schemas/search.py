import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=1000)
    mode: str = Field("all", pattern="^(all|keyword|semantic)$")
    tags: Optional[List[str]] = None
    status: Optional[str] = None
    limit: int = Field(20, ge=1, le=100)
    offset: int = Field(0, ge=0)


class SearchResultItem(BaseModel):
    document_id: uuid.UUID
    section_id: Optional[uuid.UUID] = None
    title: str
    slug: str
    heading_path: str
    heading_level: int
    snippet: str
    tags: List[str] = Field(default_factory=list)
    score: float
    keyword_rank: Optional[int] = None
    semantic_rank: Optional[int] = None
    relevance_explanation: str
    updated_at: datetime


class SearchResponse(BaseModel):
    query: str
    mode: str
    total: int
    limit: int
    offset: int
    items: List[SearchResultItem]
