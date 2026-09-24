# Medical Knowledge Assistant

An agentic Retrieval-Augmented Generation (RAG) system for medical documents — built with a production-style architecture, including hybrid vector search, automated evaluation, and full observability.

## Overview

Upload medical PDFs (clinical guidelines, research papers), then ask questions in natural language. A ReAct agent decides whether to search the internal knowledge base, the live web, or both, and every answer is automatically scored for faithfulness to its retrieved sources.


## Tech Stack
 
| Layer | Framework/Tool | What it does here |
|---|---|---|
| API | **FastAPI** | Serves the `/upload/file` and `/chat/ask` endpoints; async throughout |
| Agent orchestration | **LangGraph** | Builds a ReAct agent that reasons in a loop — decides which tool to call, observes the result, and decides again until it has an answer |
| LLM inference | **Groq** | Runs the generation model and the faithfulness-judge model, via an OpenAI-compatible endpoint |
| Embeddings | **Jina** | Converts document chunks and queries into dense vectors for semantic search |
| Vector store | **Qdrant** | Stores and searches chunk vectors; runs *hybrid* search — dense (semantic) + sparse/BM25 (keyword) combined via Reciprocal Rank Fusion, so both meaning and exact terms count |
| Relational store | **PostgreSQL** | Stores file metadata, processing status, and chunk text/order — the system of record alongside Qdrant's vectors |
| Document parsing | **LlamaParse** | Extracts clean, structured text (including tables) from uploaded PDFs before chunking |
| Web search tool | **Tavily** | Gives the agent a second tool — live web search — for questions the internal knowledge base can't answer |
| Evaluation | **DeepEval** | Scores each chat answer's *faithfulness* — whether it's actually grounded in the retrieved context, or hallucinated |
| Observability | **Prometheus + Grafana** | Collects and visualizes request/agent latency over time |
| Tracing | **LangSmith** | Step-by-step trace of what the agent did on each run — which tool it called, what it retrieved, how long each step took |
| Migrations | **Alembic** | Versions and applies PostgreSQL schema changes |
| CI/CD | **GitHub Actions → GHCR** | Runs tests on every PR; builds and pushes a container image on merge to main |

## Why These Frameworks?

| Framework | Why it was chosen |
|---|---|
| **FastAPI** | Async-native — the whole pipeline is I/O-bound (LLM calls, parsing, DB/vector queries) |
| **LangGraph** | An explicit, traceable agent graph instead of an opaque agent executor |
| **Groq** | Low-latency, OpenAI-compatible — one client interface drives the chat, generation, and judge models |
| **Jina** | OpenAI-compatible embeddings API — the model is swappable via config, no code changes |
| **Qdrant** | Hybrid search (dense + BM25) with RRF fusion built in — no separate retrieval layer needed |
| **PostgreSQL** | Relational source of truth for file/chunk metadata, alongside Qdrant's vectors |
| **LlamaParse** | Table- and layout-aware PDF parsing — better chunk quality than raw text extraction |
| **Tavily** | Search API built for LLM agents — clean content blocks, async client, drops straight into the tool set |
| **DeepEval** | Ready-made LLM-judge faithfulness metric with a pytest-style interface |
| **Prometheus + Grafana** | Standard, low-overhead metrics and dashboards with no bespoke code |
| **LangSmith** | Zero-code tracing for LangGraph runs; independently cross-validates the custom latency metric |
| **Alembic** | Versioned, reversible schema migrations for SQLAlchemy |
| **GitHub Actions → GHCR** | Tests and image publishing live next to the code, one registry for CI and deployment |

> **Golden thread:** every *agent-facing* dependency (LLM, embeddings, retrieval, web search) was picked for being either OpenAI-compatible or async-native, so the orchestration code stays stable even if a single provider is swapped.

## Features

- **Hybrid retrieval** — combines dense semantic search and sparse BM25 keyword search via Reciprocal Rank Fusion, rather than dense search alone.
- **Agentic tool use** — the agent autonomously chooses between the internal knowledge base and live web search per query, rather than always retrieving from one fixed source.
- **Automated faithfulness scoring** — every chat response is graded against its retrieved context, flagging answers that may be ungrounded.
- **Retrieval evaluation pipeline** — an LLM generates one realistic question per indexed chunk, then a Recall@k script measures whether hybrid search retrieves the correct source chunk.
- **Full observability** — request-level latency (Prometheus/Grafana), agent-only latency (isolated via a custom metric), and step-by-step agent tracing (LangSmith).
- **Idempotent, safe re-uploads** — re-uploading a file cleanly replaces its old chunks and vectors rather than duplicating or colliding with them.

## Getting Started

### Prerequisites
- Docker & Docker Compose
- API keys: Groq, Jina, LlamaParse, Tavily, LangSmith

### Setup

1. Clone the repo and create the required env files under `docker/env/`:
   - `.env.app` — app settings (see `config/help.py` for the full list of required fields)
   - `.env.postgres` — `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
   - `.env.grafana` — Grafana admin credentials
   - `.env.postgres-exporter` — Postgres exporter connection string

   > **Note:** values in these files should **not** be wrapped in quotes — Docker Compose's `env_file` parser takes quote characters literally rather than stripping them.

2. Build and start the stack:
   ```bash
   docker compose -f docker/docker-compose.yml up --build -d
   ```

3. Confirm everything is healthy:
   ```bash
   docker compose -f docker/docker-compose.yml ps
   ```

### Usage

**Upload a document:**
```bash
curl -X POST http://localhost:8000/upload/file \
  -F "file=@/path/to/document.pdf"
```

**Ask a question:**
```bash
curl -X POST http://localhost:8000/chat/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the recommended follow-up for a positive HPV31 result?"}'
```

**Service endpoints:**
| Service | URL |
|---|---|
| API | http://localhost:8000 |
| Metrics (Prometheus format) | http://localhost:8000/informations |
| Prometheus | http://localhost:9090 |
| Grafana | http://localhost:3000 |
| Qdrant dashboard | http://localhost:6333/dashboard |

## Evaluation

Run the retrieval evaluation pipeline (inside the container, since it needs the internal Docker network):

```bash
docker compose -f docker/docker-compose.yml exec fastapi python -m services.EvaluationDataset
docker compose -f docker/docker-compose.yml exec fastapi python -m services.RetriveEvaluate
```

This generates an LLM-authored eval set from your indexed chunks, then reports `recall@k` — the fraction of queries where hybrid search retrieved the correct source chunk in the top *k* results — along with a per-query breakdown of misses.

## Results

### Retrieval — Recall@k

Evaluated on a question set auto-generated from:

1. **WHO cervical cancer/HPV clinical guideline**
2. **List of Basic Sources in English for a Medical Faculty Library**
3. **WHO screening and treatment of cervical pre-cancer lesions for cervical cancer prevention**

(one question per sampled chunk):

chunk_size=1200
over_lap=250
| Metric | Value |
|---|---|
| Recall@3 | **0.68** (17/25) |
| Missed queries | 8 |


chunk_size=600
over_lap=120

| Metric | Value |
|---|---|
| Recall@5 | **0.83** (49/50) |
| Missed queries | 8 |


chunk_size=600
over_lap=120
| Metric | Value |
|---|---|
| Recall@5 | **0.75** (169/200) |
| Missed queries | 31 |



**Failure analysis:** every miss was a *semantic near-miss within the correct document* — hybrid search consistently found the right topic area but not the exact source chunk. No misses retrieved the wrong file or returned empty results. The clearest pattern: two near-duplicate questions about HPV genotyping (type-specific vs. positive/negative results) both missed, suggesting closely related content was split across adjacent chunks that the embedding model couldn't fully distinguish. Next step to improve this: smaller chunk size or overlap tuning, or adding a re-ranking step on top of the current RRF fusion.

### Latency

Measured via three independent sources — a custom `/informations` Prometheus endpoint, live Prometheus queries, and LangSmith tracing:

| Measurement | Value | Source |
|---|---|---|
| Total `/chat/ask` response time | ~6.5s | Prometheus (`http_request_duration_seconds`) |
| Agent-only time (retrieval + generation) | ~1.8–2.0s | Custom `agent_response_duration_seconds` metric, cross-validated against LangSmith (mean 1.98s, p95 2.10s, n=6) |
| Faithfulness-scoring overhead | ~4.5s (derived) | Total minus agent-only |

**Key finding:** the agent itself is fast — under 2 seconds — and two independent measurement methods (an internal Prometheus histogram and external LangSmith tracing) agree closely, confirming the instrumentation is accurate. The majority of end-to-end latency (~70%) comes from the post-hoc faithfulness check, currently a synchronous call — see *Known Limitations* below.

## Observability

Two latency metrics are tracked separately, to distinguish the agent's own reasoning time from the full request lifecycle:

- `http_request_duration_seconds{endpoint="/chat/ask"}` — total time a user actually waits, including retrieval, generation, and faithfulness scoring.
- `agent_response_duration_seconds` — isolates just the LangGraph agent's `answer()` call, cross-validated against independent LangSmith tracing (both converge on ~1.8–2.0s for agent-only latency).

This breakdown surfaced a real finding: of a ~6.5s total response time, only ~2s is the agent itself — the remainder is a synchronous faithfulness-scoring call, currently a known optimization target (see below).

## Known Limitations & Next Steps

- **FaithfulnessJudge is a blocking call** inside an async route — it currently runs synchronously rather than via `asyncio.to_thread`, which can stall other concurrent requests during scoring.
- **Prometheus multi-worker gap** — the API runs with 4 Uvicorn workers and no `PROMETHEUS_MULTIPROC_DIR` configured, so each worker keeps an isolated in-memory metrics registry. A single scrape can miss real traffic recorded by a different worker. Fix: configure multiprocess metric aggregation, or reduce to a single worker for metrics accuracy.
- **Planned:** input/output guardrails (prompt injection defenses), a frontend, and deployment to a stateful-hosting-friendly platform (Railway, Render, or Fly.io).

## Project Structure

```
├── config/          # Settings (pydantic-settings)
├── controllers/      # Upload validation, PDF parsing/chunking
├── docker/           # Compose stack, Dockerfile, entrypoint, Prometheus/Grafana config
├── models/            # SQLAlchemy schemas, Qdrant client wrapper, Alembic migrations
├── routers/           # FastAPI route handlers (/upload, /chat)
├── services/           # Agent orchestration, LLM providers, evaluation scripts
├── tests/               # Pytest suite
└── utils/                # Prometheus middleware/metrics
```
