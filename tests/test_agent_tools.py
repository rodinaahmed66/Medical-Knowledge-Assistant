from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

from services.AgentTools import get_agent_tools


async def test_vector_search_tool_formats_hybrid_search_hits():
    embedding_service = MagicMock()
    embedding_service.embed_text.return_value = [0.1, 0.2, 0.3]

    hit = SimpleNamespace(payload={"text": "Metformin is first-line for T2DM."}, score=0.87)
    vector_db = MagicMock()
    vector_db.hybrid_search = AsyncMock(return_value=[hit])

    vector_search, _ = get_agent_tools(embedding_service, vector_db)

    result = await vector_search.ainvoke({"query": "first-line diabetes treatment", "limit": 3})

    assert result == [{"text": "Metformin is first-line for T2DM.", "score": 0.87}]
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

    assert result == [{"content": "Latest CDC guidance...", "score": 0.75}]


async def test_web_tool_handles_no_results():
    embedding_service = MagicMock()
    vector_db = MagicMock()

    _, web_tool = get_agent_tools(embedding_service, vector_db)

    fake_client = MagicMock()
    fake_client.search = AsyncMock(return_value=None)

    with patch("services.AgentTools.AsyncTavilyClient", return_value=fake_client):
        result = await web_tool.ainvoke({"query": "obscure query with nothing back"})

    assert result == "No relevant web results found."
