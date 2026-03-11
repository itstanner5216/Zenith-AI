import os
import sys
import importlib
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest

os.environ.setdefault("GOOGLE_PROJECT_ID", "test-project")
os.environ.setdefault("GOOGLE_PROJECT_NUMBER", "123456")
os.environ.setdefault("GOOGLE_DATASTORE_ID", "test-datastore")
os.environ.setdefault("GOOGLE_ENGINE_ID", "test-engine")
os.environ.setdefault("PGVECTOR_HOST", "localhost")
os.environ.setdefault("OBSIDIAN_REST_URL", "http://localhost:27123")
os.environ.setdefault("OBSIDIAN_API_KEY", "test-key")
os.environ.setdefault("PG_DSN", "postgresql://test:test@localhost:5432/test")


class _AcquireCtx:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        return self.conn

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.fixture()
def gateway_module(monkeypatch):
    fake_asyncpg = SimpleNamespace(create_pool=AsyncMock())
    monkeypatch.setitem(sys.modules, "asyncpg", fake_asyncpg)

    import gateway

    mod = importlib.reload(gateway)
    mod.vertex_client = MagicMock()
    mod.obsidian_client = MagicMock()
    mod.obsidian_client.check_availability = AsyncMock(return_value=True)
    mod.auth_manager = MagicMock()
    mod.auth_manager.is_available = True
    mod.auth_manager.get_access_token = AsyncMock(return_value="token")
    return mod


@pytest.mark.anyio
async def test_health_endpoint_returns_service_summary(gateway_module):
    transport = httpx.ASGITransport(app=gateway_module.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/health")

    data = resp.json()
    assert resp.status_code == 200
    assert "status" in data
    assert "version" in data
    assert "services" in data
    assert "obsidian" in data["services"]


@pytest.mark.anyio
async def test_embed_endpoint_returns_embedding(gateway_module):
    gateway_module.vertex_client.embed = AsyncMock(return_value={"embedding": [0.1, 0.2], "token_count": 2})
    transport = httpx.ASGITransport(app=gateway_module.app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/v1/embed", json={"text": "hello"})

    assert resp.status_code == 200
    assert resp.json()["embedding"] == [0.1, 0.2]


@pytest.mark.anyio
async def test_embed_endpoint_rejects_empty_text(gateway_module):
    transport = httpx.ASGITransport(app=gateway_module.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/v1/embed", json={"text": ""})
    assert resp.status_code == 422


@pytest.mark.anyio
async def test_vector_upsert_current_contract_returns_validation_error(gateway_module):
    gateway_module.ensure_pgvector_ready = AsyncMock()
    transport = httpx.ASGITransport(app=gateway_module.app)
    payload = {"id": "note-1", "content": "hello", "folder_path": "Projects", "tags": ["a"]}

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/v1/vector-upsert", json=payload)

    assert resp.status_code == 422


@pytest.mark.anyio
async def test_vector_search_current_contract_returns_validation_error(gateway_module):
    gateway_module.ensure_pgvector_ready = AsyncMock()
    transport = httpx.ASGITransport(app=gateway_module.app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/v1/vector-search", json={"query": "test", "limit": 5})

    assert resp.status_code == 422


@pytest.mark.anyio
async def test_rank_endpoint_returns_scored_results(gateway_module):
    gateway_module.vertex_client.semantic_rank = AsyncMock(return_value={
        "records": [{"id": "1", "title": "Doc", "score": 0.9}]
    })
    transport = httpx.ASGITransport(app=gateway_module.app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/v1/rank",
            json={"query": "q", "records": [{"id": "1", "title": "Doc", "content": "Body"}]},
        )

    assert resp.status_code == 200
    assert resp.json()["grounding_support"][0]["score"] == 0.9


@pytest.mark.anyio
async def test_answer_endpoint_returns_answer(gateway_module):
    gateway_module.vertex_client.conversational_answer = AsyncMock(return_value={
        "answer": {"answerText": "Hello"},
        "session": "projects/test/sessions/s1",
    })
    transport = httpx.ASGITransport(app=gateway_module.app)

    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/v1/answer", json={"query": "test", "mode": "vault"})

    assert resp.status_code == 200
    assert resp.json()["answer"] == "Hello"
    assert resp.json()["session_id"] == "s1"
