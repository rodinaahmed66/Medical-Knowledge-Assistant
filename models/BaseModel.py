from config.help import get_settings

class BaseModel:
    def __init__(self,db_client:object):
        self.db_client= db_client
        self.app_settings= get_settings()  