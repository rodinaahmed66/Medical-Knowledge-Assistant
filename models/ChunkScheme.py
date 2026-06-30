
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, func,UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, relationship
from .BaseScheme import SQLAlchemyBase


class ChunkRecord(SQLAlchemyBase):
    __tablename__ = "chunks"

    chunk_id       = Column(Integer, primary_key=True, autoincrement=True)
    chunk_text     = Column(String, nullable=False)
    chunk_metadata = Column(JSONB, nullable=True)
    chunk_order    = Column(Integer, nullable=False)

    chunk_file_id  = Column(String, ForeignKey("files.id"), nullable=False)   

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), nullable=True)

    file = relationship("FileRecord", back_populates="chunks")

    __table_args__ = (
        UniqueConstraint('chunk_file_id', 'chunk_order', name='_file_chunk_order_uc'),
    )