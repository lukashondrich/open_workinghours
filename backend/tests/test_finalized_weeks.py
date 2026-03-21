"""Integration tests for finalized user-week endpoints."""
from __future__ import annotations

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import FinalizedUserWeek, WorkEvent


def _create_full_week(client: TestClient, auth_headers: dict[str, str], week_start: date) -> None:
    for offset in range(7):
        current_date = week_start + timedelta(days=offset)
        response = client.post(
            "/work-events",
            json={
                "date": current_date.isoformat(),
                "planned_hours": 8.0,
                "actual_hours": 9.0,
                "source": "manual",
            },
            headers=auth_headers,
        )
        assert response.status_code == 201, response.json()


@pytest.mark.integration
class TestFinalizedWeeks:
    def test_finalize_week_materializes_server_side_record(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        test_db: Session,
    ) -> None:
        week_start = date(2025, 12, 1)
        _create_full_week(client, auth_headers, week_start)

        response = client.post(
            "/finalized-weeks",
            json={"week_start": week_start.isoformat()},
            headers=auth_headers,
        )

        assert response.status_code == 201
        data = response.json()
        assert data["week_start"] == "2025-12-01"
        assert data["week_end"] == "2025-12-07"
        assert data["planned_hours"] == 56.0
        assert data["actual_hours"] == 63.0
        assert data["specialty"] == "surgery"

        stored = test_db.query(FinalizedUserWeek).filter(FinalizedUserWeek.week_start == week_start).one()
        assert float(stored.planned_hours) == 56.0
        assert float(stored.actual_hours) == 63.0

    def test_finalize_week_requires_all_seven_days(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        week_start = date(2025, 12, 8)
        for offset in range(6):
            current_date = week_start + timedelta(days=offset)
            response = client.post(
                "/work-events",
                json={
                    "date": current_date.isoformat(),
                    "planned_hours": 8.0,
                    "actual_hours": 8.0,
                    "source": "manual",
                },
                headers=auth_headers,
            )
            assert response.status_code == 201

        response = client.post(
            "/finalized-weeks",
            json={"week_start": week_start.isoformat()},
            headers=auth_headers,
        )

        assert response.status_code == 400
        assert "7 days" in response.json()["detail"]

    def test_finalize_week_cannot_be_created_twice(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        week_start = date(2025, 12, 15)
        _create_full_week(client, auth_headers, week_start)

        response1 = client.post(
            "/finalized-weeks",
            json={"week_start": week_start.isoformat()},
            headers=auth_headers,
        )
        assert response1.status_code == 201

        response2 = client.post(
            "/finalized-weeks",
            json={"week_start": week_start.isoformat()},
            headers=auth_headers,
        )
        assert response2.status_code == 409

    def test_cannot_update_or_delete_work_event_in_finalized_week(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        week_start = date(2025, 12, 22)
        _create_full_week(client, auth_headers, week_start)

        finalize_response = client.post(
            "/finalized-weeks",
            json={"week_start": week_start.isoformat()},
            headers=auth_headers,
        )
        assert finalize_response.status_code == 201

        work_events = client.get("/work-events", headers=auth_headers).json()
        event_id = next(event["event_id"] for event in work_events if event["date"] == "2025-12-22")

        patch_response = client.patch(
            f"/work-events/{event_id}",
            json={"actual_hours": 10.0},
            headers=auth_headers,
        )
        assert patch_response.status_code == 409
        assert "finalized week" in patch_response.json()["detail"].lower()

        delete_response = client.delete(f"/work-events/{event_id}", headers=auth_headers)
        assert delete_response.status_code == 409

    def test_cannot_create_new_work_event_in_finalized_week(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        test_db: Session,
    ) -> None:
        week_start = date(2025, 12, 29)
        _create_full_week(client, auth_headers, week_start)

        finalize_response = client.post(
            "/finalized-weeks",
            json={"week_start": week_start.isoformat()},
            headers=auth_headers,
        )
        assert finalize_response.status_code == 201

        event = test_db.query(WorkEvent).filter(WorkEvent.date == date(2025, 12, 29)).one()
        test_db.delete(event)
        test_db.commit()

        create_response = client.post(
            "/work-events",
            json={
                "date": "2025-12-29",
                "planned_hours": 8.0,
                "actual_hours": 9.0,
                "source": "manual",
            },
            headers=auth_headers,
        )
        assert create_response.status_code == 409
        assert "finalized week" in create_response.json()["detail"].lower()
