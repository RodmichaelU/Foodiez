from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Backend settings, read from the environment and backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: str = ""
    gemini_model: str = ""
    spoonacular_api_key: str = ""
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # Wide open for local development only.
    cors_origins: list[str] = ["*"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
