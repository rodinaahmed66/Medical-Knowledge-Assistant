from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from services.LLMServices import OpenAIProvider
from models.Vector_DB_Model import Vector_DB_Model
from sqlalchemy.orm import sessionmaker
from config.help import get_settings
from fastapi import FastAPI
from routers import upload
from routers import chat

app=FastAPI()

async def startup_span():
    
    settings=get_settings()
    postgres_conn=f"postgresql+asyncpg://{settings.POSTGRES_USERNAME}:{settings.POSTGRES_PASSWORD}@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_MAIN_DATABASE}"

    app.db_engine = create_async_engine(postgres_conn)
    app.db_client = sessionmaker(
        app.db_engine, class_=AsyncSession, expire_on_commit=False
    )
    app.llm_service=OpenAIProvider(
                api_key=settings.OPENAI_KEY,
                base_url=settings.OPENAI_URL,
                default_input_max_characters=settings.INPUT_DEFAULT_MAX_CHARACTERS,
                default_generation_output_tokens=settings.GENERATION_DEFAULT_MAX_TOKENS ,
                default_generation_temperature=settings.GENERATION_DEFAULT_TEMPERATURE
                )
    
    app.llm_service.set_generation_model(
        model_id=settings.GENERATION_MODEL_ID
    )

    app.llm_service.set_embedding_model(
        model_id=settings.EMBEDDING_MODEL_ID,
        embedding_size=settings.EMBEDDING_MODEL_SIZE
    )
    
    app.vector_db=Vector_DB_Model(
        url=settings.QDRANT_DB_PATH
    )
    
    app.vector_db.connect()
    app.vector_db.create_collection(collection_name=settings.QDRANT_COLLECTION_NAME)
    print("Application startup.")


async def shutdown_span():
    app.vector_db.disconnect()
    await app.db_engine.dispose()


app.on_event("startup")(startup_span)
app.on_event("shutdown")(shutdown_span)

app.include_router(upload.upload_router)
app.include_router(chat.chat_router)