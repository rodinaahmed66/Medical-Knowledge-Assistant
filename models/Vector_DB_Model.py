
import uuid
from qdrant_client import models, QdrantClient
from config.help import get_settings 


class Vector_DB_Model:
    def __init__(self, url: str = None):
        self.settings = get_settings()
        self.client = None

    def connect(self):
        self.client = QdrantClient(host=self.settings.QDRANT_DB_PATH)
    
    def disconnect(self):
        self.client = None

    async def create_collection(self, collection_name: str):
        if not self.client:
            raise RuntimeError("Database client is not connected. Call connect() first.")

        
        collections = self.client.get_collections().collections
        exists = any(c.name == collection_name for c in collections)

        if not exists:
            
            self.client.create_collection(
                collection_name=collection_name,
                vectors_config=models.VectorParams(
                    size=self.settings.EMBEDDING_MODEL_SIZE,               
                    distance=self.settings.QDRANT_DB_METHOD
                )
            )

    def insert(self, collection_name: str,
               texts: list,
               vectors: list,
               metadata: list = None,
               record_ids: list = None,
               batch_size: int = 50):
        
        
        for i in range(0, len(texts), batch_size):
            
            batch_end = i + batch_size
            batch_texts = texts[i:batch_end]
            batch_vectors = vectors[i:batch_end]
            batch_metadata = metadata[i:batch_end]
            batch_record_ids = record_ids[i:batch_end]

            batch_records = [
                models.Record(
                    id=batch_record_ids[x],
                    vector=batch_vectors[x],
                    payload={
                        "text": batch_texts[x],
                        "metadata": batch_metadata[x]
                    }
                )
                
                for x in range(len(batch_texts))
            ]


            self.client.upload_records(
                collection_name=collection_name,
                records=batch_records
            )

        return True
    

    def search(self, collection_name: str, query_vector: list, limit: int = 5):
        if not self.client:
            raise RuntimeError("Database client is not connected. Call connect() first.")
        
        results = self.client.search(
            collection_name=collection_name,
            query_vector=query_vector,
            limit=limit
        )
        return results