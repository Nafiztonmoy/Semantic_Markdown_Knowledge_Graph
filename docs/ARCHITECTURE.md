# NexusDocs: Technical Architecture & System Design

NexusDocs is an open-source, production-grade technical knowledge platform designed for high developer productivity, zero-hallucination AI exploration, and graph-connected documentation.

---

## 1. System Components Topology

```mermaid
flowchart TD
    subgraph Browser ["Client Tier (Browser)"]
        NextWeb["Next.js 15 App Router"]
        CM6["CodeMirror 6 Markdown Editor"]
        CytoGraph["Cytoscape.js Force-Directed Graph"]
        SearchModal["Hybrid Search & Command Palette"]
    end

    subgraph ServiceTier ["Application Tier"]
        FastAPIApp["FastAPI REST Core (v1 API)"]
        AuthSvc["Argon2id + JWT Security Layer"]
        Parser["Hierarchical Markdown & Wiki-Link Engine"]
        SearchEngine["Hybrid Engine (RRF Fusion)"]
        Worker["Background Queue Worker"]
    end

    subgraph Persistence ["Persistence & Cache"]
        PostgresDB[("PostgreSQL 18")]
        PGVectorExt["pgvector 0.8.6 HNSW"]
        RedisStore[("Redis 7 Cache / FIFO Queue")]
    end

    NextWeb <-->|REST API + HttpOnly Cookies| FastAPIApp
    FastAPIApp -->|Async SQLAlchemy / asyncpg| PostgresDB
    FastAPIApp -->|Cosine KNN `<=>`| PGVectorExt
    FastAPIApp -->|Enqueue Indexing| RedisStore
    Worker -->|Consume FIFO Jobs| RedisStore
    Worker -->|Idempotent Upsert| PostgresDB
```

---

## 2. Ingestion & Indexing Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor User as Developer
    participant UI as Editor UI
    participant API as FastAPI Backend
    participant Worker as Background Worker
    participant DB as PostgreSQL + pgvector

    User->>UI: Save Markdown Document
    UI->>API: PATCH /api/v1/documents/{id}
    API->>DB: Record Document Revision Snapshot
    API->>Worker: Enqueue IndexingJob (Document ID)
    API-->>UI: 200 OK (Document Updated)

    Worker->>DB: Fetch Document Source
    Worker->>Worker: Parse Sections by Heading Hierarchy (#, ##, ###)
    Worker->>Worker: Compute SHA-256 Content Hash per Section
    
    alt Content Hash Unchanged
        Worker->>Worker: Preserve Existing Embedding
    else Content Hash Changed
        Worker->>Worker: Generate 384-Dim Normalized Vector
        Worker->>DB: Upsert EmbeddingRecord
    end

    Worker->>Worker: Parse & Resolve [[Wiki Links]]
    Worker->>DB: Upsert DocumentLink Records
    Worker->>Worker: Compute Centroid Vector & KNN Similarity (threshold >= 0.65)
    Worker->>DB: Upsert SemanticEdge Records (top-5 neighbors)
    Worker->>DB: Mark IndexingJob as 'succeeded'
```

---

## 3. Hybrid Search Architecture & Reciprocal Rank Fusion

### Why Hybrid Search Over Vector-Only Search?
1. **Keyword Blind Spots**: Dense vector embeddings often struggle with exact software identifiers (e.g., `pg_stat_activity`, `CVE-2025-66478`, `UUIDv4`).
2. **Semantic Blind Spots**: Traditional keyword searches fail when developers query concepts with different vocabulary (e.g., "how do we prevent outages" vs. "incident runbook procedures").
3. **The Reciprocal Rank Fusion (RRF) Solution**:
   Rank lists from both models are merged without requiring calibrated cross-model raw scores:
   $$RRF(d) = \sum_{m \in \{\text{keyword}, \text{semantic}\}} \frac{w_m}{60 + r_m(d)}$$
   - Parameter $k = 60$ prevents top outliers from overwhelmingly skewing overall relevance.
   - Deterministic, robust, and easily verified with automated integration tests.

---

## 4. Citation-First RAG Pipeline

```mermaid
flowchart LR
    Question["User Technical Query"] --> Retrieve["Hybrid Search Top-K Retrieval"]
    Retrieve --> Diversity["Apply Document Diversity (max 2 sections / doc)"]
    Diversity --> Prompt["Delimited Context Injection <<<CONTEXT_SECTION>>>"]
    Prompt --> Guard["Anti-Prompt-Injection System Rules"]
    Guard --> LLM["LLM Synthesis / Direct Retrieval Mode"]
    LLM --> Answer["Grounded Answer + Clickable Section Deep Links"]
```

### Prompt-Injection Mitigation
Indexed technical documentation is treated as untrusted data:
1. Every section is encapsulated in explicit boundary tokens: `<<<CONTEXT_SECTION id="..." title="..." path="...">>>`.
2. System instructions strictly declare that context data cannot grant administrator privileges, reveal secrets, or instruct the assistant to disregard developer guidelines.
3. If no LLM key is configured, NexusDocs degrades gracefully: displaying top retrieved matching excerpts and a one-click transition to hybrid search results.

---

## 5. Scaling Considerations

- **Horizontal API Scaling**: The FastAPI backend is stateless, relying on JWT credentials or secure cookies and PostgreSQL/Redis for state.
- **HNSW Vector Indexing**: `embedding vector_cosine_ops` using Hierarchical Navigable Small World graphs scales sub-linearly with logarithmic query latency ($O(\log N)$).
- **Partitioning & Sharding**: Workspaces provide a clean partitioning key (`workspace_id`), allowing horizontal multi-tenant database sharding when scaling to hundreds of thousands of engineering organizations.
