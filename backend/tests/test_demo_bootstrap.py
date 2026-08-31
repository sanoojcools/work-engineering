"""Cover the one-command demo setup, because every failure here is a failure
in front of an audience: a key that cannot be obtained, a key that cannot be
recovered, or a re-run that duplicates data.

SQLite is enough — the endpoint's cross-tenant session is overridden onto the
test session in conftest, and none of these assertions depend on RLS.
"""
from __future__ import annotations

from app.models.client import Client
from app.models.security import OrgApiKey


def _bootstrap(client, **params):
    response = client.post("/api/demo/bootstrap", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def _auth_status(client, key: str | None) -> int:
    """Does this key authenticate?

    Uses /scout/extract-from-story because it is the one route that takes
    OrgKeyDep WITHOUT TenantDbDep. Anything tenant-scoped issues
    `SET app.current_client_id`, which is Postgres-only syntax SQLite cannot
    execute — that is why the RLS-dependent suites are Postgres-gated. The
    question here is only whether the credential is accepted."""
    headers = {"X-Spec-Key": key} if key else {}
    return client.post(
        "/api/scout/extract-from-story",
        headers=headers,
        json={"transcript_chunk": "A refund request arrives. I check the order."},
    ).status_code


def test_bootstrap_returns_a_usable_key_for_each_tenant(client):
    body = _bootstrap(client)

    assert body["api_key"], "Client A must get a first key — there is no other way to obtain one"
    assert body["sample_genome_api_key"], "the sample genome tenant needs its own key"
    assert body["api_key"] != body["sample_genome_api_key"]

    # The key actually authenticates: this is the whole point of the endpoint.
    assert _auth_status(client, body["api_key"]) == 200
    assert _auth_status(client, body["sample_genome_api_key"]) == 200
    assert _auth_status(client, None) == 401


def test_bootstrap_is_idempotent(client):
    first = _bootstrap(client)
    second = _bootstrap(client)

    # A nervous presenter running it twice must not get a second census, and
    # must not silently invalidate the key they are already holding.
    assert second["api_key"] is None
    assert second["census"]["units"] == first["census"]["units"]
    assert _auth_status(client, first["api_key"]) == 200


def test_new_keys_recovers_a_lost_key(client, db):
    """Rotation needs the key you are trying to replace, so a mislaid key had
    no recovery path short of editing the database by hand."""
    first = _bootstrap(client)
    replaced = _bootstrap(client, new_keys=True)

    assert replaced["api_key"], "?new_keys=true must issue a fresh key"
    assert replaced["api_key"] != first["api_key"]

    assert _auth_status(client, replaced["api_key"]) == 200
    assert _auth_status(client, first["api_key"]) == 401, "the lost key must stop working"

    client_a = db.query(Client).filter(Client.slug == "client-a").one()
    active = db.query(OrgApiKey).filter(
        OrgApiKey.client_id == client_a.id, OrgApiKey.is_active.is_(True)
    ).count()
    assert active == 1, "the retired key must not stay active alongside the new one"


def test_bootstrap_can_be_disabled(client, monkeypatch):
    """It returns a credential over an unauthenticated request, so anywhere
    that is not a throwaway local database must be able to turn it off."""
    from app import config
    monkeypatch.setattr(config.settings, "demo_bootstrap_enabled", False)

    refused = client.post("/api/demo/bootstrap")
    assert refused.status_code == 403
    assert "disabled" in refused.json()["detail"].lower()
