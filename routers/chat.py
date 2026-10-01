from fastapi import APIRouter,Depends,status,Request
from services.AgentService import AgentService
from fastapi.responses import JSONResponse
from services.AnswerEvaluate import FaithfulnessJudge
from utils.metrics import AGENT_RESPONSE_DURATION
from .Chat_Request import Chat_Request
import asyncio
import time


chat_router=APIRouter(prefix="/chat")

@chat_router.post("/ask")
async def chat (request:Request,
                chat_request:Chat_Request):

    try:
        agent_service=AgentService(
            generation_service=request.app.generation_service,
            embedding_service=request.app.embedding_service,
            vector_db=request.app.vector_db,
            query=chat_request.query
        )

        start_agent_time = time.perf_counter()
        result,retrieval_context = await agent_service.answer()
        agent_duration = time.perf_counter() - start_agent_time
        AGENT_RESPONSE_DURATION.observe(agent_duration)

        # `build_test` is synchronous and makes a Groq call (DeepEval's
        # `measure()` drives its own event loop). Calling it directly here held
        # this worker's event loop for the judge's full duration, stalling every
        # other request on the worker. Offload it to a thread instead.
        faithfulness_judge = FaithfulnessJudge()
        faithfulness_value,reason = await asyncio.to_thread(
            faithfulness_judge.build_test,
            chat_request.query,
            result,
            retrieval_context,
        )

    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"signal": "AGENT_FAILED", "error": str(e)},
        )
        
    return JSONResponse(content={"signal": "CHAT_SUCCESS", "faithfulness_value":faithfulness_value,"answer": result})
