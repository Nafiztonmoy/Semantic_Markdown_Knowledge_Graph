import uuid
from typing import List, Optional, Set
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.app.models.entities import (
    Document,
    DocumentLink,
    DocumentSection,
    EmbeddingRecord,
    IndexingJob,
)
from apps.api.app.services.embedding_service import get_embedding_provider
from apps.api.app.services.graph_service import KnowledgeGraphService
from apps.api.app.services.markdown_parser import (
    SectionChunk,
    parse_markdown_sections,
    parse_wiki_links,
)


class DocumentIndexer:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.embedder = get_embedding_provider()
        self.graph_service = KnowledgeGraphService(db)

    async def index_document(self, document_id: uuid.UUID, job_id: Optional[uuid.UUID] = None) -> bool:
        job = None
        if job_id:
            job = await self.db.get(IndexingJob, job_id)
            if job:
                job.status = "running"
                job.progress = 0.1
                await self.db.commit()

        try:
            # 1. Fetch document
            doc = await self.db.get(Document, document_id)
            if not doc or doc.deleted_at is not None:
                if job:
                    job.status = "succeeded"
                    job.progress = 1.0
                    await self.db.commit()
                return False

            workspace_id = doc.workspace_id

            # 2. Parse sections
            new_chunks: List[SectionChunk] = parse_markdown_sections(doc.markdown, doc.title)

            # 3. Fetch existing sections for this document
            existing_sections_q = (
                select(DocumentSection)
                .where(DocumentSection.document_id == document_id)
                .order_by(DocumentSection.ordinal)
            )
            existing_sections = (await self.db.execute(existing_sections_q)).scalars().all()
            existing_by_hash = {s.content_hash: s for s in existing_sections}

            # Map old sections to keep or replace
            updated_section_ids: Set[uuid.UUID] = set()
            sections_to_embed: List[DocumentSection] = []

            # Clean out sections that no longer match or need replacement
            for chunk in new_chunks:
                if chunk.content_hash in existing_by_hash:
                    # Content unchanged - preserve existing section and embedding!
                    sec = existing_by_hash[chunk.content_hash]
                    sec.ordinal = chunk.ordinal
                    sec.heading_path = chunk.heading_path
                    sec.heading_level = chunk.heading_level
                    sec.token_count = chunk.token_count
                    updated_section_ids.add(sec.id)
                else:
                    # New or modified section
                    new_sec = DocumentSection(
                        document_id=document_id,
                        heading_path=chunk.heading_path,
                        heading_level=chunk.heading_level,
                        ordinal=chunk.ordinal,
                        content_text=chunk.content_text,
                        token_count=chunk.token_count,
                        content_hash=chunk.content_hash,
                    )
                    self.db.add(new_sec)
                    await self.db.flush()  # Generate section ID
                    updated_section_ids.add(new_sec.id)
                    sections_to_embed.append(new_sec)

            # Delete old sections not present in new chunks
            for old_sec in existing_sections:
                if old_sec.id not in updated_section_ids:
                    await self.db.delete(old_sec)

            await self.db.commit()

            if job:
                job.progress = 0.5
                await self.db.commit()

            # 4. Generate embeddings for only new/modified sections (idempotency!)
            if sections_to_embed:
                texts = [f"{s.heading_path}\n{s.content_text}" for s in sections_to_embed]
                vectors = await self.embedder.embed_documents(texts)
                for sec, vec in zip(sections_to_embed, vectors):
                    emb_rec = EmbeddingRecord(
                        section_id=sec.id,
                        embedding=vec,
                        model_identifier=self.embedder.model_name,
                        dimensionality=self.embedder.dimension,
                        content_hash=sec.content_hash,
                    )
                    self.db.add(emb_rec)
                await self.db.commit()

            if job:
                job.progress = 0.7
                await self.db.commit()

            # 5. Extract and resolve Wiki Links
            wiki_links = parse_wiki_links(doc.markdown)

            # Remove previous links from this doc
            del_links = delete(DocumentLink).where(DocumentLink.source_document_id == document_id)
            await self.db.execute(del_links)

            # Find target document IDs in the workspace
            for wlink in wiki_links:
                # Case-insensitive title/slug match
                target_q = (
                    select(Document.id, Document.title)
                    .where(
                        Document.workspace_id == workspace_id,
                        Document.deleted_at.is_(None),
                        (Document.title.ilike(wlink.target_title)) | (Document.slug.ilike(wlink.target_title)),
                    )
                    .limit(1)
                )
                tgt_res = (await self.db.execute(target_q)).first()
                target_doc_id = tgt_res[0] if tgt_res else None

                link_rec = DocumentLink(
                    workspace_id=workspace_id,
                    source_document_id=document_id,
                    target_document_id=target_doc_id,
                    raw_target_title=wlink.target_title,
                    target_heading=wlink.target_heading,
                )
                self.db.add(link_rec)

            await self.db.commit()

            if job:
                job.progress = 0.85
                await self.db.commit()

            # 6. Recompute semantic edges for knowledge graph
            await self.graph_service.recompute_document_semantic_edges(
                workspace_id=workspace_id,
                document_id=document_id,
            )

            if job:
                job.status = "succeeded"
                job.progress = 1.0
                await self.db.commit()

            return True

        except Exception as e:
            await self.db.rollback()
            if job:
                job.status = "failed"
                job.error_message = str(e)
                await self.db.commit()
            raise e
