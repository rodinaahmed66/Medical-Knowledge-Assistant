
from .BaseController import BaseController
from models import ProcessSignal
from fastapi import UploadFile
import shutil
import os
import uuid


class DataController(BaseController):
    def __init__(self):
        super().__init__()
        self.size_scale=1048576
        self.file_id=str(uuid.uuid4())
        
    
    def data_validate(self,file:UploadFile):
        
        if file.content_type not in self.app_setting.FILE_ALLOWED_TYPES:
            return False ,ProcessSignal.FILE_TYPE_NOT_SUPPORTED.value


        if file.size>self.app_setting.Max_SIZE_FILE*self.size_scale:
            return False,ProcessSignal.FILE_SIZE_EXCEEDED.value
         
        
        return True,ProcessSignal.FILE_VALIDATED_SUCCESS.value
       
    
    def generate_file_path(self):
        
        if not os.path.exists(self.files_dir):
            os.makedirs(self.files_dir)

        file_folder=os.path.join(self.files_dir,self.file_id)
        os.makedirs(file_folder,exist_ok=True)

        return file_folder
    
    def save(self, file: UploadFile):          
        file_folder = self.generate_file_path()
        file_path = os.path.join(file_folder, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return file_path

