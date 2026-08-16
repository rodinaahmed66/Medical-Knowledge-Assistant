import os
import pytest

# Dummy values for every required field on `settings` (config/help.py).
# Set as env vars (not a monkeypatched get_settings) because several modules
# do `self.app_setting = get_settings()` inside __init__, so the real
# pydantic-settings object has to be constructible wherever it's called.
_REQUIRED_ENV = {
    "APP_VERSION": "1",
    "Max_SIZE_FILE": "10",
    "FILE_ALLOWED_TYPES": '["application/pdf", "text/plain"]',
    "CHUNK_SIZE": "500",
    "OVERLAP_SIZE": "50",
    "POSTGRES_USERNAME": "test",
    "POSTGRES_PASSWORD": "test",
    "POSTGRES_HOST": "localhost",
    "POSTGRES_PORT": "5432",
    "POSTGRES_MAIN_DATABASE": "test_db",
    "LLAMA_CLOUD_API_KEY": "test-key",
    "DEFAULT_LAN": "en",
    "PRIMARY_LAN": "en",
    "GROQ_KEY": "test-key",
    "GROQ_URL": "https://example.com",
    "JINA_KEY": "test-key",
    "JINA_URL": "https://example.com",
    "CHAT_MODEL_ID": "test-model",
    "GENERATION_MODEL_ID": "test-model",
    "EMBEDDING_MODEL_ID": "test-model",
    "EMBEDDING_MODEL_SIZE": "768",
    "INPUT_DEFAULT_MAX_CHARACTERS": "1000",
    "GENERATION_DEFAULT_MAX_TOKENS": "1000",
    "GENERATION_DEFAULT_TEMPERATURE": "0.1",
    "AGENT_TEMPERATURE": "0.1",
    "QDRANT_DB_METHOD": "Cosine",
    "QDRANT_DB_PATH": "http://localhost:6333",
    "QDRANT_COLLECTION_NAME": "test_collection",
    "TAVILY_KEY": "test-key",
    "LANGSMITH_TRACING_V2": "false",
    "LANGSMITH_ENDPOINT": "https://example.com",
    "LANGSMITH_API_KEY": "test-key",
    "LANGSMITH_PROJECT": "test-project",
}


@pytest.fixture(autouse=True)
def dummy_settings_env(monkeypatch):
    for key, value in _REQUIRED_ENV.items():
        monkeypatch.setenv(key, value)
    yield
