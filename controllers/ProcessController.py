from langchain_text_splitters import RecursiveCharacterTextSplitter
from .BaseController import BaseController
from .DataController import DataController
from config.help import get_settings 
from llama_parse import LlamaParse
import os

class ProcessController(BaseController):
    def __init__(self, file_id: str, file_path: str):   
        super().__init__()
        self.file_id = file_id
        self.file_path = file_path

        self.app_settings = get_settings()                    


    async def load_and_parse(self):
        parser=LlamaParse(    
        api_key=self.app_settings.LLAMA_CLOUD_API_KEY,
        result_type='markdown',  
        language=self.app_settings.DEFAULT_LANG,
        verbose=True)
        
        documents= await parser.aload_data(self.file_path)
        docs=[doc.text for doc in documents]
        metadata=[doc.metadata for doc in documents]
        return  docs,metadata


    async def chunk_it(self, chunk_size: int, overlap_size: int):

        file_content,metadata = await self.load_and_parse()
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=overlap_size,
            length_function=len,
        )
        documents=splitter.create_documents(file_content,metadata)

        return documents
