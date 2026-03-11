import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

import pytest
from pydantic import ValidationError

from gateway import AnswerRequest, SearchRequest, VectorSearchRequest


def test_search_request_strips_query_and_preserves_value():
    req = SearchRequest(query='  hello world  ')
    assert req.query == 'hello world'


def test_search_request_rejects_empty_query_after_strip():
    with pytest.raises(ValidationError):
        SearchRequest(query='   ')


def test_answer_request_rejects_invalid_mode():
    with pytest.raises(ValidationError):
        AnswerRequest(query='hello', mode='invalid')


def test_vector_search_request_defaults_top_k_to_5():
    req = VectorSearchRequest(embedding=[0.1, 0.2, 0.3])
    assert req.top_k == 5
