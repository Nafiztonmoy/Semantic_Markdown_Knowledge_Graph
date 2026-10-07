import pytest
from httpx import ASGITransport, AsyncClient
from apps.api.app.main import app

DEMO_PASSWORD = "DevPassword123!"


@pytest.mark.asyncio
async def test_health_endpoints():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Liveness
        res_live = await client.get("/api/v1/health/live")
        assert res_live.status_code == 200
        assert res_live.json()["status"] == "ok"

        # Readiness
        res_ready = await client.get("/api/v1/health/ready")
        assert res_ready.status_code == 200
        assert res_ready.json()["pgvector"] == "installed"


@pytest.mark.asyncio
async def test_auth_login_and_me():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Valid login
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@nexusdocs.dev", "password": DEMO_PASSWORD},
        )
        assert login_resp.status_code == 200
        data = login_resp.json()
        assert "access_token" in data
        token = data["access_token"]

        # Call /me with Bearer token
        me_resp = await client.get(
            "/api/v1/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me_resp.status_code == 200
        assert me_resp.json()["email"] == "admin@nexusdocs.dev"

        # Invalid login
        bad_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "admin@nexusdocs.dev", "password": "WrongPassword!"},
        )
        assert bad_resp.status_code == 401


@pytest.mark.asyncio
async def test_workspace_isolation_regression():
    """
    CRITICAL SECURITY REGRESSION:
    Proves a user from Workspace A cannot read or search documents in Workspace B.
    """
    import uuid

    suffix = uuid.uuid4().hex[:8]
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Register User A (gets their own workspace A)
        reg_a = await client.post(
            "/api/v1/auth/register",
            json={
                "email": f"user_a_{suffix}@test.com",
                "password": "SecurePassword123!",
                "display_name": "User Alpha",
            },
        )
        assert reg_a.status_code == 201
        token_a = reg_a.json()["access_token"]

        # 2. Register User B (gets their own workspace B)
        reg_b = await client.post(
            "/api/v1/auth/register",
            json={
                "email": f"user_b_{suffix}@test.com",
                "password": "SecurePassword123!",
                "display_name": "User Beta",
            },
        )
        assert reg_b.status_code == 201
        token_b = reg_b.json()["access_token"]

        # Get Workspace B ID
        ws_b_resp = await client.get(
            "/api/v1/workspaces",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        ws_b_id = ws_b_resp.json()[0]["id"]

        # User B creates a confidential document in Workspace B
        create_doc_b = await client.post(
            f"/api/v1/workspaces/{ws_b_id}/documents",
            json={
                "title": "Secret Beta Document",
                "markdown": "# Top Secret\nConfidential revenue numbers: $10,000,000.",
                "tags": ["finance", "secret"],
            },
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert create_doc_b.status_code == 201
        doc_b_id = create_doc_b.json()["id"]

        # 3. ATTEMPT 1: User A tries to list documents in Workspace B -> FORBIDDEN (403)
        unauth_list = await client.get(
            f"/api/v1/workspaces/{ws_b_id}/documents",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert unauth_list.status_code == 403

        # 4. ATTEMPT 2: User A tries to directly fetch Document B -> FORBIDDEN (403)
        unauth_doc = await client.get(
            f"/api/v1/documents/{doc_b_id}",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert unauth_doc.status_code == 403

        # 5. ATTEMPT 3: User A tries to search inside Workspace B -> FORBIDDEN (403)
        unauth_search = await client.get(
            f"/api/v1/workspaces/{ws_b_id}/search?q=revenue",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert unauth_search.status_code == 403


@pytest.mark.asyncio
async def test_document_crud_revisions_and_restore():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Login as editor
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "editor@nexusdocs.dev", "password": DEMO_PASSWORD},
        )
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Get Acme Engineering workspace
        ws_resp = await client.get("/api/v1/workspaces", headers=headers)
        acme_ws = next(w for w in ws_resp.json() if w["slug"] == "acme-engineering")
        ws_id = acme_ws["id"]

        # Create new document
        doc_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/documents",
            json={
                "title": "CRUD Test Document",
                "markdown": "# Revision 1\nInitial content.",
                "tags": ["testing"],
            },
            headers=headers,
        )
        assert doc_resp.status_code == 201
        doc_data = doc_resp.json()
        doc_id = doc_data["id"]
        assert doc_data["version_number"] == 1

        # Update document (generates revision 2)
        update_resp = await client.patch(
            f"/api/v1/documents/{doc_id}",
            json={"markdown": "# Revision 2\nUpdated content with more details."},
            headers=headers,
        )
        assert update_resp.status_code == 200
        assert update_resp.json()["version_number"] == 2

        # List revisions
        revs_resp = await client.get(f"/api/v1/documents/{doc_id}/revisions", headers=headers)
        assert revs_resp.status_code == 200
        revs = revs_resp.json()
        assert len(revs) == 2
        rev_1 = next(r for r in revs if r["version_number"] == 1)

        # Restore Revision 1
        restore_resp = await client.post(
            f"/api/v1/documents/{doc_id}/revisions/{rev_1['id']}/restore",
            headers=headers,
        )
        assert restore_resp.status_code == 200
        restored = restore_resp.json()
        assert restored["version_number"] == 3
        assert "Initial content" in restored["markdown"]

        # Soft delete document
        del_resp = await client.delete(f"/api/v1/documents/{doc_id}", headers=headers)
        assert del_resp.status_code == 200

        # Verify not returned in active list
        list_resp = await client.get(f"/api/v1/workspaces/{ws_id}/documents", headers=headers)
        assert not any(d["id"] == doc_id for d in list_resp.json())

        # Restore soft-deleted document
        rest_resp = await client.post(f"/api/v1/documents/{doc_id}/restore", headers=headers)
        assert rest_resp.status_code == 200


@pytest.mark.asyncio
async def test_hybrid_search_and_knowledge_graph():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "viewer@nexusdocs.dev", "password": DEMO_PASSWORD},
        )
        token = login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        ws_resp = await client.get("/api/v1/workspaces", headers=headers)
        acme_ws = next(w for w in ws_resp.json() if w["slug"] == "acme-engineering")
        ws_id = acme_ws["id"]

        # Hybrid Search
        search_resp = await client.get(
            f"/api/v1/workspaces/{ws_id}/search?q=PostgreSQL+pgvector+indexing&mode=all",
            headers=headers,
        )
        assert search_resp.status_code == 200
        s_data = search_resp.json()
        assert s_data["total"] > 0
        titles = " ".join(i["title"].lower() for i in s_data["items"])
        assert any(term in titles for term in ["database", "runbook", "architecture", "adr"])

        # Knowledge Graph
        graph_resp = await client.get(f"/api/v1/workspaces/{ws_id}/graph", headers=headers)
        assert graph_resp.status_code == 200
        g_data = graph_resp.json()
        assert g_data["total_nodes"] > 10
        assert g_data["total_edges"] > 0
        edge_types = {e["type"] for e in g_data["edges"]}
        assert "wiki_link" in edge_types or "shared_tag" in edge_types

        # RAG Assistant
        ask_resp = await client.post(
            f"/api/v1/workspaces/{ws_id}/ask",
            json={"question": "What database and vector indexing strategy does NexusDocs use?"},
            headers=headers,
        )
        assert ask_resp.status_code == 200
        rag_data = ask_resp.json()
        assert len(rag_data["citations"]) > 0
        assert "retrieval_metadata" in rag_data
