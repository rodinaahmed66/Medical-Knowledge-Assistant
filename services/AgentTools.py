from routers.Chat_Request import Chat_Request
from langchain_core.tools import tool
from tavily import TavilyClient
from config.help import get_settings

def get_agent_tools(llm_service, vector_db):

    @tool
    def vector_search(query: str, limit: int = 3):
        """Search the internal medical knowledge base for relevant document chunks."""
        vector_query = llm_service.embed_text(query)
        results = vector_db.semantic_search(
            collection_name=get_settings().QDRANT_COLLECTION_NAME,
            query_vector=vector_query,
            limit=limit
        )

        if not results:
            return "No relevant internal documents found."
        
        return [{"text": record.payload.get("text"), "score": record.score} for record in results]

    @tool
    def web_tool(query: str, limit: int = 3):
        """Search the web for current medical information not found internally."""
        search_client = TavilyClient(api_key=get_settings().TAVILY_KEY)
        response = search_client.search(query, max_results=Chat_Request.limit)

        if not response:
            return "No relevant web results found."
        
        return [{"content": result["content"], "score": result.get("score", 0)} for result in response["results"]]

    return [vector_search, web_tool]