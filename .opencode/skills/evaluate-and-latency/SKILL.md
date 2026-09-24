---
name: evaluate-and-latency
description: Use after testing the Medical-Knowledge-Assistant API endpoints (/upload/file, /chat/ask). Run the retrieval evaluation dataset and recall evaluation scripts, retrieve and report the evaluation results, then collect latency metrics from the /informations metrics endpoint, the Prometheus API, and LangSmith.
---

# Evaluate Endpoints and Collect Latency

Workflow that runs after the user has exercised the API endpoints. It has three phases.

## Phase 0 — Preconditions (check before doing anything)

1. Read `config/help.py` and `docker/env/.env.app` to learn the exact setting names (do not hardcode them — the skill must be robust to env changes). Required for phase 3: `LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`, `LANGSMITH_ENDPOINT` (default `https://api.smith.langchain.com`).
2. Check the stack is reachable (fail fast with a clear message if not):
   - FastAPI: `curl -sf http://localhost:8000/informations > /dev/null`
   - Prometheus: `curl -sf http://localhost:9090/-/ready > /dev/null`
   - The `fastapi` container: `docker ps --format '{{.Names}}' | grep -w fastapi`
3. Confirm the eval output directory exists: `eval_output/` (read-only as the sole output location). **The compose file mounts `../eval_output:/app/eval_output` relative to `docker/`, so the eval scripts (run in the container) write straight to root `eval_output/` on the host. No `docker/eval_output/` mirror exists anymore.**
4. Decide the sample size for dataset generation. Default: `25`. If the user said a number, use it. For a quick smoke test use a small size.
5. **Run the eval scripts inside the `fastapi` container, not on the host.** The app's env (`POSTGRES_HOST=postgres`, Groq/Jina keys) only resolves inside the docker network, and running on the host needs a root `.env` plus host-reachable Postgres. Standard form:
   ```bash
   docker compose -f docker/docker-compose.yml exec fastapi python -m services.EvaluationDataset
   docker compose -f docker/docker-compose.yml exec fastapi python -m services.RetriveEvaluate
   ```

## Phase 1 — Build the evaluation dataset

Run from inside the container (see Phase 0 step 5):

```bash
docker compose -f docker/docker-compose.yml exec fastapi python -m services.EvaluationDataset
```

This samples chunks from Postgres, asks the LLM to generate one question per chunk, and writes `eval_output/eval_set.json`.

- If the script prints "No chunks found in database" or exits, stop and tell the user to upload a document first via `POST /upload/file`; do not proceed.
- The script's `__main__` block uses `sample_size=25`. If a different size is needed, run `docker compose -f docker/docker-compose.yml exec fastapi python -c "import asyncio; from services.EvaluationDataset import build_eval_set; asyncio.run(build_eval_set(sample_size=<N>))"` instead of editing the file.

## Phase 2 — Run retrieval evaluation and retrieve results

Run inside the container:

```bash
docker compose -f docker/docker-compose.yml exec fastapi python -m services.RetriveEvaluate
```

This uses `eval_output/eval_set.json`, runs hybrid retrieval for each query, and writes:

- `eval_output/recall_summary.json` — overall `recall@k` (k=5).
- `eval_output/recall_at_5_details.json` — per-query records: `query`, `file_id`, `relevant_ids`, `retrieved_ids`, `retrieved_file_ids`, `recall`.

**Do not modify the scripts to change k.** The script reads `k` from the `RETRIEVAL_K` env setting (currently `5`). If another k is needed, import `recall_at_k` and call it with the desired `k` from a one-off `python -c` command.

Retrieve the results by reading both JSON files and report:

- Overall `recall@5` value.
- For k=5, list each query that scored `recall: 0` (missed the source chunk) — include the query text, expected file_id, and retrieved ids — and summarize any obvious pattern (e.g., wrong file, wrong chunk, empty retrieval).

## Phase 3 — Collect latency

Collect latency from three sources and write them into a single report file `eval_output/latency_report.json`, and print a short summary to the user.

The metric of interest is `http_request_duration_seconds`, a Prometheus Histogram labeled by `method`, `endpoint`, `status` (see `utils/metrics.py`). Endpoints to report: `/upload/file` and `/chat/ask`.

### 3a. `/informations` endpoint (scrape directly)

```bash
curl -s http://localhost:8000/informations
```

Parse the `http_request_duration_seconds_bucket{method=..., endpoint="/chat/ask", ...}` and `_sum` / `_count` series. Compute and store:

- `count` per endpoint
- `sum` (total seconds) per endpoint
- `mean` = `sum / count`

Ignore the `_info` labels.

**Critical: the app runs uvicorn with `--workers 4` and no `PROMETHEUS_MULTIPROC_DIR`, so each worker has its own in-memory registry and a single scrape randomly lands on one worker.** Poll `/informations` several times (e.g. 8 polls, ~0.5s apart), union the `(endpoint, method, status)` series, and take the max `count`/`sum` per series. A single scrape can show an endpoint with zero samples that another worker recorded. Note this aggregation and the caveat in the report.

Prometheus has no data until at least one scrape has happened after a request, so if the response is empty or only `+Inf`, tell the user to hit the endpoint again and wait up to 15s, then re-query.

### 3b. Prometheus API

Prometheus scrapes the FastAPI app every 15s (`docker/prometheus/prometheus.yml`). Query it:

```bash
# Instant query — average request duration over the scrape window:
curl -s 'http://localhost:9090/api/v1/query' --data-urlencode 'query=sum(rate(http_request_duration_seconds_sum{endpoint="/chat/ask"}[5m])) / sum(rate(http_request_duration_seconds_count{endpoint="/chat/ask"}[5m]))'

# per-endpoint by method+status, last 15 minutes:
curl -s 'http://localhost:9090/api/v1/query_range' --data-urlencode 'query=sum(rate(http_request_duration_seconds_sum{}[5m])) by (endpoint,method,status)' --data-urlencode 'start=<epoch-15m>' --data-urlencode 'end=<now>' --data-urlencode 'step=60'
```

Check the target is healthy first: `curl -s 'http://localhost:9090/api/v1/query' --data-urlencode 'query=up{job="fastapi"}'`.

**Expected outcome given the current deployment: the custom `http_request_duration_seconds` metric will be EMPTY in Prometheus.** Because uvicorn runs `--workers 4` with no `PROMETHEUS_MULTIPROC_DIR`, each worker serves `/informations` with only its own in-memory counters; Prometheus's stable scrape lands on one worker that typically has not handled any API request, so `up=1` and `scrape_samples_scraped` look fine but the histogram series are absent. Do not silently fail — record the empty result with this root cause in the report and flag it to the user as a monitoring gap (fix: `PROMETHEUS_MULTIPROC_DIR` + `prometheus_multiproc_dir` cleanup, or drop to a single worker).

### 3c. LangSmith

Use the LangSmith **Python SDK** inside the `fastapi` container (a raw `GET /runs` returns 405, and `POST /runs/query` requires session/trace ids):

```bash
docker cp <tmp>/ls_runs.py fastapi:/tmp/ls_runs.py
docker exec fastapi python /tmp/ls_runs.py
```

Script outline (secrets come from app settings inside the container — never print the key):

```python
import os, json
os.environ["LANGCHAIN_TRACING_V2"] = "true"
from config.help import get_settings
s = get_settings()
os.environ["LANGCHAIN_ENDPOINT"] = s.LANGSMITH_ENDPOINT
os.environ["LANGCHAIN_API_KEY"] = s.LANGSMITH_API_KEY
os.environ["LANGCHAIN_PROJECT"] = s.LANGSMITH_PROJECT
from langsmith import Client
client = Client()
runs = list(client.list_runs(project_name=s.LANGSMITH_PROJECT, is_root=True, limit=50))
```

Steps:
1. List the latest root runs for `LANGSMITH_PROJECT` (the ReAct agent runs are root, name `LangGraph`, run_type `chain`).
2. For each run store: `id`, `name`, `start_time`, `end_time`, `latency_seconds` = `(end_time - start_time)`, `status`, `error`, `token_usage`.
3. Aggregate: `count`, `min`, `max`, `mean`, `p50`, `p95`.
4. Handle auth errors (`401`/`403`) by telling the user the LangSmith key/project is wrong — do not retry forever.
5. **Note the expected discrepancy:** LangSmith traces only the inner LangGraph agent run, so its latency (typically ~1.5–2.5s) is well below the HTTP `/chat/ask` mean, which also includes the FaithfulnessJudge LLM call and per-worker routing.

## Phase 4 — Report

Write `eval_output/latency_report.json`:

```json
{
  "evaluation": {
    "recall@5": 0.0,
    "missed_queries": []
  },
  "latency": {
    "informations_endpoint": { "/chat/ask": { "count": 0, "sum_seconds": 0, "mean_seconds": 0 } },
    "prometheus": { "/chat/ask": { "avg_duration_5m": 0 }, "query_range_samples": [] },
    "langsmith": { "runs": [], "aggregates": { "count": 0, "mean_seconds": 0, "p95_seconds": 0 } }
  }
}
```

Include `discrepancy_notes` with any cross-source inconsistencies you observed (multi-worker registry split; LangSmith only traces the inner agent run).

Print a concise summary to the user: recall@5, missed-query count, and per-endpoint mean latency from each of the three sources (or note which source was unreachable). Flag any obvious discrepancy between sources.

## Runbook

Entry point for the whole pipeline (run after endpoints have been tested):

```bash
docker compose -f docker/docker-compose.yml exec fastapi python -m services.EvaluationDataset \
 && docker compose -f docker/docker-compose.yml exec fastapi python -m services.RetriveEvaluate
```

Then read `eval_output/recall_summary.json` and `eval_output/recall_at_5_details.json`.