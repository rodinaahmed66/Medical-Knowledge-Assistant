from unittest.mock import AsyncMock

import pytest

from controllers.ProcessController import ProcessController


@pytest.fixture
def controller():
    return ProcessController(file_id="file-123", file_path="/tmp/report.pdf")


async def test_chunk_it_splits_long_text_and_keeps_metadata(controller, monkeypatch):
    long_text = "A" * 1200  # comfortably bigger than chunk_size below
    monkeypatch.setattr(
        controller,
        "load_and_parse",
        AsyncMock(return_value=([long_text], [{"source": "report.pdf"}])),
    )

    chunks = await controller.chunk_it(chunk_size=500, overlap_size=50)

    assert len(chunks) > 1
    assert all(len(chunk.page_content) <= 500 for chunk in chunks)
    assert all(chunk.metadata == {"source": "report.pdf"} for chunk in chunks)


async def test_chunk_it_overlaps_consecutive_chunks(controller, monkeypatch):
    long_text = "A" * 1200
    monkeypatch.setattr(
        controller,
        "load_and_parse",
        AsyncMock(return_value=([long_text], [{}])),
    )

    chunks = await controller.chunk_it(chunk_size=500, overlap_size=50)

    # tail of chunk N should reappear at the head of chunk N+1
    tail_of_first = chunks[0].page_content[-50:]
    head_of_second = chunks[1].page_content[:50]
    assert tail_of_first == head_of_second


async def test_chunk_it_returns_empty_list_for_no_content(controller, monkeypatch):
    monkeypatch.setattr(
        controller,
        "load_and_parse",
        AsyncMock(return_value=([], [])),
    )

    chunks = await controller.chunk_it(chunk_size=500, overlap_size=50)

    assert chunks == []
