from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Absolute, not ".env": a relative path is resolved against the process's
# CWD at Settings() construction time, and `uvicorn --reload`'s watcher
# subprocess does not reliably inherit the same CWD the parent was started
# from -- with pii_encryption_key now required (no default), that mismatch
# turned into a hard startup crash under --reload specifically, a real bug
# a relative default only used to mask. Anchoring to this file's own
# location makes env-file loading independent of how the process was
# launched.
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, extra="ignore")

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

    # LLM-assisted discovery and Scout story extraction. With provider "none"
    # (the default) every caller uses its deterministic path — that is a
    # supported state, not a broken one.
    llm_provider: str = "none"  # anthropic | openai | none
    llm_api_key: str = ""
    llm_model: str = "claude-opus-5"
    llm_base_url: str = "https://api.openai.com/v1"

    # P0: pgcrypto symmetric key for field-level PII encryption (pii.py).
    # No default, deliberately (Track 2 of the enterprise-readiness roadmap):
    # a hardcoded default here is a real risk regardless of what string it
    # is, once the source that documents it is ever public -- the fix isn't
    # a harder-to-guess default, it's no default. Every environment (local
    # dev included) must set PII_ENCRYPTION_KEY explicitly, e.g.
    # `openssl rand -hex 32` — see .env.example. The app refuses to start
    # without one rather than silently encrypting PII with a known key.
    pii_encryption_key: str

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
