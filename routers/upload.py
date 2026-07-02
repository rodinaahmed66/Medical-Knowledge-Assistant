from fastapi import APIRouter,Depends,UploadFile,status,Request
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.responses import JSONResponse
from models import ProcessSignal
from controllers import DataController
from controllers import ProcessController
from config.help import get_settings,settings
from models.FileModel import FileModel
from models.ChunkModel import ChunkModel


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
    is_valid, result = data_controller.data_validate(file)

    if not is_valid:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"signal": result}
        )

    file_path= data_controller.save(file)  
    file_id=data_controller.file_id
    process_controller=await ProcessController(file_id=file_id,file_path=file_path)
    
    await file_model.create_file(
        file_id=file_id,
        filename=file.filename,
        file_type=file.content_type
    )
    chunks=process_controller.chunk_it(
        chunk_size=app_settings.CHUNK_SIZE,
        overlap_size=app_settings.OVERLAP_SIZE
    )
    
    await chunk_model.insert_chunks(
        file_id=file_id,
        chunks=chunks,

    )


    return JSONResponse(content={
        "signal": result,
        "file_id": data_controller.file_id,
    })

    

    
