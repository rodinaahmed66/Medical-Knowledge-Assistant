from pydantic_settings import BaseSettings,SettingsConfigDict
from typing import List


class settings(BaseSettings):

    APP_VERSION:int
    Max_SIZE_FILE:int
    FILE_ALLOWED_TYPES: List[str]
    CHUNK_SIZE:int
    OVERLAP_SIZE:int

    POSTGRES_USERNAME:str
    POSTGRES_PASSWORD:str
    POSTGRES_HOST:str
    POSTGRES_PORT:int
    POSTGRES_MAIN_DATABASE:str 
    
    LLAMA_CLOUD_API_KEY:str

    DEFAULT_LAN:str
    PRIMARY_LAN:str
 

    OPENAI_KEY:str
    OPENAI_URL:str

    
    CHAT_MODEL_ID:str
    GENERATION_MODEL_ID:str
    EMBEDDING_MODEL_ID:str
    EMBEDDING_MODEL_SIZE:int


    INPUT_DEFAULT_MAX_CHARACTERS:int
    GENERATION_DEFAULT_MAX_TOKENS:int
    GENERATION_DEFAULT_TEMPERATURE:float

    QDRANT_DB_METHOD:str
    QDRANT_DB_PATH:str
    QDRANT_COLLECTION_NAME:str

    TAVILY_KEY:str

    model_config = SettingsConfigDict(env_file=".env")


def get_settings():
    return settings()
