from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = 'Royal Thai Touch Business Management System'
    jwt_secret: str = 'CHANGE_ME_IN_PRODUCTION'
    jwt_algorithm: str = 'HS256'
    access_token_expire_minutes: int = 480
    database_url: str = 'postgresql://postgres:postgres@localhost:5432/royalthaitouch'

    class Config:
        env_file = '.env'

settings = Settings()
