import sys
import importlib
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError


@pytest.fixture(scope="module")
def gateway_module():
    sys.modules.setdefault("asyncpg", SimpleNamespace(create_pool=AsyncMock()))
    import gateway

    return importlib.reload(gateway)


def test_search_request_validates_query(gateway_module):
    model = gateway_module.SearchRequest.model_validate({"query": "hello"})
    assert model.query == "hello"


def test_search_request_rejects_missing_query(gateway_module):
    with pytest.raises(ValidationError):
        gateway_module.SearchRequest.model_validate({})


def test_embed_request_validates_text(gateway_module):
    model = gateway_module.EmbedRequest.model_validate({"text": "hello"})
    assert model.task_type == "RETRIEVAL_DOCUMENT"


def test_vector_upsert_request_current_contract(gateway_module):
    model = gateway_module.VectorUpsertRequest.model_validate(
        {"id": "1", "content": "abc", "embedding": [0.1, 0.2]}
    )
    assert model.embedding == [0.1, 0.2]


def test_vector_search_request_current_contract(gateway_module):
    model = gateway_module.VectorSearchRequest.model_validate({"embedding": [0.1, 0.2]})
    assert model.top_k == 5


def test_rank_request_validates_records(gateway_module):
    model = gateway_module.RankRequest.model_validate(
        {"query": "q", "records": [{"id": "1", "title": "T", "content": "C"}]}
    )
    assert len(model.records) == 1


def test_answer_request_validates_mode(gateway_module):
    model = gateway_module.AnswerRequest.model_validate({"query": "q", "mode": "vault"})
    assert model.mode == "vault"


def test_health_response_contains_fields(gateway_module):
    model = gateway_module.HealthResponse.model_validate(
        {
            "status": "healthy",
            "timestamp": "2026-01-01T00:00:00Z",
            "version": "3.1.0",
            "services": {"obsidian": {"status": "healthy"}},
        }
    )
    assert model.status == "healthy"
