# MediQuery: Agentic RAG for Medical Intelligence

**MediQuery** is a high-performance medical document assistant. Unlike standard RAG (Retrieval-Augmented Generation) systems that are limited to a static database, MediQuery uses an **Autonomous ReAct Agent**. This agent intelligently decides whether to retrieve answers from your private medical library or search the live web for the latest clinical research and news.

---

## 🛠 Technology Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Orchestration** | **FastAPI / LangGraph** | High-speed API and Agentic state management. |
| **LLM Inference** | **Groq (Llama 3)** | Fast reasoning and natural language generation. |
| **Parsing** | **LlamaParse** | Converts complex medical PDFs/tables into Markdown. |
| **Relational DB** | **PostgreSQL** | Stores file metadata, chunk history, and relations. |
| **Vector DB** | **Qdrant** | Performs Hybrid Search (Dense + Sparse/BM25). |
| **Embeddings** | **Jina AI & FastEmbed** | Semantic (Dense) and Keyword (Sparse) vectorization. |
| **Search Tool** | **Tavily AI** | Specialized AI web search for medical data. |
| **Observability** | **Prometheus & Grafana** | Real-time monitoring of latency and API health. |

---

## 🏗 Project Architecture

The project follows a clean **Controller-Service-Model** pattern:
- **Routers**: Define the API surface.
- **Controllers**: Handle business logic (file validation, path generation).
- **Models**: Interact with PostgreSQL (via SQLAlchemy) and Qdrant.
- **Services**: Manage external AI integrations (LLMs, Tools, Parsing).

---

## 📥 Ingestion Pipeline: `/upload/file`

When a file is uploaded, the system executes a multi-stage pipeline:

1.  **Validation**: The `DataController` validates the file against allowed MIME types and size limits defined in `BaseSettings`.
2.  **ID Generation**: A unique UUID5 is generated based on the filename to ensure data consistency.
3.  **LlamaParse Ingestion**: The file is sent to LlamaCloud. It parses complex medical layouts (like tables or dosage charts) into Markdown format.
4.  **Recursive Chunking**: The text is split into chunks using `RecursiveCharacterTextSplitter` with defined `CHUNK_SIZE` and `OVERLAP`.
5.  **PostgreSQL Storage**: The file metadata and text chunks are saved into the `files` and `chunks` tables.
6.  **Hybrid Indexing**:
    *   **Dense Vectors**: Chunks are embedded using Jina AI for semantic meaning.
    *   **Sparse Vectors**: Chunks are embedded using FastEmbed (BM25) for exact keyword matching (e.g., drug names).
7.  **Qdrant Upsert**: All data (Vectors + Text + Metadata) is stored in Qdrant for retrieval.

---

## 💬 Agentic Pipeline: `/chat/ask`

The chat endpoint utilizes a **ReAct Agent** architecture that follows a "Reason-Act-Observe" loop:

1.  **Reasoning**: The Groq-hosted LLM analyzes the user's medical query.
2.  **Tool Selection**: The agent decides which tool is best suited for the query:
    *   **`vector_search`**: Used if the query relates to the internal medical documents. It uses **Reciprocal Rank Fusion (RRF)** in Qdrant to find the best match between keyword and semantic results.
    *   **`web_tool`**: Used if the internal search fails or if the query requires up-to-the-minute medical information from the web.
3.  **Observation**: The agent reads the results from the selected tool.
4.  **Synthesis**: The agent combines the retrieved context with its medical knowledge to generate a safe, accurate response.

---

## 📊 Monitoring & Evaluation

### 1. Prometheus Monitoring
Custom middleware tracks every request. You can view:
- **`http_request_duration_seconds`**: Latency of LLM responses and file processing.
- **`http_requests_total`**: Count of success/failure status codes.

### 2. Retrieval Evaluation
The project includes a dedicated evaluation suite in `evaluation_recall.py`:
- **Recall@K**: Measures how often the correct document is retrieved in the top K results.
- **Synthetic Dataset**: Automatically generates medical questions from your own data to test the system's accuracy.

---

## 🚀 How to Run

### 1. Requirements
- Docker & Docker Compose
- API Keys: Groq, Jina, Tavily, LlamaParse.

### 2. Setup
Create an `.env` file in the root and provide your API keys and database credentials.

### 3. Execution
Launch the entire ecosystem (App, Postgres, Qdrant, Prometheus, Grafana, Node-Exporter) with:
```bash
docker-compose up --build
