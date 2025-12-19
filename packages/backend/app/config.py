from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    JWT_SECRET: str
    DB_HOST: str = "localhost"
    DB_PORT: int = 5431
    DB_NAME: str = "postgres"
    DB_USER: str = "postgres"
    DB_PASSWORD: str = ""
    
    class Config:
        env_file = ".env"

@lru_cache()
def get_settings():
    return Settings()
