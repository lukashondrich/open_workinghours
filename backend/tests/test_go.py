"""Tests for the /go/{slug} campaign tap counter."""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.routers.go import CAMPAIGN_LINKS


def test_go_redirects_to_campaign_link(client: TestClient, caplog) -> None:
    with caplog.at_level("INFO", logger="app.routers.go"):
        response = client.get("/go/ig2", follow_redirects=False)
    assert response.status_code == 302
    assert response.headers["location"] == CAMPAIGN_LINKS["ig2"]
    assert "ct=ig-test-2026-09-collective" in response.headers["location"]
    assert "go_click slug=ig2" in caplog.text


def test_go_unknown_slug_is_404(client: TestClient) -> None:
    response = client.get("/go/nope", follow_redirects=False)
    assert response.status_code == 404
