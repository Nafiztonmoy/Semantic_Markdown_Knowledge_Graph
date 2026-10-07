import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


class TagResponse(BaseModel):
    id: uuid.UUID
    name: str
    color: str

    model_config = ConfigDict(from_attributes=True)


class DocumentSectionResponse(BaseModel):
    id: uuid.UUID
    heading_path: str
    heading_level: int
    ordinal: int
    content_text: str
    token_count: int
    content_hash: str

    model_config = ConfigDict(from_attributes=True)


class DocumentRevisionResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    title: str
    markdown: str
    version_number: int
    created_by: Optional[uuid.UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentLinkResponse(BaseModel):
    id: uuid.UUID
    source_document_id: uuid.UUID
    target_document_id: Optional[uuid.UUID] = None
    raw_target_title: str
    target_heading: Optional[str] = None
    target_title: Optional[str] = None
    target_slug: Optional[str] = None
    is_resolved: bool = True

    model_config = ConfigDict(from_attributes=True)


class DocumentCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    markdown: str
    tags: List[str] = Field(default_factory=list)


class DocumentUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    markdown: Optional[str] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None


class DocumentResponse(BaseModel):
    id: uuid.UUID
    workspace_id: uuid.UUID
    title: str
    slug: str
    status: str
    version_number: int
    created_by: Optional[uuid.UUID] = None
    updated_by: Optional[uuid.UUID] = None
    created_at: datetime
    updated_at: datetime
    tags: List[TagResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class DocumentDetailResponse(DocumentResponse):
    markdown: str
    plain_text: str
    sections: List[DocumentSectionResponse] = Field(default_factory=list)
    revisions_count: int = 0
    outgoing_links: List[DocumentLinkResponse] = Field(default_factory=list)
    backlinks: List[DocumentLinkResponse] = Field(default_factory=list)
    related_documents: List["RelatedDocumentItem"] = Field(default_factory=list)


class RelatedDocumentItem(BaseModel):
    id: uuid.UUID
    title: str
    slug: str
    score: float
    relation_type: str
    matched_sections: Optional[str] = None


class MarkdownImportResult(BaseModel):
    filename: str
    title: str
    document_id: Optional[uuid.UUID] = None
    status: str  # "success" or "error"
    error: Optional[str] = None


class MarkdownBatchImportResponse(BaseModel):
    total: int
    succeeded: int
    failed: int
    results: List[MarkdownImportResult]
    job_id: Optional[uuid.UUID] = None
