import logging
from openai import OpenAI


class OpenAIProvider():

    def __init__(self,api_key:str,base_url:str =None,
                 default_input_max_characters :int=1000,
                 default_generation_output_tokens :int=1000,
                 default_generation_temperature:float=0.1):
        
        
        self.api_key=api_key
        self.base_url=base_url 
        self.default_input_max_characters=default_input_max_characters
        self.default_generation_output_tokens=default_generation_output_tokens
        self.default_generation_temperature=default_generation_temperature
        
        self.generation_model_id=None
        self.embedding_model_id=None
        self.embedding_size=None

        self.logger=logging.getLogger(__name__)

        self.client=OpenAI(
            api_key=self.api_key,
            base_url=self.base_url if self.base_url and len(self.base_url) else None
        )

    def set_generation_model(self,model_id:str):
        self.generation_model_id=model_id
    
    def set_embedding_model(self,model_id:str,embedding_size:str):
        self.embedding_model_id=model_id
        self.embedding_size=embedding_size
    
    def generate_text(self,prompt:str,chat_history:list=[],max_output_tokens:int=None,
                      temperature:float  =None):
            if not self.client:
                self.logger.error("OpenAI client was not set")
                return None
            
            if not self.generation_model_id:
                self.logger.error("Generation model for OpenAI client was not set")
                return None
            
            max_output_tokens=max_output_tokens if max_output_tokens else self.default_generation_output_tokens
            temperature=temperature if temperature else self.default_generation_temperature
            chat_history.append(
                 self.construct_prompt(prompt=prompt,
                     role=OpenAIEnums.USER.value
                    )
                    )
            response=self.client.chat.completions.create(
                 model=self.generation_model_id,
                 messages=chat_history,
                 max_tokens=max_output_tokens,
                 temperature=temperature
            )
            if not response or not response.choices or len(response.choices)==0 or not response.choices[0].message:
                 self.logger.error("Error while generating test with OpenAI")
            
            return response.choices[0].message.content
            
    def embed_text(self,texts: str | list[str],document_type:str=None)->list[float] | list[list[float]] | None:

            if not self.client:
                self.logger.error("OpenAI client was not set")
                return None
            
            if not self.embedding_model_id:
                self.logger.error("Embedding model for OpenAI client was not set")
                return None   

            try:    
                is_single = isinstance(texts, str)
                response=self.client.embeddings.create(
                    model=self.embedding_model_id,
                    input=texts
                )

                if not response or not response.data:
                    self.logger.error("Error while embedding texts with OpenAI")
                    return None

                if is_single:
                    return response.data[0].embedding
                else:
                    sorted_data = sorted(response.data, key=lambda x: x.index)
                    return [item.embedding for item in sorted_data]
 
            except Exception as e:
                self.logger.error(f"Failed to generate batch embeddings: {e}")
                return None

    
    def construct_prompt(self,prompt:str,role:str):
         return{
              "role":role,
              "content":prompt
            }
    
    def process_text(self,text:str):
         return text[:self.default_input_max_characters].strip()