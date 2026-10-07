import uuid
from typing import Dict, List, Optional
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.app.models.entities import (
    DocumentTag,
    Tag,
)
from apps.api.app.schemas.search import SearchResultItem
from apps.api.app.services.embedding_service import get_embedding_provider


def compute_rrf_score(keyword_rank: Optional[int], semantic_rank: Optional[int], k: int = 60) -> float:
    score = 0.0
    if keyword_rank is not None:
        score += 1.0 / (k + keyword_rank)
    if semantic_rank is not None:
        score += 1.0 / (k + semantic_rank)
    return score


class HybridSearchService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.embedder = get_embedding_provider()

    async def search(
        self,
        workspace_id: uuid.UUID,
        query: str,
        mode: str = "all",  # "all", "keyword", "semantic"
        tags: Optional[List[str]] = None,
        status: Optional[str] = "published",
        limit: int = 20,
        offset: int = 0,
    ) -> List[SearchResultItem]:
        clean_query = query.strip()
        if not clean_query:
            return []

        keyword_ranks: Dict[uuid.UUID, int] = {}
        semantic_ranks: Dict[uuid.UUID, int] = {}
        section_data: Dict[uuid.UUID, Dict] = {}

        # 1. Keyword search (PostgreSQL FTS)
        if mode in ("all", "keyword"):
            fts_sql = text("""
                SELECT 
                    s.id AS section_id,
                    d.id AS document_id,
                    d.title AS doc_title,
                    d.slug AS doc_slug,
                    d.updated_at AS doc_updated_at,
                    s.heading_path,
                    s.heading_level,
                    s.content_text,
                    ts_rank_cd(
                        to_tsvector('english', d.title || ' ' || s.heading_path || ' ' || s.content_text),
                        plainto_tsquery('english', :query)
                    ) AS rank_score,
                    ts_headline('english', s.content_text, plainto_tsquery('english', :query), 
                                'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15') AS headline
                FROM document_sections s
                JOIN documents d ON d.id = s.document_id
                WHERE d.workspace_id = :workspace_id
                  AND d.deleted_at IS NULL
                  AND (cast(:status as varchar) IS NULL OR d.status = cast(:status as varchar))
                  AND to_tsvector('english', d.title || ' ' || s.heading_path || ' ' || s.content_text) @@ plainto_tsquery('english', :query)
                ORDER BY rank_score DESC
                LIMIT 50;
            """)

            fts_res = await self.db.execute(
                fts_sql,
                {"workspace_id": workspace_id, "query": clean_query, "status": status},
            )
            rows = fts_res.mappings().all()

            for rank_idx, row in enumerate(rows, start=1):
                sec_id = row["section_id"]
                keyword_ranks[sec_id] = rank_idx
                if sec_id not in section_data:
                    section_data[sec_id] = {
                        "section_id": sec_id,
                        "document_id": row["document_id"],
                        "title": row["doc_title"],
                        "slug": row["doc_slug"],
                        "heading_path": row["heading_path"],
                        "heading_level": row["heading_level"],
                        "content_text": row["content_text"],
                        "snippet": row["headline"] or row["content_text"][:200] + "...",
                        "updated_at": row["doc_updated_at"],
                    }

        # 2. Semantic search (pgvector cosine distance)
        if mode in ("all", "semantic"):
            query_embedding = await self.embedder.embed_query(clean_query)
            # Embedding string format for pgvector: '[0.1, 0.2, ...]'
            embedding_str = "[" + ",".join(str(f) for f in query_embedding) + "]"

            sem_sql = text("""
                SELECT 
                    s.id AS section_id,
                    d.id AS document_id,
                    d.title AS doc_title,
                    d.slug AS doc_slug,
                    d.updated_at AS doc_updated_at,
                    s.heading_path,
                    s.heading_level,
                    s.content_text,
                    (e.embedding <=> :embedding) AS distance
                FROM embedding_records e
                JOIN document_sections s ON s.id = e.section_id
                JOIN documents d ON d.id = s.document_id
                WHERE d.workspace_id = :workspace_id
                  AND d.deleted_at IS NULL
                  AND (cast(:status as varchar) IS NULL OR d.status = cast(:status as varchar))
                ORDER BY distance ASC
                LIMIT 50;
            """)

            sem_res = await self.db.execute(
                sem_sql,
                {
                    "workspace_id": workspace_id,
                    "embedding": embedding_str,
                    "status": status,
                },
            )
            rows = sem_res.mappings().all()

            for rank_idx, row in enumerate(rows, start=1):
                sec_id = row["section_id"]
                semantic_ranks[sec_id] = rank_idx
                if sec_id not in section_data:
                    content = row["content_text"]
                    snippet = content[:200] + ("..." if len(content) > 200 else "")
                    section_data[sec_id] = {
                        "section_id": sec_id,
                        "document_id": row["document_id"],
                        "title": row["doc_title"],
                        "slug": row["doc_slug"],
                        "heading_path": row["heading_path"],
                        "heading_level": row["heading_level"],
                        "content_text": row["content_text"],
                        "snippet": snippet,
                        "updated_at": row["doc_updated_at"],
                    }

        # Collect all unique section IDs
        candidate_ids = set(keyword_ranks.keys()) | set(semantic_ranks.keys())
        if not candidate_ids:
            return []

        # Fetch tags for all candidate documents in one query
        doc_ids = list({section_data[s]["document_id"] for s in candidate_ids})
        tags_query = (
            select(DocumentTag.document_id, Tag.name)
            .join(Tag, Tag.id == DocumentTag.tag_id)
            .where(DocumentTag.document_id.in_(doc_ids))
        )
        tag_res = await self.db.execute(tags_query)
        doc_tags_map: Dict[uuid.UUID, List[str]] = {}
        for row in tag_res.all():
            doc_tags_map.setdefault(row[0], []).append(row[1])

        # Filter by tags if tag filter provided
        if tags:
            tag_set = {t.lower() for t in tags}
            candidate_ids = {
                s
                for s in candidate_ids
                if any(t.lower() in tag_set for t in doc_tags_map.get(section_data[s]["document_id"], []))
            }

        # Compute RRF score & construct items
        results: List[SearchResultItem] = []
        for s_id in candidate_ids:
            item_info = section_data[s_id]
            k_rank = keyword_ranks.get(s_id)
            s_rank = semantic_ranks.get(s_id)

            if mode == "keyword" and k_rank is None:
                continue
            if mode == "semantic" and s_rank is None:
                continue

            score = compute_rrf_score(k_rank, s_rank)

            # Build human explainability text
            explanations = []
            if k_rank is not None:
                explanations.append(f"Keyword match #{k_rank}")
            if s_rank is not None:
                explanations.append(f"Semantic similarity match #{s_rank}")
            explanation = " + ".join(explanations) if explanations else "Matched query"

            results.append(
                SearchResultItem(
                    document_id=item_info["document_id"],
                    section_id=s_id,
                    title=item_info["title"],
                    slug=item_info["slug"],
                    heading_path=item_info["heading_path"],
                    heading_level=item_info["heading_level"],
                    snippet=item_info["snippet"],
                    tags=doc_tags_map.get(item_info["document_id"], []),
                    score=round(score, 5),
                    keyword_rank=k_rank,
                    semantic_rank=s_rank,
                    relevance_explanation=explanation,
                    updated_at=item_info["updated_at"],
                )
            )

        # Sort descending by score
        results.sort(key=lambda x: x.score, reverse=True)
        return results[offset : offset + limit]
