#!/bin/bash
set -e

echo "Running database migrations..."
cd /app/models
alembic upgrade head
cd /app


echo "Ensuring Qdrant collection exists..."
python -c "
from models.Vector_DB_Model import Vector_DB_Model
from config.help import get_settings
s = get_settings()
db = Vector_DB_Model(url=s.QDRANT_DB_PATH)
db.connect()
db.create_collection(collection_name=s.QDRANT_COLLECTION_NAME)
"



exec "$@"