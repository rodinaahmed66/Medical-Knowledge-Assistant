from routers.Chat_Request import Chat_Request
from langchain_core.tools import tool
from config.help import get_settings
from tavily import AsyncTavilyClient
from typing import Union
import asyncio

def get_agent_tools(embedding_service, vector_db):

    @tool
    async def vector_search(query: Union[str, list[str]], limit: int = 3):
        """Search the internal medical knowledge base for relevant document chunks."""
        
        vector_query = await asyncio.to_thread(embedding_service.embed_text, query)
        results = await vector_db.hybrid_search(
            collection_name=get_settings().QDRANT_COLLECTION_NAME,
            query_vector=vector_query,
            query=query, 
            limit=limit
        )

        if not results:
            return "No relevant internal documents found."
        
        return [{"text": record.payload.get("text"), "score": record.score} for record in results]

    @tool
    async def web_tool(query: Union[str, list[str]], limit: int = 3):
        """Search the web for current medical information not found internally."""
        search_client = AsyncTavilyClient(api_key=get_settings().TAVILY_KEY)
        response = search_client.search(query, max_results=limit)

        if not response:
            return "No relevant web results found."
        
        return [{"content": result["content"], "score": result.get("score", 0)} for result in response["results"]]

    return [vector_search, web_tool]