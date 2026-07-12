"""Tests for the /healthz endpoint (liveness + DB connectivity)."""
from __future__ import annotations

from fastapi.testclient import TestClient


def test_healthz_ok(client: TestClient) -> None:
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_healthz_degraded_when_db_unreachable(client: TestClient, monkeypatch) -> None:
    """A dead database must not report healthy to uptime monitoring."""
    import app.main as main_module

    class BrokenSession:
        def __enter__(self):
            raise RuntimeError("connection refused")

        def __exit__(self, *args):
            return False

    monkeypatch.setattr(main_module, "SessionLocal", lambda: BrokenSession())

    response = client.get("/healthz")
    assert response.status_code == 503
    assert response.json()["status"] == "degraded"
