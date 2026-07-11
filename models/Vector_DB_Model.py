from fastembed import SparseTextEmbedding
from qdrant_client import models, AsyncQdrantClient
from fastembed import SparseTextEmbedding
from qdrant_client.models import Fusion, FusionQuery
from config.help import get_settings


class Vector_DB_Model:
    def __init__(self, url: str = None):
        self.settings = get_settings()
        self.client = None
        #self.sparse_embedding_model = SparseTextEmbedding(model_name="Qdrant/bm25")

    def connect(self):
        self.client = AsyncQdrantClient(url=self.settings.QDRANT_DB_PATH,timeout=30)
    
    async def disconnect(self):
        if self.client:
            await self.client.close()
        self.client = None

    async def create_collection(self, collection_name: str):
        if not self.client:
            raise RuntimeError("Database client is not connected. Call connect() first.")

        
        collections = (await self.client.get_collections()).collections
        exists = any(c.name == collection_name for c in collections)

        if not exists:
            
            await self.client.create_collection(
                collection_name=collection_name,
                vectors_config={
                    "dense":
                    models.VectorParams(
                    size=self.settings.EMBEDDING_MODEL_SIZE,               
                    distance=self.settings.QDRANT_DB_METHOD
                )},
                sparse_vectors_config={
                "sparse":
                models.SparseVectorParams()
                }
            )

    async def insert(self, collection_name: str,
               texts: list,
               vectors: list,
               metadata: list = None,
               record_ids: list = None,
               batch_size: int = 50):
        
        #sparse_vectors = list(self.sparse_embedding_model.embed(texts))

        for i in range(0, len(texts), batch_size):
            
            batch_end = i + batch_size
            batch_texts = texts[i:batch_end]
            batch_vectors = vectors[i:batch_end]
            #batch_sparse = sparse_vectors[i:batch_end]
            batch_metadata = metadata[i:batch_end]
            batch_record_ids = record_ids[i:batch_end]

            batch_records = [
                models.PointStruct(
                    id=batch_record_ids[x],
                    vector= {
                        "dense": batch_vectors[x],
                        #"sparse": models.SparseVector(
                            #indices=batch_sparse[x].indices.tolist(),
                            #values=batch_sparse[x].values.tolist()
                        #)
                        },
                    payload={
                        "text": batch_texts[x],
                        "metadata": batch_metadata[x]
                    }
                )
                
                for x in range(len(batch_texts))
            ]


            await self.client.upsert(
                collection_name=collection_name,
                points=batch_records
            )

        return True
    
    

    async def semantic_search(self, collection_name: str, query_vector: list, limit: int = 5):
        if not self.client:
            
            raise RuntimeError("Database client is not connected. Call connect() first.")
        
        results = await self.client.search(
            collection_name=collection_name,
            query_vector=models.NamedVector(
                name="dense",
                vector=query_vector
            ),
            limit=limit
        )
        return results
    

    #def hybrid_search(self, collection_name: str, query: str, query_vector: list, limit: int = 5):
        #"""Combines dense semantic and sparse keyword searches using RRF."""
        #if not self.client:
          #  raise RuntimeError("Database client is not connected.")
        
        #query_sparse_raw = list(self.sparse_embedding_model.embed([query]))[0]
       # query_sparse_vector = models.SparseVector(
           # indices=query_sparse_raw.indices.tolist(),
           # values=query_sparse_raw.values.tolist()
        #)

        #results = self.client.query_points(
            #collection_name=collection_name,
            #prefetch=[
              #  models.Prefetch(
                   # query=query_vector,
                  #  using="dense",
                 #   limit=limit * 3
                #),
                #models.Prefetch(
                #    query=query_sparse_vector,
               #     using="sparse",
              #      limit=limit * 3
             #   )
            #],
           # query=models.FusionQuery(fusion=models.Fusion.RRF),
          #  limit=limit
        #)
        #return results.points
