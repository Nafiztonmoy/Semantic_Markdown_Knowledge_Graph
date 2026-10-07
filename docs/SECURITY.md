# NexusDocs: Security Architecture & Threat Model

---

## 1. Threat Assumptions & Boundaries

NexusDocs is designed to host sensitive internal engineering documentation, API conventions, architecture decision records, and operational incident runbooks. The system operates under the following threat model:

1. **Untrusted User Inputs**: All user Markdown text, document titles, tags, and search inputs are treated as potentially malicious.
2. **Cross-Tenant Attack Vectors**: Malicious authenticated users in Workspace A will attempt to read, search, or mutate data belonging to Workspace B.
3. **Prompt Injection**: Documents indexed in the workspace may contain adversarial instructions aimed at hijacking RAG output.

---

## 2. Authentication & Authorization Controls

### Password Hashing (Argon2id)
Passwords are never stored in plaintext. They are processed using **Argon2id** via `argon2-cffi`:
- Algorithm: Argon2id (hybrid data-dependent and data-independent memory access)
- Parameters: Time cost = 2 iterations, Memory cost = 19,456 KiB, Parallelism = 1 thread
- Resistant against GPU cracking and side-channel timing attacks.

### Token & Session Strategy
- **Access Tokens**: Short-lived JSON Web Tokens (60-minute duration) signed with HMAC-SHA256 (`HS256`).
- **Refresh Tokens**: Long-lived tokens (7-day duration) stored in `HttpOnly`, `SameSite=Lax` cookies, protecting against XSS session theft.

### Server-Side Workspace RBAC Enforcement
Every request targeting a workspace resource executes through the `WorkspaceRoleChecker` dependency:
- Roles follow strict hierarchy: `Owner (3) >= Editor (2) >= Viewer (1)`.
- Workspace isolation is verified on every query; frontend role-hiding is never trusted alone.
- An automated regression test (`test_workspace_isolation_regression`) verifies in CI that users from Workspace A receive HTTP 403 when attempting to read or search Workspace B.

---

## 3. Markdown Sanitization & XSS Defense

1. **Safe AST Traversal**: Markdown parsing utilizes `markdown-it-py` on the backend and ReactMarkdown with GFM plugins on the frontend.
2. **Raw HTML Neutralization**: Arbitrary `<script>` tags, inline JavaScript handlers (`onload`, `onerror`), and `javascript:` pseudo-protocols are stripped.
3. **Strict Content Boundaries**: Wiki-links `[[Target Title]]` are verified and converted only to relative application paths.

---

## 4. Prompt Injection Mitigation

Documents indexed into the vector store may contain text instructing an AI assistant to ignore prior instructions or exfiltrate credentials.
NexusDocs implements strict defense-in-depth:
- Context is framed with clear XML-like delimiters: `<<<CONTEXT_SECTION id="..." ...>>>`.
- System prompts explicitly declare context text as untrusted data that must not override system instructions.
- Sensitive environment variables, server keys, and database connection strings are never indexed into the knowledge graph.

---

## 5. Secret Handling & Environment Hygiene

- All credentials (database passwords, Redis connection strings, JWT secret keys, API tokens) are loaded via environment variables (`pydantic-settings`).
- Committed `.env.example` contains only safe local placeholders.
- Production `.env` files and local database stores (`.dev_pgdata/`) are explicitly excluded in `.gitignore`.
