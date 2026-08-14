import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from services.AgentTools import _stringify_result, get_agent_tools


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("already a string", "already a string"),
        (None, "No results found."),
        ([{"text": "chunk", "score": 0.9}], json.dumps([{"text": "chunk", "score": 0.9}])),
        ({"content": "web result"}, json.dumps({"content": "web result"})),
    ],
)
def test_stringify_result_coerces_expected_types(raw, expected):
    assert _stringify_result(raw) == expected


def test_stringify_result_falls_back_to_str_for_unserializable_objects():
    class Weird:
        def __str__(self):
            return "weird-object"

    # a bare object isn't JSON-serializable; json.dumps(default=str) should
    # still succeed via the default=str fallback rather than raising
    result = _stringify_result(Weird())
    assert result == '"weird-object"' or result == "weird-object"


async def test_vector_search_tool_formats_hybrid_search_hits():
    embedding_service = MagicMock()
    embedding_service.embed_text.return_value = [0.1, 0.2, 0.3]

    hit = SimpleNamespace(payload={"text": "Metformin is first-line for T2DM."}, score=0.87)
    vector_db = MagicMock()
    vector_db.hybrid_search = AsyncMock(return_value=[hit])

    vector_search, _ = get_agent_tools(embedding_service, vector_db)

    result = await vector_search.ainvoke({"query": "first-line diabetes treatment", "limit": 3})

    payload = json.loads(result)
    assert payload == [{"text": "Metformin is first-line for T2DM.", "score": 0.87}]
    vector_db.hybrid_search.assert_awaited_once()


async def test_vector_search_tool_handles_no_hits():
    embedding_service = MagicMock()
    embedding_service.embed_text.return_value = [0.1, 0.2, 0.3]

    vector_db = MagicMock()
    vector_db.hybrid_search = AsyncMock(return_value=[])

    vector_search, _ = get_agent_tools(embedding_service, vector_db)

    result = await vector_search.ainvoke({"query": "unrelated question"})

    assert result == "No relevant internal documents found."


async def test_web_tool_formats_tavily_results():
    embedding_service = MagicMock()
    vector_db = MagicMock()

    _, web_tool = get_agent_tools(embedding_service, vector_db)

    fake_client = MagicMock()
    fake_client.search = AsyncMock(
        return_value={"results": [{"content": "Latest CDC guidance...", "score": 0.75}]}
    )

    with patch("services.AgentTools.AsyncTavilyClient", return_value=fake_client):
        result = await web_tool.ainvoke({"query": "latest flu shot guidance"})

    payload = json.loads(result)
    assert payload == [{"content": "Latest CDC guidance...", "score": 0.75}]
