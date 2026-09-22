from fastapi import APIRouter,Depends,status,Request
from services.AgentService import AgentService
from fastapi.responses import JSONResponse
from services.AnswerEvaluate import FaithfulnessJudge
from utils.metrics import AGENT_RESPONSE_DURATION
from .Chat_Request import Chat_Request
import time


chat_router=APIRouter(prefix="/chat")

@chat_router.post("/ask")
async def chat (request:Request,
                chat_request:Chat_Request):
    
    agent_service=AgentService(
        generation_service=request.app.generation_service,
        embedding_service=request.app.embedding_service,
        vector_db=request.app.vector_db,
        query=chat_request.query
    )

    try:
        start_agent_time = time.perf_counter()
        result,retrieval_context = await agent_service.answer()
        agent_duration = time.perf_counter() - start_agent_time
        AGENT_RESPONSE_DURATION.observe(agent_duration)

        faithfulness_judge=FaithfulnessJudge()
        faithfulness_value,reason=faithfulness_judge.build_test(chat_request.query,result,retrieval_context)


    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"signal": "AGENT_FAILED", "error": str(e)},
        )
        
    return JSONResponse(content={"signal": "CHAT_SUCCESS", "faithfulness_value":faithfulness_value,"answer": result})
