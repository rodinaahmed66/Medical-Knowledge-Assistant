from .AgentTools import get_agent_tools
from services.LLMServices import OpenAIProvider
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from config.help import get_settings
from tavily import TavilyClient
import AgentTools


class AgentService():

    def __init__(self,query,llm_service,vector_db):
        super().__init__()
        self.llm_service = llm_service
        self.vector_db = vector_db
        self.app_settings = get_settings()
        self.chat_model = ChatOpenAI(
            model=self.app_settings.CHAT_MODEL_ID,   
            base_url=self.app_settings.OPENAI_URL,
            api_key=self.app_settings.OPENAI_KEY,
            temperature=self.app_settings.GENERATION_DEFAULT_TEMPERATURE,
        )

        self.tools = get_agent_tools(self.llm_service, self.vector_db)

        self.agent=create_react_agent(
            model=self.chat_model,
            tools=self.tools,
            prompt=(
                "You are an agentic medical assistant. You must analyze the user's question and:\n"
                "1. Choose which tool to use. Always use `vector_search` first to check if the question can be resolved internally.\n"
                "2. If `vector_search` returns insufficient or missing data, call `web_tool` to get supporting external context.\n"
                "3. Synthesize your final response using only the facts gathered from the tool outputs. "
                "Explicitly declare if you used local records, web research, or both to compile your answer."
            
            ),
        )

    async def answer(self, query: str) -> str:
        result = await self.agent.ainvoke({"messages": [("user", query)]})
        return result["messages"][-1].content



    




    