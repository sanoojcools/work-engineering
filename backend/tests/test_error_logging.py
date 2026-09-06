import logging

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import _install_error_handling

SECRET_MARKER = "sk-should-never-reach-logs"


def _boom_app() -> FastAPI:
    """A throwaway app wired with the same helper the real app uses, rather
    than a fake route bolted onto the production router tree."""
    app = FastAPI()
    _install_error_handling(app)

    @app.get("/boom")
    def boom():
        raise ValueError(SECRET_MARKER)

    return app


def test_unhandled_exception_returns_generic_500_with_request_id():
    client = TestClient(_boom_app(), raise_server_exceptions=False)
    response = client.get("/boom")

    assert response.status_code == 500
    body = response.json()
    assert body["detail"] == "Internal Server Error"
    assert body["request_id"]
    assert response.headers["x-request-id"] == body["request_id"]
    # The client-facing error must not echo the exception's own message.
    assert SECRET_MARKER not in response.text


def test_unhandled_exception_logs_request_id_and_path_but_not_message(caplog):
    client = TestClient(_boom_app(), raise_server_exceptions=False)
    with caplog.at_level(logging.ERROR, logger="app.errors"):
        response = client.get("/boom")

    records = [r for r in caplog.records if r.name == "app.errors"]
    assert len(records) == 1
    message = records[0].getMessage()
    assert "path=/boom" in message
    assert "method=GET" in message
    assert "exc_type=ValueError" in message
    assert response.json()["request_id"] in message
    assert SECRET_MARKER not in message


def test_caller_supplied_request_id_is_echoed_back():
    client = TestClient(_boom_app(), raise_server_exceptions=False)
    response = client.get("/boom", headers={"X-Request-Id": "caller-supplied-id"})

    assert response.headers["x-request-id"] == "caller-supplied-id"
    assert response.json()["request_id"] == "caller-supplied-id"


def test_http_exceptions_are_unaffected():
    """A deliberate 4xx (not an unhandled exception) must keep behaving
    exactly as before — only genuinely unhandled exceptions go through the
    new handler."""
    app = FastAPI()
    _install_error_handling(app)

    @app.get("/not-found")
    def not_found():
        from fastapi import HTTPException

        raise HTTPException(404, "nope")

    client = TestClient(app, raise_server_exceptions=False)
    response = client.get("/not-found")

    assert response.status_code == 404
    assert response.json() == {"detail": "nope"}
