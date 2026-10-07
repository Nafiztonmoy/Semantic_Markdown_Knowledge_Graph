import json
import uuid
from typing import Dict, List, Optional, Set, Tuple
import numpy as np
from sqlalchemy import delete, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.app.models.entities import (
    Document,
    DocumentLink,
    DocumentSection,
    DocumentTag,
    EmbeddingRecord,
    SemanticEdge,
    Tag,
)
from apps.api.app.schemas.graph import GraphEdge, GraphNode, GraphResponse


class KnowledgeGraphService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_workspace_graph(
        self,
        workspace_id: uuid.UUID,
        include_tags: bool = True,
        include_wiki_links: bool = True,
        include_semantic_edges: bool = True,
        min_similarity: float = 0.65,
        selected_tag: Optional[str] = None,
        limit: int = 150,
    ) -> GraphResponse:
        nodes: Dict[str, GraphNode] = {}
        edges: List[GraphEdge] = []

        # 1. Fetch active documents in the workspace
        docs_query = (
            select(Document)
            .where(
                Document.workspace_id == workspace_id,
                Document.deleted_at.is_(None),
            )
            .limit(limit)
        )
        docs_res = await self.db.execute(docs_query)
        documents = docs_res.scalars().all()
        doc_id_set = {doc.id for doc in documents}

        # 2. Fetch tags for documents
        doc_tags_query = (
            select(DocumentTag.document_id, Tag.id, Tag.name, Tag.color)
            .join(Tag, Tag.id == DocumentTag.tag_id)
            .where(Tag.workspace_id == workspace_id)
        )
        tags_res = await self.db.execute(doc_tags_query)
        doc_to_tags: Dict[uuid.UUID, List[str]] = {}
        tag_definitions: Dict[str, Dict] = {}

        for doc_id, tag_id, tag_name, tag_color in tags_res.all():
            doc_to_tags.setdefault(doc_id, []).append(tag_name)
            tag_definitions[tag_name] = {"id": str(tag_id), "color": tag_color}

        # 3. Add Document Nodes
        for doc in documents:
            doc_tags = doc_to_tags.get(doc.id, [])
            if selected_tag and selected_tag not in doc_tags:
                continue

            node_id = f"doc_{doc.id}"
            nodes[node_id] = GraphNode(
                id=node_id,
                label=doc.title,
                type="document",
                slug=doc.slug,
                tags=doc_tags,
                document_id=str(doc.id),
                updated_at=doc.updated_at.isoformat(),
            )

        # 4. Add Tag Nodes & Shared Tag Edges
        if include_tags:
            for tag_name, tag_data in tag_definitions.items():
                if selected_tag and selected_tag != tag_name:
                    continue
                tag_node_id = f"tag_{tag_name}"
                nodes[tag_node_id] = GraphNode(
                    id=tag_node_id,
                    label=f"#{tag_name}",
                    type="tag",
                    tags=[tag_name],
                )

            # Link documents to tag nodes
            for doc_id, tags_list in doc_to_tags.items():
                doc_node_id = f"doc_{doc_id}"
                if doc_node_id in nodes:
                    for tag_name in tags_list:
                        tag_node_id = f"tag_{tag_name}"
                        if tag_node_id in nodes:
                            edges.append(
                                GraphEdge(
                                    id=f"edge_tag_{doc_id}_{tag_name}",
                                    source=doc_node_id,
                                    target=tag_node_id,
                                    type="shared_tag",
                                    score=1.0,
                                    label="tagged",
                                )
                            )

        # 5. Add Explicit Wiki Link Edges
        if include_wiki_links:
            links_query = select(DocumentLink).where(
                DocumentLink.workspace_id == workspace_id,
                DocumentLink.source_document_id.in_(doc_id_set),
            )
            links_res = await self.db.execute(links_query)
            links = links_res.scalars().all()

            for link in links:
                src_id = f"doc_{link.source_document_id}"
                if src_id not in nodes:
                    continue

                if link.target_document_id and link.target_document_id in doc_id_set:
                    tgt_id = f"doc_{link.target_document_id}"
                    if tgt_id in nodes:
                        edges.append(
                            GraphEdge(
                                id=f"edge_wiki_{link.id}",
                                source=src_id,
                                target=tgt_id,
                                type="wiki_link",
                                score=1.0,
                                label=link.target_heading or "links to",
                            )
                        )
                else:
                    # Unresolved wiki link node
                    unresolved_node_id = f"unresolved_{link.raw_target_title.lower().replace(' ', '_')}"
                    if unresolved_node_id not in nodes:
                        nodes[unresolved_node_id] = GraphNode(
                            id=unresolved_node_id,
                            label=f"[[{link.raw_target_title}]] (broken)",
                            type="unresolved",
                        )
                    edges.append(
                        GraphEdge(
                            id=f"edge_wiki_broken_{link.id}",
                            source=src_id,
                            target=unresolved_node_id,
                            type="wiki_link",
                            score=0.5,
                            label="unresolved link",
                        )
                    )

        # 6. Add Semantic Edges
        if include_semantic_edges:
            edges_query = select(SemanticEdge).where(
                SemanticEdge.workspace_id == workspace_id,
                SemanticEdge.score >= min_similarity,
                SemanticEdge.source_document_id.in_(doc_id_set),
                SemanticEdge.target_document_id.in_(doc_id_set),
            )
            edges_res = await self.db.execute(edges_query)
            semantic_edges = edges_res.scalars().all()

            seen_pairs: Set[Tuple[str, str]] = set()
            for edge in semantic_edges:
                src_id = f"doc_{edge.source_document_id}"
                tgt_id = f"doc_{edge.target_document_id}"

                if src_id in nodes and tgt_id in nodes:
                    pair_key = tuple(sorted([src_id, tgt_id]))
                    if pair_key in seen_pairs:
                        continue
                    seen_pairs.add(pair_key)

                    edges.append(
                        GraphEdge(
                            id=f"edge_sem_{edge.id}",
                            source=src_id,
                            target=tgt_id,
                            type="semantic_similarity",
                            score=round(edge.score, 3),
                            label=f"{int(edge.score * 100)}% match",
                            explainability=edge.matched_sections,
                        )
                    )

        return GraphResponse(
            nodes=list(nodes.values()),
            edges=edges,
            total_nodes=len(nodes),
            total_edges=len(edges),
            applied_filters={
                "include_tags": include_tags,
                "include_wiki_links": include_wiki_links,
                "include_semantic_edges": include_semantic_edges,
                "min_similarity": min_similarity,
                "selected_tag": selected_tag,
            },
        )

    async def recompute_document_semantic_edges(
        self,
        workspace_id: uuid.UUID,
        document_id: uuid.UUID,
        threshold: float = 0.65,
        max_neighbors: int = 5,
    ) -> int:
        """
        Calculates document-to-document cosine similarity based on average section vectors,
        upserts top-K semantic edges exceeding threshold, and deletes stale edges.
        """
        # Fetch section embeddings for the target document
        target_sections_query = (
            select(DocumentSection.heading_path, EmbeddingRecord.embedding)
            .join(EmbeddingRecord, EmbeddingRecord.section_id == DocumentSection.id)
            .where(DocumentSection.document_id == document_id)
        )
        target_res = await self.db.execute(target_sections_query)
        target_rows = target_res.all()
        if not target_rows:
            return 0

        # Compute centroid embedding of target document
        target_vectors = [np.array(row[1], dtype=np.float32) for row in target_rows]
        centroid = np.mean(target_vectors, axis=0)
        norm = np.linalg.norm(centroid)
        if norm > 0:
            centroid = centroid / norm
        target_vec_str = "[" + ",".join(str(f) for f in centroid.tolist()) + "]"

        # Find top matching documents in same workspace
        knn_sql = text("""
            SELECT 
                d.id AS neighbor_id,
                d.title AS neighbor_title,
                1.0 - (AVG(e.embedding) <=> :target_vector) AS sim_score
            FROM documents d
            JOIN document_sections s ON s.document_id = d.id
            JOIN embedding_records e ON e.section_id = s.id
            WHERE d.workspace_id = :workspace_id
              AND d.id != :target_id
              AND d.deleted_at IS NULL
            GROUP BY d.id, d.title
            HAVING (1.0 - (AVG(e.embedding) <=> :target_vector)) >= :threshold
            ORDER BY sim_score DESC
            LIMIT :max_k;
        """)

        knn_res = await self.db.execute(
            knn_sql,
            {
                "workspace_id": workspace_id,
                "target_id": document_id,
                "target_vector": target_vec_str,
                "threshold": threshold,
                "max_k": max_neighbors,
            },
        )
        neighbors = knn_res.mappings().all()

        # Remove existing semantic edges originating from or pointing to this doc
        del_stmt = delete(SemanticEdge).where(
            SemanticEdge.workspace_id == workspace_id,
            (SemanticEdge.source_document_id == document_id) | (SemanticEdge.target_document_id == document_id),
        )
        await self.db.execute(del_stmt)

        created_count = 0
        for n in neighbors:
            sim = float(n["sim_score"])
            explanation = json.dumps(
                {
                    "source_heading": target_rows[0][0],
                    "neighbor_title": n["neighbor_title"],
                    "similarity": round(sim, 3),
                }
            )
            new_edge = SemanticEdge(
                workspace_id=workspace_id,
                source_document_id=document_id,
                target_document_id=n["neighbor_id"],
                score=sim,
                relation_type="semantic_similarity",
                matched_sections=explanation,
            )
            self.db.add(new_edge)
            created_count += 1

        await self.db.commit()
        return created_count
