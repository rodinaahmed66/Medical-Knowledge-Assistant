# Medical Knowledge Assistant

A project I built to explore agentic RAG: upload medical PDFs, ask questions, and an LLM agent decides whether to search the internal knowledge base, the web, or both before answering.

## Idea

Instead of a plain "retrieve-then-generate" pipeline, this project uses a **ReAct-style agent** that decides *for itself* which tool to call and how many times to call it:

1. A user uploads medical documents (PDF/etc). They're parsed, chunked, embedded, and stored in Qdrant (hybrid dense + sparse vectors).
2. A user asks a question via `/chat/ask`.
3. An agent (LangGraph `create_react_agent`) reasons over the question and picks between:
   - `vector_search` — hybrid semantic + keyword search over the internal medical knowledge base (Qdrant).
   - `web_tool` — live web search (Tavily) for anything not covered internally.
4. The agent loops (search → observe → search again if needed → answer) until it's confident, then returns a final answer.

This lets the system fall back to the web when the internal KB doesn't have the answer, rather than hallucinating or refusing.

## Architecture

| Component | Role |
|---|---|
| **FastAPI** | HTTP API — `/upload/file`, `/chat/ask` |
| **PostgreSQL** | Stores file metadata + text chunks (source of truth) |
| **Qdrant** | Vector DB — hybrid dense (semantic) + sparse (BM25) search with RRF fusion |
| **LlamaParse** | Parses uploaded documents (PDF, etc.) into clean markdown/text |
| **LangChain** (`RecursiveCharacterTextSplitter`) | Splits parsed documents into chunks |
| **Groq** (via OpenAI-compatible wrapper) | LLM backend for the agent's reasoning/generation |
| **Jina** (via OpenAI-compatible wrapper) | Embedding backend for dense vectors |
| **LangGraph** | Builds the ReAct agent loop (ties LLM + tools together) |
| **Tavily** | Web search tool for the agent |
| **Prometheus + Grafana** | Infrastructure-level monitoring (HTTP metrics) |
| **LangSmith** | Agent/LLM-level tracing (what the agent did, step by step) |

## How to Run

### Prerequisites
- Docker + Docker Compose
- API keys for: Groq, Jina, LlamaParse (Llama Cloud), Tavily, LangSmith

### 1. Configure environment
Create `docker/env/.env.app` (used by the `fastapi` service) with at minimum:

```env
APP_VERSION=1
Max_SIZE_FILE=10
FILE_ALLOWED_TYPES=["application/pdf"]
CHUNK_SIZE=1000
OVERLAP_SIZE=200

POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=password
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_MAIN_DATABASE=medical_files

LLAMA_CLOUD_API_KEY=your_key

DEFAULT_LAN=en
PRIMARY_LAN=en

GROQ_KEY=your_key
GROQ_URL=https://api.groq.com/openai/v1
JINA_KEY=your_key
JINA_URL=https://api.jina.ai/v1

CHAT_MODEL_ID=your_groq_chat_model
GENERATION_MODEL_ID=your_groq_generation_model
EMBEDDING_MODEL_ID=your_jina_embedding_model
EMBEDDING_MODEL_SIZE=768

INPUT_DEFAULT_MAX_CHARACTERS=1000
GENERATION_DEFAULT_MAX_TOKENS=1000
GENERATION_DEFAULT_TEMPERATURE=0.1
AGENT_TEMPERATURE=0.1

QDRANT_DB_METHOD=Cosine
QDRANT_DB_PATH=http://qdrant:6333
QDRANT_COLLECTION_NAME=medical_chunks

TAVILY_KEY=your_key

LANGSMITH_TRACING_V2=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_API_KEY=your_key
LANGSMITH_PROJECT=medical-rag
```

Also create `docker/env/.env.grafana` with at least `GF_SECURITY_ADMIN_PASSWORD=your_password`.

### 2. Start the stack

```bash
cd docker
docker compose up --build
```

This brings up:
- FastAPI on `:8000`
- PostgreSQL on `:5432`
- Qdrant on `:6333` / `:6334`
- Prometheus on `:9090`
- Grafana on `:3000`

On startup, `entrypoint.sh` runs Alembic migrations and ensures the Qdrant collection exists.

### 3. Upload a document

```bash
curl -X POST http://localhost:8000/upload/file \
  -F "file=@/path/to/document.pdf"
```

### 4. Ask a question

```bash
curl -X POST http://localhost:8000/chat/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "How does the guideline define HPV DNA genotyping levels?"}'
```

### 5. (Optional) Evaluate retrieval quality

```bash
python -m eval.evaluation_dataset   # generates eval_output/eval_set.json
python -m eval.recall_evaluation    # computes Recall@1/3/5/10
```

## Monitoring & Debugging

- **Grafana** (`:3000`) — dashboards over Prometheus metrics (request rate, latency, error rate).
- **Prometheus** (`:9090`) — raw HTTP-level metrics, scraped from FastAPI's `/informations` endpoint.
- **LangSmith** — full trace of each agent run: every tool call, prompt, and LLM response, useful for debugging *why* the agent answered the way it did.

## Known Limitations / Next Steps
- No reranking step after hybrid search — recall@1 is currently weaker than recall@10.
- Agent sometimes falls back to multiple sequential web searches for one question.
- `semantic_search` (dense-only) in `Vector_DB_Model` uses an older Qdrant API and isn't currently used by the agent — candidate for removal or update.
