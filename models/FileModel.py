
from sqlalchemy import select
from .BaseModel import BaseModel
from .schemes.FileScheme import FileRecord
from datetime import datetime, timedelta, timezone



class FileModel(BaseModel):

    @classmethod
    async def create_instance(cls, db_client):
        return cls(db_client)
    
    async def file_exists(self, file_id: str) -> bool:
        existing = await self.get_file_by_id(file_id)
        return existing is not None and existing.status == "indexed"
        
    async def create_file(self, file_id: str, filename: str, file_type: str,status: str = "pending") -> FileRecord:

        file_record = FileRecord(
            id=file_id,
            filename=filename,
            file_type=file_type,
            status=status,
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
    

    async def update_status(self, file_id: str, status: str) -> None:
        file_record = await self.get_file_by_id(file_id)
        if file_record is not None:
            file_record.status = status
            await self.db_client.commit()
    

    async def get_pending_files(self, older_than_minutes: int = 60) -> list[FileRecord]:

        cutoff = datetime.now(timezone.utc) - timedelta(minutes=older_than_minutes)
        result = await self.db_client.execute(
            select(FileRecord).where(
                FileRecord.status == "pending",
                FileRecord.created_at < cutoff,
            )
        )
        return result.scalars().all()