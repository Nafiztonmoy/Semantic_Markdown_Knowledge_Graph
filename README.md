> **Frontend redesign:** See [update instructions and validation notes](docs/UI_REDESIGN.md) before copying files into an existing installation. Keep your current environment files and database.

# NexusDocs: Semantic Markdown Knowledge Graph

[![CI](https://github.com/nexusdocs/nexusdocs/actions/workflows/ci.yml/badge.svg)](https://github.com/nexusdocs/nexusdocs/actions)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black?logo=next.js&logoColor=white)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![pgvector](https://img.shields.io/badge/pgvector-0.8.6-336791)](https://github.com/pgvector/pgvector)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![Playwright](https://img.shields.io/badge/Playwright-1.55-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**NexusDocs** is a production-grade developer documentation platform combining bidirectional Markdown authoring, hybrid semantic search, an interactive knowledge graph, and a citation-first RAG assistant.

Built as a modern, decoupled monorepo, NexusDocs eliminates documentation silos and search mismatch by representing developer knowledge as an interconnected graph backed by PostgreSQL full-text search (GIN) and vector embeddings (pgvector HNSW) fused via Reciprocal Rank Fusion (RRF).

---

## 🌟 Key Features

### 1. Markdown Authoring & Knowledge Linking
* **CodeMirror 6 Editor**: Dual-pane editor with live rendered preview, line numbers, syntax highlighting, and responsive preview toggling.
* **Hierarchical Section Parser**: Automatically parses documents into semantic section trees (`H1` to `H6`), computes SHA-256 hashes per section for change tracking, and produces auto-anchored Table of Contents.
* **Bidirectional Wiki-Links**: Native `[[Document Title#Section]]` syntax that automatically extracts incoming and outgoing link edges with forward navigation and backlink discovery.
* **Revision History & Rollback**: Automatic revision snapshots with one-click revision restore and diff inspectability.

### 2. Interactive Knowledge Graph Canvas
* **Cytoscape.js Force-Directed Graph**: High-performance canvas powered by the compound spring layout (`cose`) with smooth pan, zoom, fit-to-screen, and node dragging.
* **Triple Edge Topology**:
  * **Wiki Links** (Solid Blue): Explicit references parsed from document markdown.
  * **Shared Tags** (Dashed Green): Synthesized relationships based on overlapping technical tags.
  * **Semantic Cosine Similarity** (Dotted Purple): Vector distance edges between document embeddings.
* **Interactive Controls**: Dynamic cosine similarity threshold slider ($0.1$ to $1.0$), relationship type toggles, tag filter chips, and an explainability drawer detailing why two nodes are connected.

### 3. Hybrid Search Engine with Reciprocal Rank Fusion (RRF)
* **Dual-Modality Retrieval**: Runs PostgreSQL Full-Text Search (`to_tsquery` over GIN indices) alongside Dense Vector Search (384-dimensional cosine distance over pgvector HNSW indices) concurrently.
* **Reciprocal Rank Fusion**: Merges sparse keyword matches and dense conceptual matches using the standard RRF formula:
  $$Score(d) = \sum_{m \in M} \frac{1}{60 + rank_m(d)}$$
* **Explainable Match Signals**: Every search result transparently displays whether it was matched via *keyword*, *semantic vector*, or *both*, along with section heading anchors and highlighted snippet text.

### 4. Citation-First RAG Assistant
* **Grounded Question Answering**: Conversational AI assistant grounded exclusively on top-ranked document sections retrieved from the active workspace.
* **Section-Anchored Citations**: Enforces strict markdown citation footnotes (`[^section-id]`) that render as clickable deep links directly navigating the user to the target document heading.
* **Anti-Prompt Injection Defenses**: Encapsulates external documentation contexts within strict XML boundaries (`<doc_context id="...">`) and applies prompt hardening to prevent instruction hijacking.
* **Offline Fallback**: Operates reliably without external API dependencies via deterministic local dense embeddings and context synthesis, with seamless plug-in support for OpenAI (`gpt-4o-mini`) and Google Gemini.

### 5. Multi-Tenant Security & Enterprise RBAC
* **Role-Based Access Control**: Workspaces support `Owner`, `Editor`, and `Viewer` roles. Viewers are strictly blocked from write, edit, and delete operations.
* **Tenant Isolation**: Every database query is strictly scoped to `workspace_id`. Verified with automated cross-tenant security regression tests.
* **Cryptographic Security**: Passwords hashed with **Argon2id** (memory-hard, GPU-resistant). Authentication managed via HttpOnly JWT tokens with Bearer fallback for programmatic API access.
* **Immutable Audit Trail**: Tracks document creates, updates, deletes, and member access events in an immutable `audit_events` log.

---

## ⚡ Instant Demo Credentials

The platform includes a pre-seeded **Acme Engineering** workspace with 14 realistic technical documents (System Architecture, Incident Runbooks, ADRs 001-003, Database Notes, Microservice Specs, etc.), complete with wiki-links, tags, and pre-computed vector embeddings.

The landing page features **1-Click Demo Login** buttons, or you can sign in manually:

| Role | Email | Password | Permissions |
| :--- | :--- | :--- | :--- |
| **Workspace Owner** | `admin@nexusdocs.dev` | `DevPassword123!` | Full workspace administration, member invites, role changes, doc authoring |
| **Workspace Editor** | `editor@nexusdocs.dev` | `DevPassword123!` | Create, edit, and delete documents, view graph, search, ask RAG |
| **Workspace Viewer** | `viewer@nexusdocs.dev` | `DevPassword123!` | Read documents, explore graph, search, ask RAG (write operations forbidden) |

---

## 🏗️ Architecture & System Topology

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Next.js 15 App Router)"]
        Landing["Landing Page / Demo Auth"]
        WorkspaceShell["Workspace Layout & Command Palette (Ctrl+K)"]
        CM6["Markdown Editor (CodeMirror 6)"]
        GraphUI["Knowledge Graph (Cytoscape.js)"]
        SearchUI["Hybrid Search (RRF View)"]
        RAGUI["Citation Assistant (RAG Chat)"]
    end

    subgraph API ["Application Server (FastAPI 0.115 Async)"]
        AuthModule["Auth & RBAC (Argon2id + JWT)"]
        DocModule["Document & Section Parser (SHA-256)"]
        SearchModule["Hybrid Search Engine (RRF k=60)"]
        GraphModule["Graph Synthesis & Edge Pruner"]
        RAGModule["Citation RAG & Context Sandbox"]
        BackgroundWorker["Async Indexing Worker"]
    end

    subgraph Storage ["Persistence Layer (PostgreSQL 18 + pgvector)"]
        Relational["Workspaces, Users, Documents, Revisions, Sections"]
        GINIndex["GIN tsvector Index (Full-Text Search)"]
        HNSWIndex["HNSW Index (Cosine Similarity Vector Search)"]
        AuditLogs["Immutable Audit Events"]
    end

    Client -->|REST & Cookie Auth| API
    API -->|asyncpg pool| Storage
    BackgroundWorker -->|Re-index Embeddings| Storage
```

---

## 📁 Monorepo Structure

```
Semantic_Markdown_Knowledge_Graph/
├── apps/
│   ├── api/                           # FastAPI Async Application
│   │   ├── alembic/                   # Database migrations (PostgreSQL + pgvector)
│   │   │   └── versions/              # Migration versions (full schema & indices)
│   │   ├── app/
│   │   │   ├── api/v1/                # REST API Routers (auth, workspaces, docs, search, graph, ask, health)
│   │   │   ├── core/                  # Configuration, database engine, security, dependencies
│   │   │   ├── models/                # SQLAlchemy 2.0 ORM models
│   │   │   ├── schemas/               # Pydantic v2 validation DTOs
│   │   │   └── services/              # Markdown parser, embedding, search, graph, RAG, worker, seed
│   │   ├── tests/                     # Pytest suite (auth, docs, isolation, search, graph, RAG)
│   │   ├── alembic.ini                # Alembic migration configuration
│   │   └── pyproject.toml             # Python package configuration
│   │
│   └── web/                           # Next.js 15 Web Application
│       ├── e2e/                       # Playwright end-to-end browser tests
│       ├── public/                    # Static assets & icons
│       └── src/
│           ├── app/                   # App Router pages (auth, dashboard, docs, graph, search, ask, settings)
│           ├── components/            # CodeMirror editor, Cytoscape graph canvas, Command Palette, etc.
│           ├── lib/                   # API client, TanStack Query hooks, types
│           └── __tests__/             # Vitest component unit tests
│
├── docs/                              # Production Documentation Suite
│   ├── API.md                         # Complete REST API specification
│   ├── ARCHITECTURE.md                # System topology, sequence flows, scaling
│   ├── DATA_MODEL.md                  # Database ERD and table schemas
│   ├── DECISIONS.md                   # Architecture Decision Records (ADRs 001-005)
│   ├── PORTFOLIO.md                   # Resume bullets, interview guide & technical deep dive
│   └── SECURITY.md                    # Threat model, RBAC policies & prompt defense
│
├── infra/
│   └── docker/                        # Multi-stage Dockerfiles (API, Web, Worker)
│
├── .github/workflows/ci.yml           # GitHub Actions CI workflow (lint, test, build)
├── docker-compose.yml                 # Production-ready multi-container orchestration
├── Makefile                           # Developer automation commands
├── .env.example                       # Documented environment variables template
└── README.md                          # Main project documentation
```

---

## 🚀 Quickstart Guide

### Option A: Running via Docker Compose (Recommended)

To start the complete application (PostgreSQL with pgvector, Redis, FastAPI, Background Worker, and Next.js):

```bash
# 1. Clone repository
git clone https://github.com/nexusdocs/nexusdocs.git
cd nexusdocs

# 2. Copy environment file
cp .env.example .env

# 3. Launch all containers
docker compose up --build -d

# 4. Apply migrations and seed demo data
docker compose exec api python -m alembic -c apps/api/alembic.ini upgrade head
docker compose exec api python -m apps.api.app.services.seed
```

Open your browser:
* **Frontend**: [http://localhost:3000](http://localhost:3000)
* **Backend API / Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
* **API Health Check**: [http://localhost:8000/api/v1/health/ready](http://localhost:8000/api/v1/health/ready)

---

### Option B: Running Locally (Native Monorepo)

#### Prerequisites
* **Node.js**: v20+ and `npm`
* **Python**: 3.12+
* **PostgreSQL**: 16+ with the `pgvector` extension installed

#### 1. Database Setup
Ensure PostgreSQL has the `vector` extension:
```sql
CREATE DATABASE nexusdocs;
\c nexusdocs;
CREATE EXTENSION IF NOT EXISTS vector;
```

#### 2. Backend Setup
```bash
# Set up Python virtual environment
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies in editable mode
pip install -e ./apps/api
pip install pytest pytest-asyncio httpx ruff

# Configure environment variables
# Copy .env.example to .env and adjust DATABASE_URL if needed
# Example: DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/nexusdocs

# Apply database migrations
python -m alembic -c apps/api/alembic.ini upgrade head

# Seed Acme Engineering demo dataset
python -m apps.api.app.services.seed

# Start FastAPI backend (port 8008 or 8000)
python -m uvicorn apps.api.app.main:app --host 127.0.0.1 --port 8008 --reload
```

#### 3. Frontend Setup
```bash
cd apps/web

# Install npm dependencies
npm install

# Create local environment file
echo "NEXT_PUBLIC_API_URL=http://127.0.0.1:8008" > .env.local

# Run development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Verification & Test Suites

NexusDocs is covered by automated tests across all system layers.

### 1. Backend Pytest Suite (12 Tests)
Tests cover authentication, JWT lifecycle, document CRUD, hierarchical section parsing, hybrid FTS and vector search, knowledge graph topology, RAG context formatting, and **cross-tenant isolation security tests**:
```bash
.venv/Scripts/python -m pytest apps/api/tests/ -v
```
*Result: 12 passed in ~1.7s.*

### 2. Frontend Vitest Unit Suite (3 Tests)
Tests verify Markdown preview rendering, table of contents generation, and graph controls:
```bash
npm --prefix apps/web test
```
*Result: 3 passed in ~0.6s.*

### 3. Playwright End-to-End Browser Suite (6 Tests)
Executes end-to-end browser journeys in headless Chromium:
* Landing page demo login redirection
* Document library navigation & creation
* CodeMirror markdown live preview & backlink rendering
* Cytoscape knowledge graph interaction & controls
* Hybrid search with RRF signal inspection
* Citation-anchored RAG assistant Q&A
```bash
npx --prefix apps/web playwright test
```
*Result: 6 passed in ~4.6s.*

### 4. Code Quality & Linting
```bash
# Python linting and format checking
.venv/Scripts/python -m ruff check apps/api
.venv/Scripts/python -m ruff format --check apps/api

# Frontend linting and TypeScript strict type checking
cd apps/web && npm run lint && npm run type-check
```

---

## 📡 REST API Reference

The interactive Swagger UI documentation is available at `http://127.0.0.1:8008/docs`.

### Core Endpoints

| Category | Method | Endpoint | Description |
| :--- | :--- | :--- | :--- |
| **Auth** | `POST` | `/api/v1/auth/register` | Register new account with Argon2id password hashing |
| | `POST` | `/api/v1/auth/login` | Authenticate and set HttpOnly JWT cookie |
| | `POST` | `/api/v1/auth/logout` | Revoke session and clear cookies |
| | `GET` | `/api/v1/auth/me` | Fetch active user profile and memberships |
| **Workspaces** | `GET` | `/api/v1/workspaces` | List accessible workspaces for current user |
| | `POST` | `/api/v1/workspaces` | Create new workspace |
| | `GET` | `/api/v1/workspaces/{id}` | Retrieve workspace details |
| | `GET` | `/api/v1/workspaces/{id}/members` | List members and roles |
| | `POST` | `/api/v1/workspaces/{id}/members` | Add member to workspace (Owner only) |
| **Documents** | `GET` | `/api/v1/workspaces/{id}/documents` | List documents with tag and status filtering |
| | `POST` | `/api/v1/workspaces/{id}/documents` | Create document with automatic section & link parsing |
| | `GET` | `/api/v1/workspaces/{id}/documents/{docId}` | Get document details, sections, and backlinks |
| | `PUT` | `/api/v1/workspaces/{id}/documents/{docId}` | Update document, create revision snapshot, re-index |
| | `DELETE` | `/api/v1/workspaces/{id}/documents/{docId}` | Delete document and cascade edges |
| | `GET` | `/api/v1/workspaces/{id}/documents/{docId}/revisions` | List revision history |
| | `POST` | `/api/v1/workspaces/{id}/documents/{docId}/revisions/{revId}/restore` | Restore document to previous revision |
| **Search** | `POST` | `/api/v1/workspaces/{id}/search` | Hybrid search (mode: `hybrid`, `fts`, `vector`) with RRF |
| **Graph** | `GET` | `/api/v1/workspaces/{id}/graph` | Cytoscape elements (nodes, edges, similarity thresholds) |
| **RAG** | `POST` | `/api/v1/workspaces/{id}/ask` | Citation-anchored RAG Q&A with deep links |
| **Health** | `GET` | `/api/v1/health/live` | Liveness probe (HTTP 200 OK) |
| | `GET` | `/api/v1/health/ready` | Readiness probe (verifies PostgreSQL connectivity) |

For comprehensive payload schemas and error structures, see [API.md](file:///docs/API.md).

---

## 📚 Documentation Suite

NexusDocs includes extensive architectural and operational documentation:

* [Architecture Guide](file:///docs/ARCHITECTURE.md): Component topology, sequence flows, RRF mathematical formulation, and scaling considerations.
* [Data Model Specification](file:///docs/DATA_MODEL.md): Full database schema, Mermaid ERD, GIN full-text and HNSW vector index specifications.
* [API Reference Specification](file:///docs/API.md): Detailed REST endpoints, request/response JSON schemas, and error conventions.
* [Security & Threat Defense](file:///docs/SECURITY.md): Multi-tenant isolation model, RBAC matrix, Argon2id parameters, and prompt injection mitigation.
* [Architecture Decision Records (ADRs)](file:///docs/DECISIONS.md): Justifications for PostgreSQL + pgvector, Reciprocal Rank Fusion, Cytoscape.js, Next.js 15, and Section-Level Embedding Chunks.
* [Portfolio & Engineering Deep Dive](file:///docs/PORTFOLIO.md): High-impact resume bullets, 5-minute technical interview walkthrough script, and complex engineering solutions.

---

## 🛠️ Environment Configuration

| Variable | Default | Description |
| :--- | :--- | :--- |
| `ENVIRONMENT` | `development` | Runtime environment (`development`, `production`, `test`) |
| `SECRET_KEY` | *(Required)* | 32+ byte cryptographic secret for JWT signing |
| `DATABASE_URL` | *(Required)* | Async PostgreSQL connection string with `asyncpg` driver |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis instance for background task queue |
| `FRONTEND_ORIGIN` | `http://localhost:3000` | Allowed CORS origin for web client |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Base URL for client API requests |
| `EMBEDDING_PROVIDER` | `local` | Embedding engine: `local` (deterministic fast 384d), `openai`, `gemini` |
| `LLM_PROVIDER` | `none` | LLM engine: `none` (offline context synthesis), `openai`, `gemini` |
| `GRAPH_SIMILARITY_THRESHOLD` | `0.65` | Default minimum cosine similarity for semantic graph edges |
| `GRAPH_MAX_NEIGHBORS` | `5` | Maximum semantic similarity edges per node |

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
