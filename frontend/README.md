# Frontend

A dependency-free single-page UI for the Medical Knowledge Assistant. No npm, no bundler, no build step —
`index.html`, `styles.css` and `app.js` are served straight from FastAPI.

## What it does

| Screen | Endpoint | Notes |
|---|---|---|
| **Home** (`#/`) | — | Landing page with the two actions: **Upload Documents** and **Chat** |
| **Upload** (`#/upload`) | `POST /upload/file` | Drag & drop or browse one *or many* files, per-file queue with individual progress and outcome, run summary |
| **Chat** (`#/chat`) | `POST /chat/ask` | Message thread with a typing indicator, renders the answer plus a colour-coded faithfulness badge |

Routing is hash-based (`#/`, `#/upload`, `#/chat`), so no server-side rewrite rules are needed.

## Multi-file uploads

The backend takes one file per `POST /upload/file`, so a multi-file selection is driven entirely from the
frontend as a **sequential queue** — one request in flight at a time:

- Each selected file gets its own row with a progress bar, then a `Queued → Uploading % → Indexing… → Indexed/Failed`
  badge and a result line (`N chunks · 1.4s` or the server's error message).
- **Sequential, not parallel**, because indexing is server-side heavy (LlamaParse → Jina embeddings → Qdrant);
  firing several at once reliably trips provider rate limits.
- Client-side type/size checks run per file. A rejected file is kept in the list marked `Skipped` with the reason,
  so one bad file does not block the rest of the batch.
- Duplicate filenames in a single selection are dropped, because the backend derives `file_id` from the filename
  alone (`uuid5` of the name) — the second copy would just collide with the first and return HTTP 409.
- The summary reports how many indexed, failed, were skipped as invalid, and how many duplicate names were dropped.
- `Clear` resets the queue so a new batch can be staged.

## Running it

The frontend is mounted by the backend at `/`, so there is nothing extra to start:

```bash
docker compose -f docker/docker-compose.yml up --build -d
# then open http://localhost:8000
```

To iterate on the files without rebuilding the container:

```bash
cd frontend
python -m http.server 5173
```

Then open `http://localhost:5173/?api=http://localhost:8000#/upload` and edit the files directly — the dev
server serves them from disk, so a browser refresh is all you need.

## Pointing it at a different backend

The API base URL is resolved in this order:

1. `?api=` query parameter — `http://localhost:5173/?api=https://api.example.com`
2. `localStorage` key `mka.apiBase` (set as a side effect of using `?api=`, so it persists)
3. `window.MEDICAL_API_BASE` global, if you want to hardcode a default in `index.html`
4. Same origin (the default when the backend serves this page)

Cross-origin setups are supported — `main.py` enables permissive CORS for this reason. Tighten
`allow_origins` to your real frontend host before deploying publicly.