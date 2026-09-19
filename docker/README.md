# Docker Guide

This project runs as a **multi-container stack** using Docker Compose. Each part
of the project runs in its own isolated "container" (think of it as a small,
self-contained computer):

- **fastapi** — the main application (the AI Medical Knowledge Assistant API)
- **postgres** — stores your uploaded documents and metadata
- **qdrant** — the vector database (stores text chunks for AI search)
- **prometheus** — collects monitoring metrics
- **grafana** — dashboards to visualize those metrics
- **node-exporter** — system metrics collector (used by Prometheus)
- **postgres-exporter** — Postgres metrics collector (used by Prometheus)

> **Don't know Docker?** You don't need to. The only commands you actually need
> are the ones in this file. Copy, paste, and press Enter — that's it.

---

## 1. What you need before starting

- **Docker** installed and running. Check with:
  ```bash
  docker --version
  ```
- The repo cloned on your machine.

All commands below assume you are in the `docker/` folder:

```bash
cd docker
```

---

## 2. First-time setup (only do this once)

1. Copy the example environment files and fill in your real API keys/passwords:

   ```bash
   cp env/.env.app.example env/.env.app
   cp env/.env.grafana.example env/.env.grafana
   cp env/.env.postgres.example env/.env.postgres
   cp env/.env.postgres-exporter.example env/.env.postgres-exporter
   ```

2. Open each `.env.*` file **without** the `.example` suffix and fill in the real
   values. At minimum, add your API keys in `env/.env.app`:
   - `LLAMA_CLOUD_API_KEY` — for parsing uploaded PDFs/text files
   - `GROQ_KEY` — for the AI chat/generation model
   - `JINA_KEY` — for AI embeddings
   - `TAVILY_KEY` — for web search (if the assistant supports search)

   > The `.env.*` files (without `.example`) are gitignored — your keys will
   > **never** be committed. Only the `.example` files are committed to the repo.

---

## 3. Start everything

```bash
docker compose up -d
```

- `-d` runs everything in the background.
- **First run takes a few minutes** — it downloads images and builds the app.
- When you see a "Started" message or your prompt returns, everything is running.

### Open the app and dashboards

| What                 | Address                                  |
| -------------------- | ---------------------------------------- |
| **Main app (API)**   | http://localhost:8000                    |
| **API docs (try it)**| http://localhost:8000/docs               |
| **Grafana**          | http://localhost:3000                    |
| **Prometheus**       | http://localhost:9090                    |

### API endpoints

Once the app is running, these are the endpoints available on the main API
(base URL: `http://localhost:8000`):

| Method | Endpoint       | What it does                                            |
| ------ | -------------- | ------------------------------------------------------- |
| `POST` | `/upload/file` | Upload a document (PDF/text) — send it as **multipart form-data** (field: `file`)|
| `POST` | `/chat/ask`    | Ask the assistant a question. Body: `{ "query": "..." }`|

Example (once a file is uploaded):

```bash
curl -X POST http://localhost:8000/chat/ask \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the treatment for this condition?"}'
```

You can try both interactively in the interactive docs:
http://localhost:8000/docs

### Rebuild after code changes

If you changed Python code, `requirements.txt`, or the `Dockerfile`, a plain
`up` won't pick up the changes — rebuild the image:

```bash
docker compose up -d --build
```

To rebuild only one service (faster):

```bash
docker compose up -d --build fastapi
```

---

## 4. How the services talk to each other (the Docker network)

When you run `docker compose up`, Docker creates a private internal network
called `backend`, and **every container joins it**. Think of it as a private
Wi-Fi network inside your machine where only these containers can see each
other. Inside that network each service is reachable by its **service name**,
not by an IP address. That is why the app's configuration uses names like
`postgres` and `qdrant` as hosts instead of `localhost` — `localhost` would not
work here, because from inside the `fastapi` container, its own `localhost` is
itself, not the database or the vector store.

### How the services depend on each other

The stack starts in a specific order. Containers that depend on another service
do **not** start until that service has passed its health check:

- **postgres** and **qdrant** start first on their own.
- **fastapi** (the main app) only starts after **postgres** and **qdrant** are
  healthy. The app talks to Postgres to store your uploaded documents and their
  metadata, and to Qdrant to store the text chunks it creates for AI search.
- **postgres-exporter** only starts after **postgres** is healthy, because it
  needs the database up to read its metrics.
- **grafana** only starts after **prometheus** is up, so it can read the
  metrics Prometheus collects.

So even though you run one `docker compose up` command, the services start up
in this order: database and vector store first, then the app and the exporters,
then the monitoring layer.

### What Prometheus collects and from where

Prometheus is the "metrics collector". It continuously pulls data (every 15
seconds) from several sources over the internal `backend` network:

- **fastapi** — the app exposes its own metrics at the `/informations` endpoint.
  These are the most important ones: how many files were uploaded, processed,
  failed, and how your medical assistant is behaving.
- **node-exporter** — collects **system** metrics: CPU, memory, disk, and
  network usage of the host machine.
- **postgres-exporter** — collects **database** metrics: active connections,
  queries run, and the status of the Postgres server.
- **qdrant** — collects **vector database** metrics: how many chunks are
  stored, and how search operations are performing.
- **prometheus** itself — collects its own metrics (is it running, is it
  scraping everything correctly, how many targets are up).

Grafana then reads all of this from Prometheus and draws it as dashboards you
can open in your browser at http://localhost:3000.

### Who can be reached from outside

Only the services that have a `ports:` entry can be reached from your own
machine (for example, the app on port `8000`, Grafana on `3000`,
Prometheus on `9090`). Everything else is private inside the `backend`
network. But even for the exposed ones, the services **always** talk to each
other over the private network using their service names, and not through the
public ports.

---

## 5. See how things are doing (status & logs)

```bash
docker compose ps                          # which containers are running/healthy
docker compose logs -f                     # watch logs from all services live
docker compose logs -f fastapi             # watch logs from one service only
docker compose logs --tail=100 fastapi     # last 100 lines, then stop
```

Leave a log window running with `-f` if you want to see what the app is doing.
Press `Ctrl+C` to stop following logs (this does **not** stop the containers).

---

## 6. Stop / remove everything

| Command                     | What it does                                       | Data safe? |
| --------------------------- | -------------------------------------------------- | ---------- |
| `docker compose stop`       | Pauses containers, keeps them ready to restart     | ✅ Yes     |
| `docker compose restart`    | Stops then starts again (use after config changes) | ✅ Yes     |
| `docker compose down`       | Removes containers (start fresh with `up`)         | ✅ Yes     |
| `docker compose down -v`    | Removes containers **AND deletes all stored data** | ❌ No      |

- **To stop** (containers keep their data):
  ```bash
  docker compose stop
  ```
- **To start again** after a `stop`:
  ```bash
  docker compose start
  ```
- **To fully start over** (fresh containers, same data):
  ```bash
  docker compose down
  docker compose up -d
  ```
- **To stop one service only**:
  ```bash
  docker compose stop fastapi
  docker compose restart fastapi
  ```

---

## 7. Wipe ALL data (careful — destructive)

Your uploaded files, chunks, and dashboards live in "named volumes". They survive
`stop` and `down`. If you want to start the whole project from scratch:

```bash
docker compose down -v
docker compose up -d
```

To delete just one volume (e.g. only the vector database):

```bash
docker compose down
docker volume ls                  # find the exact name, e.g. docker_qdrant_data
docker volume rm docker_qdrant_data
docker compose up -d
```

> **Wipe when:** you changed `CHUNK_SIZE` / `OVERLAP_SIZE` in `env/.env.app`.
> Old chunks won't match the new settings, so re-upload your documents after
> wiping.

---

## 8. Get inside a container (for debugging)

```bash
docker exec -it fastapi bash                 # shell inside the app container
docker exec -it postgres psql -U postgres -d medical_files   # database shell
```

Type `exit` to leave.

---

## 9. Check disk usage & clean up

Docker quietly fills your disk over time:

```bash
docker system df          # overview of used space
docker system prune       # remove stopped containers & dangling images (safe)
docker system prune -a    # also remove unused images (keep only what's running)
docker volume prune       # remove unused volumes (careful — deletes data)
```

---

## 10. Troubleshooting

**A service won't start / keeps restarting**
```bash
docker compose logs <service_name>
```
The real error (missing env var, failed database connection, etc.) will be here.

**Code changes don't seem to apply**
You forgot `--build`. Docker reuses the old image on a plain `up`.

**"port is already allocated"**
Something else is using that port:
```bash
docker compose down
```
Or check what's holding it:
```bash
sudo lsof -i :8000
```

**Fresh environment (e.g. new Cloud Shell session) and nothing works**
Cloud Shell doesn't keep containers running between sessions. Start the stack
again each session — your data in named volumes is still there as long as your
`$HOME` wasn't reset:
```bash
cd docker
docker compose up -d
```

---

## Quick reference (copy-paste cheat sheet)

```bash
cd docker                                  # go to docker folder
docker compose up -d --build               # start everything (use --build after code changes)
docker compose ps                          # check status
docker compose logs -f                     # watch logs
docker compose stop                        # pause everything (keeps data)
docker compose start                       # resume after stop
docker compose restart fastapi             # restart one service
docker compose down                        # remove containers (keeps data)
docker compose down -v                     # remove containers AND data (destructive)
```