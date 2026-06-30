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

    model_config = SettingsConfigDict(env_file=".env")



def get_settings():
    return settings()
