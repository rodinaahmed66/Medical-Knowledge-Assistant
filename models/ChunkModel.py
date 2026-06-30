from sqlalchemy import select
from .BaseModel import BaseModel
from .ChunkModel import ChunkRecord


class ChunkModel(BaseModel):

    @classmethod
    async def create_instance(cls, db_client):
        return cls(db_client)

    async def insert_chunks(self, file_id: str, chunks: list[str]) -> list[ChunkRecord]:
        chunk_records = [
            ChunkRecord(
                chunk_file_id=file_id,
                chunk_text=chunk,
                chunk_order=i+1,
            )
            for i, chunk in enumerate(chunks)
        ]
        self.db_client.add_all(chunk_records)
        await self.db_client.commit()
        return chunk_records

    async def get_chunks_by_file_id(self, file_id: str) -> list[ChunkRecord]:
        result = await self.db_client.execute(
            select(ChunkRecord)
            .where(ChunkRecord.chunk_file_id == file_id)
            .order_by(ChunkRecord.chunk_order)
        )
        return result.scalars().all()