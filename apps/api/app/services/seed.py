import asyncio
import logging
from sqlalchemy import select
from apps.api.app.core.database import async_session_maker
from apps.api.app.core.security import hash_password
from apps.api.app.models.entities import (
    Document,
    DocumentRevision,
    DocumentTag,
    Tag,
    User,
    Workspace,
    WorkspaceMembership,
)
from apps.api.app.services.indexer import DocumentIndexer
from apps.api.app.services.markdown_parser import extract_plain_text

logger = logging.getLogger("nexusdocs.seed")
logging.basicConfig(level=logging.INFO)

DEMO_PASSWORD = "DevPassword123!"

DEMO_USERS = [
    {"email": "admin@nexusdocs.dev", "name": "Admin Engineer", "role": "owner"},
    {"email": "editor@nexusdocs.dev", "name": "Lead Developer", "role": "editor"},
    {"email": "viewer@nexusdocs.dev", "name": "Junior Auditor", "role": "viewer"},
]

DOCUMENTS = [
    {
        "title": "System Architecture",
        "slug": "system-architecture",
        "tags": ["architecture", "backend", "infrastructure"],
        "markdown": """# System Architecture

NexusDocs is designed around an event-driven, decoupled architecture supporting high-performance technical documentation, graph visualization, and citation-first AI retrieval.

## High-Level Topology
The system consists of three primary application tiers:
1. **Frontend App**: Next.js App Router providing a responsive single-page application with CodeMirror 6 and Cytoscape.js.
2. **API Gateway & Core API**: FastAPI async server providing REST endpoints, JWT authentication, and hybrid search services.
3. **Storage & Retrieval Tier**: PostgreSQL with `pgvector` for relational data and dense vector embeddings, with Redis for job queues.

Refer to [[Database Notes]] for persistent storage specifications and [[Queue Design]] for task queuing mechanics.

## Ingestion & Indexing Pipeline
When a document is saved or updated:
- The Markdown payload is parsed into semantic sections based on heading hierarchy.
- Section-level cryptographic hashes are calculated to guarantee idempotent index updates.
- Dense 384-dimensional vectors are generated and indexed into PostgreSQL using HNSW indices.
- Graph edges are automatically refreshed, linking explicit [[Database Notes]] and discovered semantic neighbors.

See [[ADR 003 - Section-Level Chunking]] for design rationale regarding our hierarchical chunking strategy.

```python
# Ingestion flow pseudo-code
async def ingest(markdown: str):
    sections = parse_sections(markdown)
    for section in sections:
        if section.hash_changed():
            emb = await embed_section(section.text)
            await upsert_embedding(section.id, emb)
```
""",
    },
    {
        "title": "Database Notes",
        "slug": "database-notes",
        "tags": ["database", "postgres", "storage"],
        "markdown": """# Database Notes

Our persistent layer is built on PostgreSQL with the pgvector extension for high-performance vector similarity search.

## Relational Schema
All entities use UUID v4 primary keys to prevent enumeration attacks and simplify distributed replication.
- **Documents**: Contains the raw Markdown, extracted plain text, and version counter.
- **DocumentSections**: Normalized sections linked to parent documents with heading paths.
- **EmbeddingRecords**: Dense vector representations stored with 384 dimensions.

## Indexing Strategy
- **B-Tree**: On primary keys, foreign keys, slugs, and timestamps.
- **GIN Index**: Applied over `to_tsvector('english', title || ' ' || content_text)` for rapid full-text keyword retrieval.
- **HNSW Index**: Configured on vector embeddings using cosine distance operators (`vector_cosine_ops`).

For search combination algorithms, see [[ADR 002 - Hybrid Search Strategy]]. For containerized deployments, see [[Deployment Guide]].
""",
    },
    {
        "title": "Authentication Flow",
        "slug": "authentication-flow",
        "tags": ["security", "auth", "backend"],
        "markdown": """# Authentication Flow

Security and workspace isolation are fundamental pillars of NexusDocs.

## Credentials & Password Hashing
User passwords are treated with Argon2id cryptographic hashing with strict memory and time costs, exceeding OWASP baseline recommendations.

## Session Management
- **Access Tokens**: Short-lived JWTs (60-minute expiry) carrying user identity.
- **Refresh Tokens**: Long-lived tokens stored in HttpOnly, SameSite cookies to mitigate cross-site scripting (XSS) vectors.

## Role-Based Access Control (RBAC)
Every workspace query enforces membership via server-side middleware:
- **Owner**: Full workspace administrative rights, member invitations, and billing.
- **Editor**: Create, edit, and restore documents, manage tags, and trigger index rebuilds.
- **Viewer**: Read-only access to documents, graph exploration, and RAG questioning.

Cross-workspace boundary checks prevent any user in Workspace A from querying Workspace B. See [[API Conventions]] for error responses.
""",
    },
    {
        "title": "API Conventions",
        "slug": "api-conventions",
        "tags": ["api", "standards", "backend"],
        "markdown": """# API Conventions

NexusDocs exposes a clean RESTful API under the versioned prefix `/api/v1`.

## Status Codes & Payloads
- `200 OK`: Successful resource query or update.
- `201 Created`: Resource successfully created.
- `202 Accepted`: Asynchronous indexing or batch import accepted.
- `400 Bad Request`: Validation failure on input parameters.
- `401 Unauthorized`: Missing or expired authentication token.
- `403 Forbidden`: Insufficient workspace permissions.
- `404 Not Found`: Resource does not exist.

## Request Validation
All endpoints validate incoming JSON payloads through Pydantic v2 schemas. Refer to [[Authentication Flow]] for header requirements.
""",
    },
    {
        "title": "Incident Runbook",
        "slug": "incident-runbook",
        "tags": ["ops", "runbook", "monitoring"],
        "markdown": """# Incident Runbook

Standard operating procedures for service degradation and high-severity outages.

## Severity 1: Database Connectivity Failure
Symptoms: `/health/ready` returns 503; high error rate on API endpoints.
1. Inspect database container status via `docker compose ps`.
2. Check PostgreSQL connection pool exhaustion in [[Observability Guide]].
3. Verify pgvector extension status: `SELECT * FROM pg_extension WHERE extname = 'vector'`.

## Severity 2: Background Queue Lag
Symptoms: Indexing jobs remain in `queued` state for more than 2 minutes.
1. Check Redis connectivity on port 6379 as documented in [[Queue Design]].
2. Inspect worker log outputs for uncaught model exceptions.
3. Restart worker instances: `make dev-worker`.
""",
    },
    {
        "title": "Deployment Guide",
        "slug": "deployment-guide",
        "tags": ["devops", "docker", "infrastructure"],
        "markdown": """# Deployment Guide

NexusDocs supports both multi-container Docker Compose environments and cloud orchestration platforms.

## Docker Compose Setup
Run the complete production-configured environment with a single command:
```bash
docker compose up --build -d
```

### Container Services
- `postgres`: PostgreSQL 16 image with pre-compiled pgvector.
- `redis`: Redis 7 alpine for ephemeral caching and job queues.
- `api`: FastAPI application runner exposed on port 8000.
- `worker`: Standalone Python background processor.
- `web`: Next.js production standalone server running on port 3000.

See [[System Architecture]] for tier interactions and [[Observability Guide]] for health checks.
""",
    },
    {
        "title": "Caching Strategy",
        "slug": "caching-strategy",
        "tags": ["caching", "redis", "performance"],
        "markdown": """# Caching Strategy

NexusDocs implements multi-tiered caching to minimize database query latency and prevent redundant vector computations.

## Query Cache Invalidation
Search results and graph topologies are dynamically invalidated whenever:
- A document is created, updated, or soft-deleted.
- Re-indexing completes for a document section.

See [[Queue Design]] for job notifications and [[Database Notes]] for underlying indexes.
""",
    },
    {
        "title": "Observability Guide",
        "slug": "observability-guide",
        "tags": ["observability", "metrics", "ops"],
        "markdown": """# Observability Guide

Comprehensive monitoring and diagnostics for the NexusDocs platform.

## Health Endpoints
- `GET /health/live`: Fast ping confirming process responsiveness.
- `GET /health/ready`: Deep dependency check verifying PostgreSQL connectivity and pgvector extension status.

Refer to [[Incident Runbook]] for operational alerts and [[Deployment Guide]] for log collection.
""",
    },
    {
        "title": "Frontend Standards",
        "slug": "frontend-standards",
        "tags": ["frontend", "ui", "standards"],
        "markdown": """# Frontend Standards

Guidelines for authoring client components in the Next.js App Router.

## Component Architecture
- **Strict TypeScript**: No implicit `any`; all API payloads typed.
- **Tailwind CSS**: Restrained dark-mode-first aesthetic with zinc palette.
- **CodeMirror 6**: Markdown editing with split preview and debounced autosave.
- **Cytoscape.js**: Graph layout rendering with interactive pan/zoom and detail inspection.

See [[Testing Strategy]] for UI unit tests.
""",
    },
    {
        "title": "Testing Strategy",
        "slug": "testing-strategy",
        "tags": ["testing", "quality", "ci"],
        "markdown": """# Testing Strategy

Testing is a core deliverable of NexusDocs ensuring rock-solid stability and regression protection.

## Test Matrix
1. **Backend Unit Tests**: Markdown section parser, wiki-link extractor, RRF ranking calculation, role hierarchy checks.
2. **Backend Integration Tests**: Auth flows, workspace isolation boundaries, document CRUD, revision restore.
3. **Frontend Component Tests**: Vitest with React Testing Library for critical UI widgets.
4. **End-to-End Tests**: Playwright browser journeys verifying user workflows.
""",
    },
    {
        "title": "Queue Design",
        "slug": "queue-design",
        "tags": ["queue", "redis", "worker"],
        "markdown": """# Queue Design

Asynchronous task architecture for offloading intensive indexing and graph computation.

## Worker Mechanics
Jobs are enqueued onto Redis lists using FIFO semantics. The background worker consumes jobs, executes section chunking, computes dense vector representations, and recalculates [[System Architecture]] graph edges.

In developer environments without an external Redis instance, the system seamlessly falls back to an in-process asynchronous task loop.
""",
    },
    {
        "title": "ADR 001 - Vector Database Selection",
        "slug": "adr-001-vector-database-selection",
        "tags": ["adr", "architecture", "database"],
        "markdown": """# ADR 001 - Vector Database Selection

## Status
Accepted

## Context
NexusDocs requires vector similarity search alongside traditional relational data and full-text keyword indexing. Specialized vector stores (Pinecone, Qdrant, Milvus) introduce additional infrastructure complexity and distributed consistency challenges.

## Decision
Adopt PostgreSQL with the `pgvector` extension.

## Consequences
- Single database transactionally handles relational documents, full-text indexes, and vector embeddings.
- Simplifies local development and reduces cloud operational costs.
- Integrates seamlessly with SQLAlchemy 2.0 and Alembic. See [[Database Notes]].
""",
    },
    {
        "title": "ADR 002 - Hybrid Search Strategy",
        "slug": "adr-002-hybrid-search-strategy",
        "tags": ["adr", "search", "architecture"],
        "markdown": """# ADR 002 - Hybrid Search Strategy

## Status
Accepted

## Context
Pure vector search frequently fails on exact code identifiers, error codes, and technical jargon, while pure keyword search fails on semantic paraphrasing.

## Decision
Implement hybrid search using Reciprocal Rank Fusion (RRF) combining PostgreSQL Full-Text Search and pgvector cosine distance.

$$RRF(d) = \\frac{1}{60 + r_{keyword}} + \\frac{1}{60 + r_{semantic}}$$

## Consequences
- High precision on exact terms and high recall on semantic inquiries.
- Highly deterministic and easily verifiable through unit tests. See [[Testing Strategy]].
""",
    },
    {
        "title": "ADR 003 - Section-Level Chunking",
        "slug": "adr-003-section-level-chunking",
        "tags": ["adr", "indexing", "rag"],
        "markdown": """# ADR 003 - Section-Level Chunking

## Status
Accepted

## Context
Arbitrary token-window chunking destroys document context and cuts off technical code blocks.

## Decision
Chunk Markdown documents along heading boundaries (`#`, `##`, `###`), preserving hierarchical heading paths (e.g., `Architecture > Ingestion Pipeline`).

## Consequences
- Each chunk represents a cohesive semantic unit.
- Search results and RAG citations can pinpoint the exact subsection within the source document.
- Cryptographic content hashes prevent re-embedding unchanged sections.
""",
    },
]


async def seed_demo_data():
    logger.info("Starting Acme Engineering workspace seed...")
    async with async_session_maker() as db:
        # 1. Create or get demo users
        users = {}
        for u_data in DEMO_USERS:
            existing = (await db.execute(select(User).where(User.email == u_data["email"]))).scalar_one_or_none()
            if not existing:
                u = User(
                    email=u_data["email"],
                    display_name=u_data["name"],
                    password_hash=hash_password(DEMO_PASSWORD),
                    status="active",
                )
                db.add(u)
                await db.flush()
                users[u_data["email"]] = u
                logger.info(f"Created demo user: {u.email}")
            else:
                users[u_data["email"]] = existing
                logger.info(f"User exists: {existing.email}")

        admin_user = users["admin@nexusdocs.dev"]

        # 2. Create Acme Engineering Workspace
        ws_q = select(Workspace).where(Workspace.slug == "acme-engineering")
        workspace = (await db.execute(ws_q)).scalar_one_or_none()
        if not workspace:
            workspace = Workspace(
                name="Acme Engineering",
                slug="acme-engineering",
                description="Engineering documentation, architecture decisions, and operational runbooks for Acme Corp.",
                created_by=admin_user.id,
            )
            db.add(workspace)
            await db.flush()
            logger.info("Created workspace: Acme Engineering")

        # 3. Add Memberships
        for u_data in DEMO_USERS:
            u_obj = users[u_data["email"]]
            m_q = select(WorkspaceMembership).where(
                WorkspaceMembership.workspace_id == workspace.id,
                WorkspaceMembership.user_id == u_obj.id,
            )
            existing_m = (await db.execute(m_q)).scalar_one_or_none()
            if not existing_m:
                mem = WorkspaceMembership(
                    workspace_id=workspace.id,
                    user_id=u_obj.id,
                    role=u_data["role"],
                )
                db.add(mem)

        await db.commit()

        # 4. Create and Index Documents
        indexer = DocumentIndexer(db)
        doc_count = 0
        for doc_item in DOCUMENTS:
            existing_d = (
                await db.execute(
                    select(Document).where(
                        Document.workspace_id == workspace.id,
                        Document.slug == doc_item["slug"],
                    )
                )
            ).scalar_one_or_none()

            plain = extract_plain_text(doc_item["markdown"])
            if not existing_d:
                doc = Document(
                    workspace_id=workspace.id,
                    title=doc_item["title"],
                    slug=doc_item["slug"],
                    markdown=doc_item["markdown"],
                    plain_text=plain,
                    version_number=1,
                    created_by=admin_user.id,
                    updated_by=admin_user.id,
                )
                db.add(doc)
                await db.flush()

                # Add initial revision
                rev = DocumentRevision(
                    document_id=doc.id,
                    title=doc.title,
                    markdown=doc.markdown,
                    version_number=1,
                    created_by=admin_user.id,
                )
                db.add(rev)

                # Add tags
                for tag_name in doc_item["tags"]:
                    tag_stmt = select(Tag).where(Tag.workspace_id == workspace.id, Tag.name == tag_name)
                    tag_obj = (await db.execute(tag_stmt)).scalar_one_or_none()
                    if not tag_obj:
                        tag_obj = Tag(workspace_id=workspace.id, name=tag_name)
                        db.add(tag_obj)
                        await db.flush()

                    db.add(DocumentTag(document_id=doc.id, tag_id=tag_obj.id))

                await db.commit()
                # Run indexer synchronously during seed
                await indexer.index_document(doc.id)
                doc_count += 1
                logger.info(f"Seeded and indexed document: {doc.title}")
            else:
                logger.info(f"Document already exists: {existing_d.title}")

        logger.info(f"Acme Engineering seed completed with {doc_count} documents indexed.")


if __name__ == "__main__":
    asyncio.run(seed_demo_data())
