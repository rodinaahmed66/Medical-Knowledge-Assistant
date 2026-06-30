import logging
from typing import List
from qdrant_client import models,QdrantClient

class QdrantModel():
    def __init__(self,url:str,distance_method:str):
        self.client=None
        self.url=url
        self.distance_method=None

    
    def connect(self):
        self.client=QdrantClient(url=self.url)
    
    def disconnect(self):
        self.client=None
    
    