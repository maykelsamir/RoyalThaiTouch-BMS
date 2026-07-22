from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Royal Thai Touch ERP"
    environment: str = "development"
    database_url: str = "postgresql://rtt_admin:change_this_password@db:5432/royalthaitouch_v2"
    jwt_secret: str = "replace-with-a-long-random-secret"
    access_token_minutes: int = 30
    refresh_token_days: int = 30

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
