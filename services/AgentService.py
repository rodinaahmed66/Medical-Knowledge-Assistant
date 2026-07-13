from services.prompt.en import AGENT_PROMPT_EN
from services.LLMServices import OpenAIProvider
from langgraph.prebuilt import create_react_agent
from langchain_openai import ChatOpenAI
from .AgentTools import get_agent_tools
from config.help import get_settings
from tavily import TavilyClient


class AgentService():

    def __init__(self,query:str,llm_service,vector_db):
        super().__init__()
        self.query=query
        self.vector_db = vector_db
        self.llm_service = llm_service
        self.app_settings = get_settings()
        
        self.chat_model = ChatOpenAI(
            model=self.app_settings.CHAT_MODEL_ID,
            base_url=self.app_settings.GROQ_URL,
            api_key=self.app_settings.GROQ_KEY,
            temperature=self.app_settings.AGENT_TEMPERATURE,
        )

        self.tools = get_agent_tools(self.llm_service, self.vector_db)

        self.agent=create_react_agent(
            model=self.chat_model,
            tools=self.tools,
            prompt=(
                AGENT_PROMPT_EN
            ),
        )

    async def answer(self) -> str:
        result = await self.agent.ainvoke({"messages": [("user", self.query)]})
        return result["messages"][-1].content



    




    