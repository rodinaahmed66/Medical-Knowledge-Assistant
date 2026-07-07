from pydantic import BaseModel
from typing import Optional


class Chat_Request(BaseModel):
    query:str
    limit:Optional[int]=3 