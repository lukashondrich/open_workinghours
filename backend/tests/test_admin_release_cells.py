from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import StateSpecialtyReleaseCell


@pytest.mark.integration
class TestAdminReleaseCells:
    @pytest.fixture
    def admin_auth(self) -> tuple[str, str]:
        return ("admin", "test-admin-password")

    def test_list_release_cells_empty(self, client: TestClient, admin_auth: tuple[str, str]) -> None:
        response = client.get("/admin/release-cells/state-specialty", auth=admin_auth)

        assert response.status_code == 200
        assert response.json() == []

    def test_upsert_release_cells_creates_and_updates(
        self,
        client: TestClient,
        test_db: Session,
        admin_auth: tuple[str, str],
    ) -> None:
        response = client.put(
            "/admin/release-cells/state-specialty",
            auth=admin_auth,
            json={
                "cells": [
                    {
                        "country_code": "deu",
                        "state_code": "by",
                        "specialty": "surgery",
                    },
                    {
                        "state_code": "hh",
                        "specialty": "pediatrics",
                        "is_enabled": False,
                    },
                ]
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["upserted"] == 2
        assert [row["state_code"] for row in data["cells"]] == ["BY", "HH"]

        rows = (
            test_db.query(StateSpecialtyReleaseCell)
            .order_by(StateSpecialtyReleaseCell.state_code.asc())
            .all()
        )
        assert len(rows) == 2
        assert rows[0].country_code == "DEU"
        assert rows[0].state_code == "BY"
        assert rows[0].specialty == "surgery"
        assert rows[0].is_enabled is True
        assert rows[1].is_enabled is False

        update_response = client.put(
            "/admin/release-cells/state-specialty",
            auth=admin_auth,
            json={
                "cells": [
                    {
                        "state_code": "BY",
                        "specialty": "surgery",
                        "is_enabled": False,
                    }
                ]
            },
        )

        assert update_response.status_code == 200
        update_data = update_response.json()
        assert update_data["upserted"] == 1
        assert update_data["cells"][0]["is_enabled"] is False

        stored = (
            test_db.query(StateSpecialtyReleaseCell)
            .filter(
                StateSpecialtyReleaseCell.country_code == "DEU",
                StateSpecialtyReleaseCell.state_code == "BY",
                StateSpecialtyReleaseCell.specialty == "surgery",
            )
            .one()
        )
        assert stored.is_enabled is False

    def test_release_cells_require_admin_auth(self, client: TestClient) -> None:
        response = client.get("/admin/release-cells/state-specialty")

        assert response.status_code == 401
