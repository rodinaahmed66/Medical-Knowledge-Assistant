
from sqlalchemy import select
from .BaseModel import BaseModel
from .schemes.FileScheme import FileRecord


class FileModel(BaseModel):

    @classmethod
    async def create_instance(cls, db_client):
        return cls(db_client)
    
    async def file_exists(self, file_id: str) -> bool:
        existing = await self.get_file_by_id(file_id)
        return existing is not None
        
    async def create_file(self, file_id: str, filename: str, file_type: str) -> FileRecord:

        file_record = FileRecord(
            id=file_id,
            filename=filename,
            file_type=file_type,
        )
        
        self.db_client.add(file_record)
        await self.db_client.commit()
        await self.db_client.refresh(file_record)
        return file_record

    async def get_file_by_id(self, file_id: str) -> FileRecord | None:
        result = await self.db_client.execute(
            select(FileRecord).where(FileRecord.id == file_id)
        )
        return result.scalar_one_or_none()

    async def get_all_files(self) -> list[FileRecord]:
        result = await self.db_client.execute(select(FileRecord))
        return result.scalars().all()