from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Work Engineering"
    app_version: str = "0.8.0"
    database_url: str = "postgresql+psycopg2://wep:wep@localhost:5432/wep"
    allowed_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    # LLM-assisted discovery
    llm_provider: str = "none"  # anthropic | openai | none
    llm_api_key: str = ""
    llm_model: str = "claude-sonnet-4-5"
    llm_base_url: str = "https://api.openai.com/v1"

    # Shared secret for the Spec API / Enforcement Gateway (execution systems)
    spec_api_key: str = "dev-spec-key-change-me"

    # G4 ladder
    promotion_min_runs: int = 5
    promotion_min_pass_rate: float = 0.95
    demotion_fail_rate: float = 0.10
    monthly_fte_hours: float = 160.0


settings = Settings()
