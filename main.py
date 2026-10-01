from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from services.LLMServices import OpenAIProvider
from models.Vector_DB_Model import Vector_DB_Model
from sqlalchemy.orm import sessionmaker
from config.help import get_settings
from utils.metrics import setup_metrics
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import upload
from routers import chat
import os
import pathlib


app=FastAPI()
setup_metrics(app)

# Only needed when the frontend runs from its own dev server (e.g.
# http://localhost:5173) against the API on http://localhost:8000. When this
# app serves the frontend too, everything is same-origin and CORS never applies.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def startup_span():


    app_settings=get_settings()


    os.environ["LANGCHAIN_TRACING_V2"] = app_settings.LANGSMITH_TRACING_V2
    os.environ["LANGCHAIN_ENDPOINT"] = app_settings.LANGSMITH_ENDPOINT
    os.environ["LANGCHAIN_API_KEY"] = app_settings.LANGSMITH_API_KEY
    os.environ["LANGCHAIN_PROJECT"] = app_settings.LANGSMITH_PROJECT


    postgres_conn=f"postgresql+asyncpg://{app_settings.POSTGRES_USERNAME}:{app_settings.POSTGRES_PASSWORD}@{app_settings.POSTGRES_HOST}:{app_settings.POSTGRES_PORT}/{app_settings.POSTGRES_MAIN_DATABASE}"

    app.db_engine = create_async_engine(postgres_conn)
    app.db_client = sessionmaker(
        app.db_engine, class_=AsyncSession, expire_on_commit=False
    )
    app.generation_service=OpenAIProvider(
                api_key=app_settings.GROQ_KEY,
                base_url=app_settings.GROQ_URL,
                default_input_max_characters=app_settings.INPUT_DEFAULT_MAX_CHARACTERS,
                default_generation_output_tokens=app_settings.GENERATION_DEFAULT_MAX_TOKENS ,
                default_generation_temperature=app_settings.GENERATION_DEFAULT_TEMPERATURE
                )
    
    app.generation_service.set_generation_model(
        model_id=app_settings.GENERATION_MODEL_ID
    )

    app.embedding_service=OpenAIProvider(
                api_key=app_settings.JINA_KEY,
                base_url=app_settings.JINA_URL,
                default_input_max_characters=app_settings.INPUT_DEFAULT_MAX_CHARACTERS,
                default_generation_output_tokens=app_settings.GENERATION_DEFAULT_MAX_TOKENS ,
                default_generation_temperature=app_settings.GENERATION_DEFAULT_TEMPERATURE
                )

    app.embedding_service.set_embedding_model(
        model_id=app_settings.EMBEDDING_MODEL_ID,
        embedding_size=app_settings.EMBEDDING_MODEL_SIZE
    )
    
    app.vector_db=Vector_DB_Model(
        url=app_settings.QDRANT_DB_PATH
    )
    
    app.vector_db.connect()
    print("Application startup.")


async def shutdown_span():
    await app.vector_db.disconnect()
    await app.db_engine.dispose()


app.on_event("startup")(startup_span)
app.on_event("shutdown")(shutdown_span)

app.include_router(upload.upload_router)
app.include_router(chat.chat_router)

# Mounted last on purpose: the StaticFiles handler only sees paths the routers
# above did not already claim, so /upload, /chat and /informations keep working
# while /, /styles.css and /app.js are served from disk.
FRONTEND_DIR = pathlib.Path(__file__).parent / "frontend"

if FRONTEND_DIR.is_dir():
    app.mount(
        "/",
        StaticFiles(directory=str(FRONTEND_DIR), html=True),
        name="frontend",
    )
