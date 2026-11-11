from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./nidhi.db"
    # Supabase: the app connects through the pooler; migrations need the direct connection.
    migration_database_url: str | None = None
    jwt_secret: str = "dev-only-insecure-secret-change-me-in-production"
    jwt_expiry_minutes: int = 60 * 24 * 7
    cors_origins: list[str] = ["http://localhost:3000"]
    # The deployed sites: the landing page and GEDA console (two addresses while the rename settles)
    # and the household app's web build.
    cors_origin_regex: str = r"^https://(nidhi-gujarat|lifeline-cyan-rho|nidhi-app-rosy)\.vercel\.app$"
    # Proof photos: "local" keeps them in upload_dir; "supabase" uses a private Storage bucket.
    storage_backend: Literal["local", "supabase"] = "local"
    upload_dir: str = "uploads"
    supabase_url: str | None = None
    supabase_service_key: str | None = None
    supabase_bucket: str = "proofs"
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
    # Web Push alerts. Keys come from scripts/setup_push.py; the cron secret guards the sender endpoint.
    vapid_public_key: str | None = None
    vapid_private_key: str | None = None
    vapid_subject: str = "mailto:nidhi@example.com"
    push_cron_secret: str | None = None
    # Adaption (translation pipeline in tools/, not used by the running API).
    adaption_api_key: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
