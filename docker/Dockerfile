FROM ghcr.io/astral-sh/uv:0.6.14-python3.10-bookworm

WORKDIR /app

COPY requirements.txt .

RUN uv pip install -r requirements.txt --system


COPY . .

RUN mkdir -p /app/models

COPY /models/alembic.ini  app/models/alembic.ini

COPY docker/entrypoint.sh  /entrypoint.sh

RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
