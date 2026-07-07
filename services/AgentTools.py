from langchain_core.tools import tool
from tavily import TavilyClient
from config.help import get_settings
from routers.Chat_Request import Chat_Request

llm_service=None
vector_db=None

@tool
def web_tool(query:str):

    """Search the web for current medical information not found internally."""
    search_client= TavilyClient(api_key=get_settings.TAVILY_KEY)
    response=search_client.search(query,Chat_Request.limit)

    if not response:
        return "No relevant web results found."
    
    return [{result["content"]:result["score"]}for result in response["results"]]


@tool
def vector_search(query:str):

    """Search the internal medical knowledge base for relevant document chunks."""
    vector_query=llm_service.embed_text(query)

    results=vector_db.search(
        collection_name=get_settings.QDRANT_COLLECTION_NAME,
        query_vector=vector_query,
        limit=Chat_Request.limit
    )

    if not results:
        return "No relevant internal documents found."
    
    return [{record.payload.get("text"):record.payload.get("score")}for record in results]

