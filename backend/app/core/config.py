import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql://flientsec:flientsec_dev_pass@localhost:5432/flientsec"
    )
    JWT_SECRET: str = os.getenv("JWT_SECRET", "super_secret_jwt_key_for_dev_123")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    ENV: str = os.getenv("ENV", "dev")

    class Config:
        case_sensitive = True

settings = Settings()
