from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_health_ok():
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert "version" in body
    assert "db_ready" in body


def test_spec_rejects_missing_key():
    response = client.get("/api/spec/checks")
    assert response.status_code in {401, 500}
