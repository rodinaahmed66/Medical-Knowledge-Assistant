#!/bin/bash
set -e

echo "Running database migrations..."
cd /models
alembic upgrade head
cd .

exec "$@"