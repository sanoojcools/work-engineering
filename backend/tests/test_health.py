from fastapi.testclient import TestClient

from app.db import get_db, get_system_db
from app.main import app, create_app

# Deliberately the bare app, no fixture: never runs the real lifespan (no
# `with` block), so db_ready is whatever this environment's actual
# Postgres reachability happens to be — only test_spec_rejects_missing_key
# below relies on that, for a route that doesn't touch db_ready at all.
_raw_client = TestClient(app, raise_server_exceptions=False)


def test_health_ok(client):
    # Fixture-backed `client` (SQLite, db_ready=True set by conftest.py) —
    # this route's result depends on db_ready, so it needs the real
    # lifespan-equivalent setup the fixture provides, not _raw_client.
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["db_ready"] is True
    assert "version" in body


def test_health_reports_503_when_db_not_ready(monkeypatch, db):
    # Slice 6.1: Render's healthCheckPath (render.yaml) only looks at the
    # HTTP status, so a failed bootstrap has to surface as a non-2xx here
    # or Render's own monitoring can never see it. Setting
    # app.state.db_ready by hand before entering the TestClient wouldn't
    # prove anything: the real lifespan runs on __enter__ and recomputes
    # it from actual DB reachability, overwriting whatever was set before
    # — so this breaks connectivity for real instead.
    import app.main as main_module

    class _BrokenEngine:
        def connect(self):
            raise RuntimeError("simulated DB outage")

    monkeypatch.setattr(main_module, "engine", _BrokenEngine())
    unhealthy_app = create_app()

    def override():
        try:
            yield db
        finally:
            pass

    unhealthy_app.dependency_overrides[get_db] = override
    unhealthy_app.dependency_overrides[get_system_db] = override
    with TestClient(unhealthy_app) as unhealthy_client:
        response = unhealthy_client.get("/api/health")

    assert response.status_code == 503
    body = response.json()
    assert body["status"] == "db_unavailable"
    assert body["db_ready"] is False


def test_spec_rejects_missing_key():
    response = _raw_client.get("/api/spec/checks")
    assert response.status_code in {401, 500}
