from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, func,UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, relationship
from .Basescheme import SQLAlchemyBase

class FileRecord(SQLAlchemyBase):
    __tablename__ = "files"

    id         = Column(String, primary_key=True)            
    filename   = Column(String, nullable=False)
    file_type  = Column(String, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    chunks = relationship("ChunkRecord", back_populates="file", cascade="all, delete-orphan")
