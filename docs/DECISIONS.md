# NexusDocs: Architecture Decision Records (ADRs)

---

## ADR 001: Unified Relational, Full-Text & Vector Storage with PostgreSQL + pgvector

### Context
NexusDocs requires storing relational entities (users, workspaces, memberships, revisions), full-text search inverted indexes, and high-dimensional dense vector embeddings. Running distinct database engines (e.g., PostgreSQL + Elasticsearch + Pinecone) adds operational burden, synchronization latency, and distributed transaction complexity.

### Decision
Use **PostgreSQL 18** with the **`pgvector`** extension:
- `to_tsvector` with GIN indexes for sub-millisecond keyword full-text search.
- `vector(384)` with HNSW indexes for approximate nearest neighbor cosine similarity search.
- Standard relational foreign keys with transactional ACID semantics.

### Consequences
- **Positive**: Single backup, single connection pool, zero out-of-sync data issues, simplified local development.
- **Negative**: High-dimensional vector indexing utilizes PostgreSQL shared memory and disk space; mitigated through HNSW configuration.

---

## ADR 002: Hierarchical Section Chunking Over Fixed Token Windows

### Context
Standard RAG frameworks chunk documents into arbitrary token windows (e.g., 500 tokens with 50-token overlap). For developer documentation, this cuts code blocks in half, separates function definitions from their explanations, and destroys section context.

### Decision
Chunk Markdown documents along heading boundaries (`#`, `##`, `###`), preserving the full hierarchical heading path (e.g., `System Architecture > Storage Tier > Caching`).

### Consequences
- **Positive**: Chunks represent cohesive units of thought. Search results and AI citations display exact subsection headings.
- **Positive**: Enables SHA-256 content hashing per section, preventing re-embedding unchanged sections when other parts of a document change.

---

## ADR 003: Hybrid Search with Reciprocal Rank Fusion (RRF)

### Context
Keyword search fails on conceptual queries; dense vector search fails on precise function names, error codes, and flags.

### Decision
Combine PostgreSQL FTS ranks and pgvector cosine ranks using Reciprocal Rank Fusion:
$$RRF(d) = \sum_{m} \frac{1}{60 + \text{rank}_m(d)}$$

### Consequences
- **Positive**: High precision on technical tokens combined with high recall on semantic inquiries.
- **Positive**: Deterministic, calibration-free score fusion.

---

## ADR 004: Dual-Mode Background Job Architecture

### Context
In cloud environments, background jobs should be queued on Redis and consumed by dedicated worker containers. However, local developer setups may lack a running Redis daemon.

### Decision
Implement dual-mode dispatch in `worker.py`:
1. If Redis is accessible, jobs are pushed to FIFO list `nexusdocs:indexing_jobs`.
2. If Redis is unavailable, jobs seamlessly fall back to an in-process asynchronous task loop (`asyncio.create_task`).

### Consequences
- **Positive**: Zero-configuration local development while retaining production-ready containerized worker decoupling.

---

## ADR 005: Zero-Key Deterministic Local Dense Embeddings

### Context
A developer documentation tool should work out of the box without requiring a paid OpenAI or Gemini API key. Downloading large PyTorch models (500MB+) can slow down startup in lightweight environments.

### Decision
Implement a deterministic 384-dimensional term-projection embedding engine for local mode (`DeterministicLocalEmbedder`), alongside pluggable OpenAI and Gemini providers.

### Consequences
- **Positive**: Zero external dependencies, instant cold-start boot time, real cosine vector calculations with pgvector.
