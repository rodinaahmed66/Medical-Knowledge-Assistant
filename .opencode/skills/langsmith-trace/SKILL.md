---
name: langsmith-trace
description: Use when the user asks to open or inspect LangSmith traces, measure agent/LLM latency, or gather endpoint performance data (Prometheus /informations metric `http_request_duration_seconds`, /chat/ask, /upload/file timing) while the stack runs locally or in a Codespace.
---

# LangSmith Trace & Endpoint Latency Collector

Goal: turn a user's "check the traces / how slow is it?" into a concrete latency
report backed by LangSmith run data and the app's own Prometheus metrics.

## 0. Preconditions

- Stack must be running: `docker compose -f docker/docker-compose.yml ps` (from repo root) or
  in a Codespace run `docker compose -f docker/docker-compose.yml up --build -d` first.
- Services: FastAPI `:8000`, Prometheus `:9090`, Grafana `:3000`, Qdrant `:6333`.
- LangSmith creds + project name live in `docker/env/.env.app`
  (`LANGSMITH_API_KEY`, `LANGSMITH_PROJECT`). Read them once into shell vars;
  never print the key value back to the user.

## 1. Open LangSmith in the browser

- Web UI: https://smith.langchain.com → your project (`LANGSMITH_PROJECT` value,
  e.g. "medical knowledge assistant"). From a Codespace this is a plain web URL,
  no port forwarding needed.
- If the user wants it opened from the terminal in the workspace, print the URL
  and the project name, and hand off to the browser.

## 2. Pull traces via the LangSmith API

Base URL `https://api.smith.langchain.com`.

```bash
LANGSMITH_API_KEY="$(grep '^LANGSMITH_API_KEY=' docker/env/.env.app | cut -d= -f2 | tr -d '"')"
LANGSMITH_PROJECT="$(grep '^LANGSMITH_PROJECT=' docker/env/.env.app | cut -d= -f2 | tr -d '"')"
curl -s -u "$LANGSMITH_API_KEY:" \
  "https://api.smith.langchain.com/runs?limit=50&run_type=chain&project_name=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$LANGSMITH_PROJECT")" \
  -o /tmp/langsmith_runs.json
python3 - <<'PY'
import json
runs = json.load(open('/tmp/langsmith_runs.json'))
d = runs if isinstance(runs, list) else runs.get('runs', [])
from datetime import datetime
def parse(t): return datetime.fromisoformat(t.replace('Z', '+00:00'))
rows = []
for r in d:
    try: lat = (parse(r['end_time']) - parse(r['start_time'])).total_seconds()
    except Exception: lat = float('nan')
    rows.append((lat, r.get('name'), r.get('run_type'), r.get('id'), r.get('start_time')))
rows.sort(reverse=True)
for lat, name, rtype, rid, st in rows[:15]:
    print(f"{lat:7.2f}s  {rtype:8s}  {name[:60]:60s}  {rid}")
PY
```

Trace URL pattern for a run: `https://smith.langchain.com/projects/p/{project}/r/{run_id}`
(browser resolves org automatically). Use the `/runs?...&trace_id=...` param to
pull the full nested trace of a single run when drilling into a slow request.

## 3. Endpoint latency toolbox

### 3a. One-shot request timing (curl)

```bash
curl -s -o /dev/null -w 'chat/ask  time_total=%{time_total}s\n' \
  -X POST http://localhost:8000/chat/ask \
  -H 'Content-Type: application/json' \
  -d '{"query":"What are the diagnostic criteria for type 2 diabetes?"}'
```

### 3b. Prometheus metric (`/informations`)

Histogram name: `http_request_duration_seconds` (buckets 0.01, 0.1, 0.5, 1, 2, 5,
10, 30, 60, +inf; labels method/endpoint/status — see `utils/metrics.py`).

```bash
curl -s localhost:8000/informations | grep http_request_duration_seconds
```

Metrics exclude `/informations` itself, so scrape latency is not self-polluting.

### 3c. Percentiles from histogram buckets (p50/p95/p99 per endpoint)

Python, no math lib needed:

```bash
curl -s localhost:8000/informations -o /tmp/m.txt
python3 - <<'PY'
from collections import defaultdict
raw = {}
for line in open('/tmp/m.txt'):
    if not line.startswith('http_request_duration_seconds_bucket'): continue
    name, lv = line.strip().split(' ', 1)
    le = name[name.index('le="'):].split('"', 2)[1]
    labels = dict(x.split('=') for x in name[name.index('{')+1:name.index('}')].split(','))
    labels['le'] = le
    key = (labels['method'], labels['endpoint'], labels['status'])
    raw.setdefault(key, {})[float(le)] = int(lv)
for (method, ep, status), buckets in sorted(raw.items()):
    if not any(v for v in buckets.values()): continue
    total = buckets.get(float('inf'), 0) or max(buckets.values())
    edges = sorted(buckets)
    def q(frac):
        target = frac * total
        acc = 0
        for le in edges:
            acc = buckets[le]
            if acc >= target: return le
        return le
    print(f"{method:6s} {ep:20s} {status} n={total:4d} p50={q(0.5):6.1f}s p95={q(0.95):7.1f}s p99={q(0.99):7.1f}s")
PY
```

### 3d. Prometheus server queries (server-side, `:9090`)

```bash
curl -s 'http://localhost:9090/api/v1/query' \
  --data-urlencode 'query=histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[10m])) by (le, endpoint))'
```

### 3e. Qdrant view

```bash
curl -s localhost:6333/metrics | head -50
curl -s "localhost:6333/collections/$(grep '^QDRANT_COLLECTION_NAME=' docker/env/.env.app | cut -d= -f2 | tr -d '"')"
```

## 4. Correlate slow requests to traces

1. Find a slow request from section 3 (p95 endpoint or a `time_total`).
2. Note its timestamp, then query LangSmith runs around that window
   (`/runs?start_time=...&end_time=...`), matching on duration and name
   (chat path → look for the agent run / `vector_search` / `web_tool` tool runs).
3. Report per-leg breakdown: how much was agent LLM call vs `vector_search`
   (Qdrant hybrid) vs `web_tool` (Tavily). Tool runs are direct children of the
   agent chain run, so their individual latencies sum to the total.

## 5. Deliverable

Give the user a compact table: endpoint, sample count, p50, p95, p99 (or a
ranked list of the 15 slowest LangSmith runs), the web URL of the slowest trace,
and the per-leg breakdown for the top offender. Do not print API keys.