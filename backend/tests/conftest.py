from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import create_engine
from fastapi.testclient import TestClient
import pytest

from app.config import settings
from app.db import Base, get_db, get_system_db
from app.main import create_app
import app.models  # noqa: F401


@pytest.fixture(autouse=True)
def _no_live_llm(monkeypatch):
    """No test may call a model.

    Every LLM-touching path has a deterministic fallback, and that is what the
    suite asserts on. Without this, a developer with LLM_PROVIDER=anthropic in
    their .env silently turns `pytest` into something that makes live, billed
    network calls — it added ~45s and real spend to a local run before this
    fixture existed, and made results depend on the model's mood.
    """
    monkeypatch.setattr(settings, "llm_provider", "none")
    monkeypatch.setattr(settings, "llm_api_key", "")

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


@pytest.fixture
def db():
    Base.metadata.create_all(engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


@pytest.fixture
def client(db):
    app = create_app()
    app.state.db_ready = True

    def override():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override
    # Cross-tenant endpoints (demo seeding, consent purge) resolve their own
    # RLS-bypassing session. Point it at the same in-memory SQLite session so
    # those routes stay inside the fixture instead of reaching the developer's
    # real Postgres — which made assertions depend on whatever state that
    # database happened to be carrying.
    app.dependency_overrides[get_system_db] = override
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()
