# NexusDocs: REST API Reference & Specification

NexusDocs exposes a versioned RESTful API under `/api/v1`. Interactive OpenAPI documentation and Swagger UI are accessible at:
- **Swagger UI**: [http://localhost:8008/docs](http://localhost:8008/docs)
- **ReDoc**: [http://localhost:8008/redoc](http://localhost:8008/redoc)
- **OpenAPI Schema**: [http://localhost:8008/openapi.json](http://localhost:8008/openapi.json)

---

## 1. Authentication Endpoints

### Register Account
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "developer@nexusdocs.dev",
  "password": "SecurePassword123!",
  "display_name": "Dev User"
}
```
**Response (201 Created):**
```json
{
  "access_token": "eyJhbGciOi...",
  "refresh_token": "eyJhbGciOi...",
  "token_type": "bearer",
  "user": {
    "id": "b1b11b51-...",
    "email": "developer@nexusdocs.dev",
    "display_name": "Dev User",
    "status": "active"
  }
}
```

### Sign In
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@nexusdocs.dev",
  "password": "DevPassword123!"
}
```

---

## 2. Document & Ingestion Endpoints

### Create Document
```http
POST /api/v1/workspaces/{workspace_id}/documents
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Caching Architecture",
  "markdown": "# Caching Architecture\n\nNexusDocs uses Redis for [[Queue Design]].",
  "tags": ["caching", "redis"]
}
```

### Batch Markdown Import
```http
POST /api/v1/workspaces/{workspace_id}/imports/markdown
Authorization: Bearer <token>
Content-Type: multipart/form-data

files=@architecture.md
files=@runbook.md
```

---

## 3. Search & Graph Endpoints

### Hybrid Search
```http
GET /api/v1/workspaces/{workspace_id}/search?q=PostgreSQL+indexing&mode=all&limit=10
Authorization: Bearer <token>
```
**Response (200 OK):**
```json
{
  "query": "PostgreSQL indexing",
  "mode": "all",
  "total": 5,
  "limit": 10,
  "offset": 0,
  "items": [
    {
      "document_id": "fcb51779-...",
      "title": "Database Notes",
      "heading_path": "Database Notes > Indexing Strategy",
      "snippet": "B-Tree on primary keys, GIN index on <mark>PostgreSQL</mark> full-text search...",
      "score": 0.03279,
      "relevance_explanation": "Keyword match #1 + Semantic similarity match #2",
      "tags": ["database", "postgres"]
    }
  ]
}
```

### Knowledge Graph
```http
GET /api/v1/workspaces/{workspace_id}/graph?include_wiki_links=true&include_tags=true&include_semantic_edges=true&min_similarity=0.65
Authorization: Bearer <token>
```

---

## 4. Citation-First RAG Assistant

### Ask Workspace
```http
POST /api/v1/workspaces/{workspace_id}/ask
Authorization: Bearer <token>
Content-Type: application/json

{
  "question": "What vector indexing method is used for embeddings?"
}
```
**Response (200 OK):**
```json
{
  "answer": "NexusDocs utilizes Hierarchical Navigable Small World (HNSW) indexing configured with the `vector_cosine_ops` operator over 384-dimensional dense vectors [ref: sec-1].",
  "citations": [
    {
      "document_id": "fcb51779-...",
      "document_title": "Database Notes",
      "heading_path": "Database Notes > Indexing Strategy",
      "section_id": "sec-1",
      "excerpt": "HNSW Index: Configured on vector embeddings using cosine distance operators...",
      "deep_link": "/workspaces/.../documents/...#Database-Notes-Indexing-Strategy"
    }
  ],
  "retrieval_metadata": {
    "query": "What vector indexing method is used for embeddings?",
    "provider": "hybrid_search_fallback",
    "model": "none",
    "latency_ms": 12.4,
    "sections_considered": 8
  },
  "provider_status": "active"
}
```
