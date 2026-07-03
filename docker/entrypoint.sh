#!/bin/bash
set -e

echo "Running database migrations..."
cd /app/models
alembic upgrade head
cd /app

exec "$@"