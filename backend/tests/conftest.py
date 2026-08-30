from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from sqlalchemy import create_engine
from fastapi.testclient import TestClient
import pytest

from app.db import Base, get_db, get_system_db
from app.main import create_app
import app.models  # noqa: F401

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
