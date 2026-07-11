import asyncio
import json
import os
import random 
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from config.help import get_settings
from services.LLMServices import OpenAIProvider
from models.schemes.FileScheme import FileRecord
from models.schemes.ChunkScheme import ChunkRecord

settings = get_settings()

QUERY_GEN_PROMPT = """You are creating an evaluation question for a retrieval system.
Given the medical text chunk below, write ONE realistic user question that this
chunk directly and fully answers. The question should NOT quote the chunk verbatim
and should sound like something a clinician or patient would naturally ask.

Chunk:
{chunk_text}

Return only the question, nothing else.
"""

async def build_eval_set(sample_size: int = None):
    postgres_conn = (
        f"postgresql+asyncpg://{settings.POSTGRES_USERNAME}:{settings.POSTGRES_PASSWORD}"
        f"@{settings.POSTGRES_HOST}:{settings.POSTGRES_PORT}/{settings.POSTGRES_MAIN_DATABASE}"
    )
    engine = create_async_engine(postgres_conn)
    db_client = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    llm_service = OpenAIProvider(
        api_key=settings.GROQ_KEY,
        base_url=settings.GROQ_URL,
    )
    llm_service.set_generation_model(model_id=settings.GENERATION_MODEL_ID)

    eval_set = []

    async with db_client() as session:
        result = await session.execute(select(ChunkRecord))
        chunks = result.scalars().all()

        if not chunks:
            print("No chunks found in database. Please upload files first.")
            await engine.dispose()
            return

        if sample_size:
            random.seed(42)
            chunks = random.sample(chunks, sample_size)

        print(f"Generating questions for {len(chunks)} chunks...")
        for chunk in chunks:
            question = llm_service.generate_text(
                prompt=QUERY_GEN_PROMPT.format(chunk_text=chunk.chunk_text),
                chat_history=[],
            )
            if not question:
                continue

            eval_set.append({
                "query": question.strip(),
                "relevant_ids": [chunk.chunk_id],
            })


    os.makedirs("eval_output", exist_ok=True)
    output_path = "eval_output/eval_set.json"
    
    with open(output_path, "w") as f:
        json.dump(eval_set, f, indent=2)

    await engine.dispose()
    print(f"Generated {len(eval_set)} evaluation examples -> {output_path}")


if __name__ == "__main__":
    asyncio.run(build_eval_set(sample_size=25))