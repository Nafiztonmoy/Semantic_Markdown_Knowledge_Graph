from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class GraphNode(BaseModel):
    id: str
    label: str
    type: str  # "document", "tag", "unresolved"
    slug: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    document_id: Optional[str] = None
    section_count: int = 0
    updated_at: Optional[str] = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str  # "wiki_link", "shared_tag", "semantic_similarity"
    score: float = 1.0
    label: Optional[str] = None
    explainability: Optional[str] = None


class GraphFilterParams(BaseModel):
    include_tags: bool = True
    include_wiki_links: bool = True
    include_semantic_edges: bool = True
    min_similarity: float = 0.65
    selected_tag: Optional[str] = None
    search_query: Optional[str] = None
    limit: int = 150


class GraphResponse(BaseModel):
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    total_nodes: int
    total_edges: int
    applied_filters: Dict[str, Any]
