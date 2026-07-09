from fastapi import APIRouter,Depends,UploadFile,status,Request
from models.Vector_DB_Model import Vector_DB_Model
from sqlalchemy.ext.asyncio import AsyncSession
from services.LLMServices import OpenAIProvider
from fastapi.responses import JSONResponse
from controllers import DataController
from controllers import ProcessController
from config.help import get_settings,settings
from models.FileModel import FileModel
from models.ChunkModel import ChunkModel
from models import ProcessSignal
import asyncio

upload_router=APIRouter(prefix="/upload")


async def get_db_session(request: Request):
    async with request.app.db_client() as session:
        yield session


@upload_router.post("/file")
async def upload(request:Request,
                file:UploadFile,
                app_settings:settings=Depends(get_settings),
                 db_session: AsyncSession = Depends(get_db_session)):


    file_model=await FileModel.create_instance(
          db_client= db_session
    )

    chunk_model=await ChunkModel.create_instance(
          db_client= db_session
    )

    data_controller = DataController()
    file_id=data_controller.generate_file_id(file.filename)
    is_valid, result = data_controller.data_validate(file)

    if not is_valid:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"signal": result}
        )

    file_path= data_controller.save(file)  
    process_controller=ProcessController(file_id=file_id,file_path=file_path)
    
    if await file_model.file_exists(file_id):
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"signal": "file already exist"}
        )

    try:
        chunks=await process_controller.chunk_it(
            chunk_size=app_settings.CHUNK_SIZE,
            overlap_size=app_settings.OVERLAP_SIZE
        )

        if not chunks:
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content={"signal": ProcessSignal.NO_CHUNKS_PRODUCED.value, "file_id": file_id}
            )
    
    except Exception as e:
        
        return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"signal": ProcessSignal.PARSE_FAILED.value, "error": str(e)}
    )
    
    await file_model.create_file(
        file_id=file_id,
        filename=file.filename,
        file_type=file.content_type
    )



    chunk_records=await chunk_model.insert_chunks(
            file_id=file_id,
            chunks=chunks,
        )

    texts=[chunk.page_content for chunk in chunks]
    metadata=[chunk.metadata if chunk.metadata else {} for chunk in chunks]
    ids=[record.chunk_id for record in chunk_records]
    vectors = await asyncio.to_thread(
            request.app.llm_service.embed_text, 
            texts
        )

    if not vectors:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"signal": "VECTORS_INDEX_FAILED", "error": "Embedding model failed to process batch."}
        )
        
    try:
    
        await request.app.vector_db.insert(
                collection_name=app_settings.QDRANT_COLLECTION_NAME,
                texts=texts,
                vectors=vectors,
                metadata=metadata,
                record_ids=ids
        )
        

    except Exception as qdrant_error:
        print(f"Error during Qdrant ingestion: {str(qdrant_error)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"signal": "VECTORS_INDEX_FAILED", "error": str(qdrant_error)}
        )

    return JSONResponse(content={
        "signal": ProcessSignal.PROCESS_SUCCESS.value,
        "file_id": file_id,
        "chunks_parsed": len(chunks),
    })

    

    
