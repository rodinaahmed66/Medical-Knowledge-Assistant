# Docker Guide

This project runs as a multi-container stack via `docker-compose.yml` (FastAPI,
PostgreSQL, Qdrant, Prometheus, Grafana, and optionally the OpenLIT observability
stack). This file covers the day-to-day commands for running, stopping, rebuilding,
and cleaning it up.

All commands below assume you're in the `docker/` directory (where
`docker-compose.yml` lives):

```bash
cd docker
```

## First-time setup

Copy the example env files and fill in your real API keys/passwords — see the
main [README](README.md) for what each variable is for:

```bash
cp env/.env.app.example env/.env.app
cp env/.env.grafana.example env/.env.grafana
cp env/.env.postgres-exporter.example env/.env.postgres-exporter
```

Then edit each `.env.*` file (not the `.example` ones) with your real values.
These are gitignored and will never be committed.

## Starting the stack

```bash
docker compose up -d
```

`-d` runs it in the background (detached). Drop `-d` if you want to watch logs
stream live in your terminal as it starts.

### Rebuild after changing code or dependencies

If you changed Python code, `requirements.txt`, or the `Dockerfile`, a plain
`up` won't pick up the changes — you need to rebuild the image:

```bash
docker compose up -d --build
```

To rebuild only one service (faster than rebuilding everything):

```bash
docker compose up -d --build fastapi
```

## Checking status and logs

```bash
docker compose ps                 # see which containers are running/healthy
docker compose logs -f fastapi    # follow logs for one service live
docker compose logs -f            # follow logs for all services
docker compose logs --tail=100 fastapi   # last 100 lines only, no follow
```

## Stopping the stack

```bash
docker compose stop        # stops containers, keeps them (and their data) intact
docker compose down        # stops AND removes containers (but keeps named volumes/data)
```

`stop` is the safer everyday command — containers stay ready to restart instantly
with `docker compose start`. `down` removes the containers themselves (they get
recreated fresh next `up`), but your data survives either way, because it lives in
named volumes, not inside the containers.

## Restarting a single service

Useful after fixing a config issue without tearing down everything:

```bash
docker compose restart fastapi
```

## Wiping data (careful — destructive)

Named volumes (`postgres_data`, `qdrant_data`, `prometheus_data`, `grafana_data`,
etc.) persist your data across `down`/`up` cycles. To actually delete stored data
(e.g. to start the vector DB or Postgres completely fresh):

```bash
# Remove containers AND all named volumes defined in this compose file
docker compose down -v
```

To wipe just one volume without touching the others:

```bash
docker compose down                     # stop and remove containers first
docker volume ls                        # find the exact volume name, e.g. docker_qdrant_data
docker volume rm docker_qdrant_data      # remove just that one
docker compose up -d                    # containers recreate a fresh empty volume
```

**This is what you want when**: you changed `CHUNK_SIZE`/`OVERLAP_SIZE` and need
to re-upload documents from scratch, since old chunks in Postgres/Qdrant won't
match the new chunking config.

## Getting a shell inside a running container

Useful for debugging, checking installed packages, or inspecting files:

```bash
docker exec -it fastapi bash
docker exec -it postgres psql -U postgres -d medical_files
```

## Checking disk usage

Docker images, containers, and volumes can quietly eat disk space over time,
especially on a constrained environment like Cloud Shell:

```bash
docker system df              # overview: images/containers/volumes size
docker system prune           # remove unused (stopped) containers, dangling images, unused networks
docker system prune -a        # more aggressive: also removes unused images not tied to any container
docker volume prune           # remove volumes not attached to any container (careful — this is destructive)
```

## Common troubleshooting

**A service won't start / keeps restarting:**
```bash
docker compose logs <service_name>
```
Almost always shows the actual error (missing env var, failed migration,
connection refused to a dependency that isn't healthy yet).

**Code changes don't seem to apply:**
You likely forgot `--build`. Docker caches image layers, so a plain `up`
reuses the old image if the Dockerfile/compose file didn't change.

**"port is already allocated":**
Something else (maybe a previous run, or another project) is using that port.
```bash
docker compose down            # release ports held by this project's containers
```
Or check what's using it directly:
```bash
sudo lsof -i :8000
```

**Fresh environment (e.g. new Cloud Shell session) and nothing works:**
Cloud Shell doesn't keep Docker containers running between sessions. Every new
session, you need to start the stack again:
```bash
cd docker
docker compose up -d
```
Your data in named volumes persists as long as your Cloud Shell `$HOME` isn't
reset, but the containers themselves need to be started fresh each time.
