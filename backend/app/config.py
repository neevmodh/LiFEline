from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./lifeline.db"
    jwt_secret: str = "dev-only-insecure-secret-change-me-in-production"
    jwt_expiry_minutes: int = 60 * 24 * 7
    cors_origins: list[str] = ["http://localhost:3000"]
    upload_dir: str = "uploads"
    # External calls (PVGIS, Open-Meteo) can be disabled for offline demos and tests.
    enable_external_apis: bool = True
    # Apply migrations and reference data on startup. Convenient for a single dev process;
    # production prepares the database once before starting workers and sets this to false.
    auto_migrate: bool = True
    external_timeout_seconds: float = 6.0
    # Optional AI bill scanning (Groq is used if both are set). Without either key,
    # the web app reads bills on-device instead.
    groq_api_key: str | None = None
    groq_model: str = "qwen/qwen3.8-27b"
    anthropic_api_key: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
