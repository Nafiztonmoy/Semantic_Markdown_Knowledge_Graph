import re
import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.app.api.deps import WorkspaceRoleChecker, get_current_user
from apps.api.app.core.database import get_db
from apps.api.app.models.entities import (
    Document,
    DocumentLink,
    DocumentRevision,
    DocumentSection,
    DocumentTag,
    SemanticEdge,
    Tag,
    User,
    WorkspaceMembership,
)
from apps.api.app.schemas.document import (
    DocumentCreateRequest,
    DocumentDetailResponse,
    DocumentLinkResponse,
    DocumentResponse,
    DocumentRevisionResponse,
    DocumentSectionResponse,
    DocumentUpdateRequest,
    MarkdownBatchImportResponse,
    MarkdownImportResult,
    RelatedDocumentItem,
    TagResponse,
)
from apps.api.app.services.markdown_parser import extract_plain_text
from apps.api.app.services.worker import dispatch_job

router = APIRouter(tags=["Documents"])


def slugify(text: str) -> str:
    s = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[\s_-]+", "-", s)


async def sync_document_tags(db: AsyncSession, doc: Document, tag_names: List[str]):
    # Delete current tags
    await db.execute(delete(DocumentTag).where(DocumentTag.document_id == doc.id))
    for t_name in tag_names:
        clean_name = t_name.strip().lower()
        if not clean_name:
            continue
        # Find or create tag
        t_stmt = select(Tag).where(Tag.workspace_id == doc.workspace_id, Tag.name == clean_name)
        tag_obj = (await db.execute(t_stmt)).scalar_one_or_none()
        if not tag_obj:
            tag_obj = Tag(workspace_id=doc.workspace_id, name=clean_name)
            db.add(tag_obj)
            await db.flush()

        doc_tag = DocumentTag(document_id=doc.id, tag_id=tag_obj.id)
        db.add(doc_tag)


@router.get("/workspaces/{id}/documents", response_model=List[DocumentResponse])
async def list_documents(
    id: uuid.UUID,
    include_deleted: bool = False,
    tag: Optional[str] = None,
    search: Optional[str] = None,
    membership: WorkspaceMembership = Depends(WorkspaceRoleChecker(required_role="viewer")),
    db: AsyncSession = Depends(get_db),
):
    q = select(Document).where(Document.workspace_id == id)
    if not include_deleted:
        q = q.where(Document.deleted_at.is_(None))
    if search:
        q = q.where(Document.title.ilike(f"%{search}%"))

    q = q.order_by(Document.updated_at.desc())
    docs = (await db.execute(q)).scalars().all()

    # Load tags for all docs
    doc_ids = [d.id for d in docs]
    tag_map = {}
    if doc_ids:
        tq = (
            select(DocumentTag.document_id, Tag)
            .join(Tag, Tag.id == DocumentTag.tag_id)
            .where(DocumentTag.document_id.in_(doc_ids))
        )
        for d_id, tag_obj in (await db.execute(tq)).all():
            tag_map.setdefault(d_id, []).append(TagResponse.model_validate(tag_obj))

    results = []
    for d in docs:
        d_tags = tag_map.get(d.id, [])
        if tag and not any(t.name.lower() == tag.lower() for t in d_tags):
            continue
        resp = DocumentResponse(
            id=d.id,
            workspace_id=d.workspace_id,
            title=d.title,
            slug=d.slug,
            status=d.status,
            version_number=d.version_number,
            created_by=d.created_by,
            updated_by=d.updated_by,
            created_at=d.created_at,
            updated_at=d.updated_at,
            tags=d_tags,
        )
        results.append(resp)
    return results


@router.post("/workspaces/{id}/documents", response_model=DocumentDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    id: uuid.UUID,
    payload: DocumentCreateRequest,
    user: User = Depends(get_current_user),
    membership: WorkspaceMembership = Depends(WorkspaceRoleChecker(required_role="editor")),
    db: AsyncSession = Depends(get_db),
):
    base_slug = slugify(payload.title) or "untitled"
    slug = base_slug
    idx = 1
    while True:
        existing = (
            await db.execute(
                select(Document).where(
                    Document.workspace_id == id,
                    Document.slug == slug,
                    Document.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()
        if not existing:
            break
        slug = f"{base_slug}-{idx}"
        idx += 1

    plain = extract_plain_text(payload.markdown)

    new_doc = Document(
        workspace_id=id,
        title=payload.title.strip(),
        slug=slug,
        markdown=payload.markdown,
        plain_text=plain,
        version_number=1,
        created_by=user.id,
        updated_by=user.id,
    )
    db.add(new_doc)
    await db.flush()

    # Save initial revision
    rev = DocumentRevision(
        document_id=new_doc.id,
        title=new_doc.title,
        markdown=new_doc.markdown,
        version_number=1,
        created_by=user.id,
    )
    db.add(rev)

    # Attach tags
    if payload.tags:
        await sync_document_tags(db, new_doc, payload.tags)

    await db.commit()
    await db.refresh(new_doc)

    # Dispatch background indexing job
    await dispatch_job(workspace_id=id, document_id=new_doc.id)

    # Return full document detail
    return await get_document_detail_by_id(db, new_doc.id)


@router.get("/documents/{id}", response_model=DocumentDetailResponse)
async def get_document(
    id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(Document, id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Verify workspace membership
    mem = (
        await db.execute(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == doc.workspace_id,
                WorkspaceMembership.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not mem:
        raise HTTPException(status_code=403, detail="Access denied to this document")

    return await get_document_detail_by_id(db, doc.id)


@router.patch("/documents/{id}", response_model=DocumentDetailResponse)
async def update_document(
    id: uuid.UUID,
    payload: DocumentUpdateRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(Document, id)
    if not doc or doc.deleted_at is not None:
        raise HTTPException(status_code=404, detail="Document not found")

    # Check editor permission
    mem = (
        await db.execute(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == doc.workspace_id,
                WorkspaceMembership.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not mem or mem.role.lower() not in ("owner", "editor"):
        raise HTTPException(status_code=403, detail="Editor permissions required")

    changed_content = False
    if payload.title is not None and payload.title != doc.title:
        doc.title = payload.title
        changed_content = True

    if payload.markdown is not None and payload.markdown != doc.markdown:
        doc.markdown = payload.markdown
        doc.plain_text = extract_plain_text(payload.markdown)
        changed_content = True

    if payload.status is not None:
        doc.status = payload.status

    if payload.tags is not None:
        await sync_document_tags(db, doc, payload.tags)

    if changed_content:
        doc.version_number += 1
        doc.updated_by = user.id
        doc.updated_at = datetime.now(timezone.utc)

        # Snapshot new revision
        rev = DocumentRevision(
            document_id=doc.id,
            title=doc.title,
            markdown=doc.markdown,
            version_number=doc.version_number,
            created_by=user.id,
        )
        db.add(rev)

    await db.commit()
    await db.refresh(doc)

    if changed_content:
        await dispatch_job(workspace_id=doc.workspace_id, document_id=doc.id)

    return await get_document_detail_by_id(db, doc.id)


@router.delete("/documents/{id}")
async def delete_document(
    id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(Document, id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    mem = (
        await db.execute(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == doc.workspace_id,
                WorkspaceMembership.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not mem or mem.role.lower() not in ("owner", "editor"):
        raise HTTPException(status_code=403, detail="Editor permissions required")

    doc.deleted_at = datetime.now(timezone.utc)
    # Remove semantic edges
    del_edges = delete(SemanticEdge).where(
        (SemanticEdge.source_document_id == id) | (SemanticEdge.target_document_id == id)
    )
    await db.execute(del_edges)
    await db.commit()
    return {"message": "Document soft deleted successfully"}


@router.post("/documents/{id}/restore", response_model=DocumentResponse)
async def restore_document(
    id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(Document, id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    mem = (
        await db.execute(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == doc.workspace_id,
                WorkspaceMembership.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not mem or mem.role.lower() not in ("owner", "editor"):
        raise HTTPException(status_code=403, detail="Editor permissions required")

    doc.deleted_at = None
    await db.commit()
    await db.refresh(doc)

    await dispatch_job(workspace_id=doc.workspace_id, document_id=doc.id)
    return DocumentResponse(
        id=doc.id,
        workspace_id=doc.workspace_id,
        title=doc.title,
        slug=doc.slug,
        status=doc.status,
        version_number=doc.version_number,
        created_by=doc.created_by,
        updated_by=doc.updated_by,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        tags=[],
    )


@router.get("/documents/{id}/revisions", response_model=List[DocumentRevisionResponse])
async def list_document_revisions(
    id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(Document, id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    mem = (
        await db.execute(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == doc.workspace_id,
                WorkspaceMembership.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not mem:
        raise HTTPException(status_code=403, detail="Access denied")

    q = (
        select(DocumentRevision)
        .where(DocumentRevision.document_id == id)
        .order_by(DocumentRevision.version_number.desc())
    )
    revs = (await db.execute(q)).scalars().all()
    return [DocumentRevisionResponse.model_validate(r) for r in revs]


@router.post("/documents/{id}/revisions/{revision_id}/restore", response_model=DocumentDetailResponse)
async def restore_document_revision(
    id: uuid.UUID,
    revision_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    doc = await db.get(Document, id)
    rev = await db.get(DocumentRevision, revision_id)
    if not doc or not rev or rev.document_id != id:
        raise HTTPException(status_code=404, detail="Revision or Document not found")

    mem = (
        await db.execute(
            select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == doc.workspace_id,
                WorkspaceMembership.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if not mem or mem.role.lower() not in ("owner", "editor"):
        raise HTTPException(status_code=403, detail="Editor permissions required")

    doc.title = rev.title
    doc.markdown = rev.markdown
    doc.plain_text = extract_plain_text(rev.markdown)
    doc.version_number += 1
    doc.updated_by = user.id
    doc.updated_at = datetime.now(timezone.utc)

    # Save snapshot of restoration
    new_rev = DocumentRevision(
        document_id=doc.id,
        title=doc.title,
        markdown=doc.markdown,
        version_number=doc.version_number,
        created_by=user.id,
    )
    db.add(new_rev)
    await db.commit()

    await dispatch_job(workspace_id=doc.workspace_id, document_id=doc.id)
    return await get_document_detail_by_id(db, doc.id)


@router.post("/workspaces/{id}/imports/markdown", response_model=MarkdownBatchImportResponse)
async def import_markdown_files(
    id: uuid.UUID,
    files: List[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    membership: WorkspaceMembership = Depends(WorkspaceRoleChecker(required_role="editor")),
    db: AsyncSession = Depends(get_db),
):
    results: List[MarkdownImportResult] = []
    created_docs = []

    for f in files:
        filename = f.filename or "untitled.md"
        if not filename.endswith((".md", ".markdown", ".txt")):
            results.append(
                MarkdownImportResult(
                    filename=filename,
                    title=filename,
                    status="error",
                    error="Only Markdown (.md, .markdown, .txt) files are supported",
                )
            )
            continue

        try:
            content_bytes = await f.read()
            text = content_bytes.decode("utf-8")
        except Exception:
            results.append(
                MarkdownImportResult(
                    filename=filename,
                    title=filename,
                    status="error",
                    error="Failed to decode file as UTF-8 text",
                )
            )
            continue

        # Infer title from first # heading or filename
        title = filename.rsplit(".", 1)[0].replace("-", " ").replace("_", " ").title()
        for line in text.splitlines():
            line_str = line.strip()
            if line_str.startswith("# "):
                title = line_str[2:].strip()
                break

        base_slug = slugify(title) or "imported-doc"
        slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"

        plain = extract_plain_text(text)

        new_doc = Document(
            workspace_id=id,
            title=title,
            slug=slug,
            markdown=text,
            plain_text=plain,
            version_number=1,
            created_by=user.id,
            updated_by=user.id,
        )
        db.add(new_doc)
        await db.flush()

        rev = DocumentRevision(
            document_id=new_doc.id,
            title=new_doc.title,
            markdown=new_doc.markdown,
            version_number=1,
            created_by=user.id,
        )
        db.add(rev)
        created_docs.append(new_doc)

        results.append(
            MarkdownImportResult(
                filename=filename,
                title=title,
                document_id=new_doc.id,
                status="success",
            )
        )

    await db.commit()

    # Dispatch indexing jobs for all imported documents
    for doc in created_docs:
        await dispatch_job(workspace_id=id, document_id=doc.id)

    succeeded = sum(1 for r in results if r.status == "success")
    failed = len(results) - succeeded

    return MarkdownBatchImportResponse(
        total=len(results),
        succeeded=succeeded,
        failed=failed,
        results=results,
    )


async def get_document_detail_by_id(db: AsyncSession, doc_id: uuid.UUID) -> DocumentDetailResponse:
    doc = await db.get(Document, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Tags
    tq = select(Tag).join(DocumentTag, DocumentTag.tag_id == Tag.id).where(DocumentTag.document_id == doc_id)
    tags = [TagResponse.model_validate(t) for t in (await db.execute(tq)).scalars().all()]

    # Sections
    sq = select(DocumentSection).where(DocumentSection.document_id == doc_id).order_by(DocumentSection.ordinal)
    sections = [DocumentSectionResponse.model_validate(s) for s in (await db.execute(sq)).scalars().all()]

    # Revisions count
    rq = select(DocumentRevision.id).where(DocumentRevision.document_id == doc_id)
    rev_count = len((await db.execute(rq)).scalars().all())

    # Outgoing links
    out_q = (
        select(DocumentLink, Document.title, Document.slug)
        .outerjoin(Document, Document.id == DocumentLink.target_document_id)
        .where(DocumentLink.source_document_id == doc_id)
    )
    outgoing_links = []
    for link, target_title, target_slug in (await db.execute(out_q)).all():
        resp = DocumentLinkResponse.model_validate(link)
        resp.target_title = target_title
        resp.target_slug = target_slug
        resp.is_resolved = link.target_document_id is not None
        outgoing_links.append(resp)

    # Backlinks (incoming links)
    in_q = (
        select(DocumentLink, Document.title, Document.slug)
        .join(Document, Document.id == DocumentLink.source_document_id)
        .where(DocumentLink.target_document_id == doc_id)
    )
    backlinks = []
    for link, src_title, src_slug in (await db.execute(in_q)).all():
        resp = DocumentLinkResponse.model_validate(link)
        resp.target_title = src_title
        resp.target_slug = src_slug
        outgoing_links.append(resp)

    # Related documents from semantic edges
    rel_q = (
        select(SemanticEdge, Document)
        .join(Document, Document.id == SemanticEdge.target_document_id)
        .where(
            SemanticEdge.source_document_id == doc_id,
            Document.deleted_at.is_(None),
        )
        .order_by(SemanticEdge.score.desc())
        .limit(5)
    )
    related = []
    for edge, r_doc in (await db.execute(rel_q)).all():
        related.append(
            RelatedDocumentItem(
                id=r_doc.id,
                title=r_doc.title,
                slug=r_doc.slug,
                score=edge.score,
                relation_type=edge.relation_type,
                matched_sections=edge.matched_sections,
            )
        )

    res = DocumentDetailResponse(
        id=doc.id,
        workspace_id=doc.workspace_id,
        title=doc.title,
        slug=doc.slug,
        markdown=doc.markdown,
        plain_text=doc.plain_text,
        status=doc.status,
        version_number=doc.version_number,
        created_by=doc.created_by,
        updated_by=doc.updated_by,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        tags=tags,
        sections=sections,
        revisions_count=rev_count,
        outgoing_links=outgoing_links,
        backlinks=backlinks,
        related_documents=related,
    )
    return res
