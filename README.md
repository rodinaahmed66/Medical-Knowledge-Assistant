# Medical Knowledge Assistant — Agentic RAG Medical Document Assistant

An agentic Retrieval-Augmented Generation (RAG) system for medical documents. Upload clinical/medical PDFs, and ask natural-language questions — a LangGraph ReAct agent decides whether to answer from your own indexed documents, fall back to a live web search, or admit it doesn't know, rather than guessing.

Built as a full production-style stack: FastAPI backend, hybrid dense+sparse vector search in Qdrant, PostgreSQL for structured metadata, LlamaParse for high-fidelity medical PDF parsing, LangSmith tracing for debugging agent behavior, and Prometheus/Grafana for monitoring — all containerized with Docker Compose.

---

## Table of Contents

- [How it works](#how-it-works)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup](#setup)
- [Running the project](#running-the-project)
- [API reference](#api-reference)
- [Retrieval evaluation](#retrieval-evaluation)
- [Monitoring](#monitoring)
- [Notes & known gaps](#notes--known-gaps)

---

## How it works

```
                 ┌────────────────────┐
   PDF upload → │  DataController     │  (validate type/size, save to disk)
                 └─────────┬──────────┘
                           ▼
                 ┌────────────────────┐
                 │  ProcessController │  LlamaParse → markdown, preserving
                 │                    │  tables / headings / clinical lists
                 └─────────┬──────────┘
                           ▼
                 ┌────────────────────┐
                 │ RecursiveCharacter  │  chunking (CHUNK_SIZE / OVERLAP_SIZE)
                 │ TextSplitter        │
                 └─────────┬──────────┘
                           ▼
          ┌────────────────┴─────────────────┐
          ▼                                  ▼
 ┌──────────────────┐              ┌───────────────────────┐
 │ PostgreSQL        │              │ Qdrant                │
 │ (files + chunks    │              │ dense vector (Jina)   │
 │  metadata, via     │              │ + sparse vector (BM25)│
 │  SQLAlchemy)        │              │ fused with RRF         │
 └──────────────────┘              └───────────────────────┘

   User question → /chat/ask
          ▼
 ┌──────────────────────────────────────────────┐
 │ LangGraph ReAct Agent (AgentService)          │
 │  tool 1: vector_search → Qdrant hybrid search │
 │  tool 2: web_tool      → Tavily web search    │
 │  Rules enforced via AGENT_PROMPT_EN:          │
 │   - always try vector_search first            │
 │   - only fall back to web_tool if internal    │
 │     docs are missing/insufficient              │
 │   - never diagnose — recommend a professional │
 └──────────────────────────────────────────────┘
          ▼
        Answer (+ which source was used)
```

Every step is traced through **LangSmith**, and both the API and infra layers export metrics to **Prometheus**, visualized in **Grafana**.

---

## Tech stack

| Layer | Tool |
|---|---|
| API | FastAPI |
| Agent orchestration | LangGraph (`create_react_agent`) + LangChain |
| LLM (agent reasoning) | Groq, via OpenAI-compatible `ChatOpenAI` client |
| LLM (generation, eval question synth) | configurable OpenAI-compatible provider (`GENERATION_MODEL_ID`) |
| Embeddings | Jina AI, via OpenAI-compatible embeddings API |
| Vector store | Qdrant (hybrid dense + sparse/BM25 search, fused with RRF) |
| Document parsing | LlamaParse (medical-document-tuned parsing instructions) |
| Chunking | LangChain `RecursiveCharacterTextSplitter` |
| Relational DB | PostgreSQL + SQLAlchemy (async) + Alembic migrations |
| Web search fallback | Tavily |
| Tracing/debugging | LangSmith |
| Monitoring | Prometheus + Grafana + node-exporter + postgres-exporter |
| Containerization | Docker Compose |

---

## Project structure

```
.
├── config/                # Pydantic settings (env-driven config)
├── controllers/           # DataController (upload/validate), ProcessController (parse/chunk)
├── models/                # SQLAlchemy schemes (File, Chunk) + Vector_DB_Model (Qdrant)
├── routers/                # FastAPI routers: /upload, /chat
├── services/
│   ├── LLMServices/        # OpenAIProvider (generation + embeddings, OpenAI-compatible)
│   ├── AgentService.py     # LangGraph ReAct agent setup
│   ├── AgentTools.py        # vector_search + web_tool tool definitions
│   └── prompt/              # agent + parsing instruction prompts
├── evaluation/              # eval set generation + recall@k scoring scripts
├── docker/                  # Dockerfile + entrypoint.sh
├── prometheus/               # prometheus.yml scrape config
├── docker-compose.yml
└── .env.example
```

---

## Prerequisites

- Docker + Docker Compose
- API keys for:
  - **LlamaParse** (document parsing) — https://cloud.llamaindex.ai
  - **Groq** (chat/agent model, OpenAI-compatible endpoint) — https://console.groq.com
  - **Jina AI** (embeddings, OpenAI-compatible endpoint) — https://jina.ai
  - **Tavily** (web search fallback tool) — https://tavily.com
  - **LangSmith** (tracing, optional but recommended) — https://smith.langchain.com

---

## Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/rodinaahmed66/Medical-Knowledge-Assistant.git
   cd Medical-Knowledge-Assistant
   ```

2. Copy the environment template and fill in your own values:
   ```bash
   cp .env.example .env
   ```
   For Docker Compose, this same file is expected at `docker/env/.env.app` (referenced by the `fastapi` service's `env_file`). Copy or symlink it there too:
   ```bash
   mkdir -p docker/env
   cp .env docker/env/.env.app
   ```
   Grafana and the Postgres exporter also read their own small env files — see `docker/env/.env.grafana` and `docker/env/.env.postgres-exporter` (admin user/password for Grafana; `DATA_SOURCE_URI` / `DATA_SOURCE_USER` / `DATA_SOURCE_PASS` for the exporter, matching your Postgres credentials below).

3. **Important — align Postgres credentials.** The `postgres` service in `docker-compose.yml` currently hardcodes `POSTGRES_PASSWORD=password` and `POSTGRES_DB=medical_files` directly in the compose file, while the app reads `POSTGRES_USERNAME` / `POSTGRES_PASSWORD` / `POSTGRES_MAIN_DATABASE` from its own env file. Make sure these match (either hardcode the same values in `.env.app`, or move the compose file to use `${POSTGRES_PASSWORD}` / `${POSTGRES_DB}` substitution) — otherwise the app container will fail to authenticate against Postgres.

4. Run the Alembic migrations config (`models/alembic.ini`) points at the same Postgres connection — no separate setup needed, this runs automatically on container startup via `entrypoint.sh`.

---

## Running the project

Start everything (FastAPI, Postgres, Qdrant, Prometheus, Grafana, exporters):

```bash
docker compose -f docker/docker-compose.yml up --build
```

On startup, `entrypoint.sh` automatically:
1. Runs Alembic migrations (`alembic upgrade head`) to create the `files` / `chunks` tables.
2. Ensures the Qdrant collection (`QDRANT_COLLECTION_NAME`) exists, with a `dense` vector (size `EMBEDDING_MODEL_SIZE`) and a `sparse` (BM25) vector configured for hybrid search.

Once running:
- API: http://localhost:8000
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3000
- Qdrant dashboard: http://localhost:6333/dashboard

---

## API reference

### `POST /upload/file`
Upload a medical document. Validates type (`FILE_ALLOWED_TYPES`) and size (`Max_SIZE_FILE`), parses it with LlamaParse, chunks it, stores chunk metadata in Postgres, embeds each chunk, and indexes into Qdrant.

```bash
curl -X POST http://localhost:8000/upload/file \
  -F "file=@/path/to/document.pdf"
```

Response:
```json
{
  "signal": "PROCESS_SUCCESS",
  "file_id": "…",
  "chunks_parsed": 42
}
```

### `POST /chat/ask`
Ask a question. The agent searches your indexed documents first, falls back to the web only if needed, and states which source it used.

```bash
curl -X POST http://localhost:8000/chat/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "What are the diagnostic criteria for type 2 diabetes?"}'
```

Response:
```json
{
  "signal": "CHAT_SUCCESS",
  "answer": "…"
}
```

---

## Retrieval evaluation

Two scripts under `evaluation/` measure retrieval quality end-to-end:

1. **`evaluation_dataset.py`** — samples chunks already indexed in Postgres, and for each one asks an LLM to generate a realistic question that chunk should answer, producing `eval_output/eval_set.json`.
   ```bash
   python -m evaluation.evaluation_dataset
   ```

2. **`recall_evaluation.py`** (recall@k script) — runs each generated question through the same hybrid search used in production, and checks whether the source chunk was retrieved in the top-k, for k = 1, 3, 5, 10.
   ```bash
   python -m evaluation.recall_evaluation
   ```
   Outputs `eval_output/recall_summary.json` plus per-query detail files, so you can inspect exactly which questions failed to retrieve their source chunk.

Current baseline: **Recall@5 ≈ 84.4%** (n=141 sampled chunks). Cross-encoder reranking on top of the RRF-fused hybrid results is the next planned step to push this further.

---

## Monitoring

`prometheus/prometheus.yml` scrapes:
- `fastapi:8000/informations` — custom app metrics (see `utils/metrics.py`)
- `qdrant:6333/metrics`
- `postgres-exporter:9187`
- `node-exporter:9100`
- Prometheus itself

Import a dashboard in Grafana (http://localhost:3000) pointing at the Prometheus data source to visualize request latency/throughput, Qdrant health, and Postgres stats.

---

## Notes & known gaps

- **Postgres credentials mismatch** between `docker-compose.yml` (hardcoded) and app settings (env-driven) — see step 3 in [Setup](#setup). Fix before first run.
- `AsyncTavilyClient` is imported in `AgentTools.py` but the actual call (`search_client.search(...)`) is made synchronously (not awaited) — works today because Tavily's `.search` isn't a coroutine on this client, but double-check if you upgrade the `tavily` package.
- `semantic_search` (dense-only) is defined on `Vector_DB_Model` but the agent only ever calls `hybrid_search` — kept for completeness/debugging.
- No auth/rate-limiting on the API yet — add before exposing this publicly.
- `Chat_Request` only carries `query`; no conversation/session id, so each `/chat/ask` call is stateless (no multi-turn memory yet).
