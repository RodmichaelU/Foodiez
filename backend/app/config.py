import secrets
from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Backend settings, read from the environment and backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    gemini_api_key: str = ""
    gemini_model: str = ""
    spoonacular_api_key: str = ""
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    # Set this in .env: the random fallback invalidates open results on every restart.
    recipe_signing_secret: str = Field(default_factory=lambda: secrets.token_hex(32))

    # Wide open for local development only.
    cors_origins: list[str] = ["*"]

    @field_validator("recipe_signing_secret")
    @classmethod
    def _never_sign_with_an_empty_secret(cls, value: str) -> str:
        return value or secrets.token_hex(32)


@lru_cache
def get_settings() -> Settings:
    return Settings()
