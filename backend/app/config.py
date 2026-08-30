from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Work Engineering"
    app_version: str = "0.8.0"
    # Per-request runtime connection: non-superuser, RLS-bound (see alembic
    # f198c4aadd2c). This is what get_db()/routers use — every query on it
    # is tenant-scoped by app.current_client_id.
    database_url: str = "postgresql+psycopg2://wep_app:wep_app_dev_pw@localhost:5433/wep"
    # Startup/maintenance connection only (e.g. bootstrap_tenants cloning
    # catalog Work Units across clients) — deliberately bypasses RLS via the
    # migration superuser. Never used for per-request/tenant-facing queries.
    system_database_url: str = "postgresql+psycopg2://wep:wep@localhost:5433/wep"
    allowed_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # LLM-assisted discovery
    llm_provider: str = "none"  # anthropic | openai | none
    llm_api_key: str = ""
    llm_model: str = "claude-sonnet-4-5"
    llm_base_url: str = "https://api.openai.com/v1"

    # P0: pgcrypto symmetric key for field-level PII encryption (pii.py).
    # Dev default only — override in any non-local environment.
    pii_encryption_key: str = "dev-pii-key-change-me"

    # Gates POST /api/demo/bootstrap, which mints and returns an org API key
    # in plaintext over an UNAUTHENTICATED request so a local demo needs no
    # hand-written SQL. That is only acceptable on a throwaway local database:
    # set DEMO_BOOTSTRAP_ENABLED=false (and it is refused) anywhere else.
    demo_bootstrap_enabled: bool = True

    # G4 ladder
    promotion_min_runs: int = 5
    promotion_min_pass_rate: float = 0.95
    demotion_fail_rate: float = 0.10
    monthly_fte_hours: float = 160.0


settings = Settings()
