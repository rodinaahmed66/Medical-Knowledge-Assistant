FROM ghcr.io/astral-sh/uv:0.6.14-python3.10-bookworm

WORKDIR .

COPY  requirements.txt.
COPY . .

RUN uv pip install -r requirements.txt.

COPY /docker/alembic.ini  models/alembic.ini
COPY docker/entrypoint.sh /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
