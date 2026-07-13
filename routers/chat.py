from fastapi import APIRouter,Depends,status,Request
from services.AgentService import AgentService
from fastapi.responses import JSONResponse
from .Chat_Request import Chat_Request

chat_router=APIRouter(prefix="/chat")

@chat_router.post("/ask")
async def chat (request:Request,
                chat_request:Chat_Request):
    
    agent_service=AgentService(
        llm_service=request.app.llm_service,
        vector_db=request.app.vector_db,
        query=chat_request.query
    )

    try:
        result = await agent_service.answer()

    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"signal": "AGENT_FAILED", "error": str(e)},
        )
        
    return JSONResponse(content={"signal": "CHAT_SUCCESS", "answer": result})
