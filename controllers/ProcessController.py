from langchain_text_splitters import RecursiveCharacterTextSplitter
from .BaseController import BaseController
from .DataController import DataController
from llama_cloud import LlamaCloud
import os

class ProcessController(BaseController):
    def __init__(self, file_id: str, file_path: str):   
        super().__init__()
        self.file_id = file_id
        self.file_path = os.path.join(self.files_dir, self.file_id)                     


    def load_and_parse(self):
        client = LlamaCloud()
        file = client.files.create(file=self.file_path, purpose="parse")
        result = client.parsing.parse(
            file_id=file.id,                            
            tier="agentic",
            version="latest",
            expand=["markdown_full"],
        )
        return result.markdown_full


    def chunk_it(self, chunk_size: int, overlap_size: int):
        file_content = self.load_and_parse()
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=overlap_size,
            length_function=len,
        )
        documents=splitter.create_documents([file_content])
        return [doc.page_content for doc in documents]
