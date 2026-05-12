"""Integration tests for finalized user-week endpoints."""
from __future__ import annotations

from datetime import date, datetime, timedelta

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

    def test_finalize_week_allows_week_ending_today(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        import app.routers.finalized_weeks as finalized_weeks_router
        import app.routers.work_events as work_events_router

        class FixedDateTime(datetime):
            @classmethod
            def now(cls, tz=None):
                return cls(2025, 12, 7, 12, 0, 0, tzinfo=tz)

        monkeypatch.setattr(finalized_weeks_router, "datetime", FixedDateTime)
        monkeypatch.setattr(work_events_router, "datetime", FixedDateTime)

        week_start = date(2025, 12, 1)  # week_end is 2025-12-07 (today in patched clock)
        _create_full_week(client, auth_headers, week_start)

        response = client.post(
            "/finalized-weeks",
            json={"week_start": week_start.isoformat()},
            headers=auth_headers,
        )
        assert response.status_code == 201

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


def _last_monday() -> date:
    """Return the most recent Monday that is in a fully elapsed week."""
    today = date.today()
    # Go back to this week's Monday
    this_monday = today - timedelta(days=today.weekday())
    # Use last week's Monday to ensure the week has ended
    return this_monday - timedelta(days=7)


@pytest.mark.integration
class TestFinalizedWeeksDirectHours:
    """Tests for the new direct-hours mode (no work_events needed)."""

    def test_finalize_with_direct_hours(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        test_db: Session,
    ) -> None:
        """New mode: provide hours in request body, no work_events needed."""
        monday = _last_monday()
        response = client.post(
            "/finalized-weeks",
            json={
                "week_start": str(monday),
                "planned_hours": 40.0,
                "actual_hours": 45.5,
            },
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert float(data["planned_hours"]) == 40.0
        assert float(data["actual_hours"]) == 45.5

        stored = test_db.query(FinalizedUserWeek).filter(
            FinalizedUserWeek.week_start == monday
        ).one()
        assert float(stored.planned_hours) == 40.0
        assert float(stored.actual_hours) == 45.5

    def test_finalize_direct_hours_validation_range(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Reject hours outside 0-168 range."""
        monday = _last_monday()
        response = client.post(
            "/finalized-weeks",
            json={"week_start": str(monday), "planned_hours": -1, "actual_hours": 40},
            headers=auth_headers,
        )
        assert response.status_code == 422

        response = client.post(
            "/finalized-weeks",
            json={"week_start": str(monday), "planned_hours": 40, "actual_hours": 200},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_finalize_direct_hours_must_provide_both(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Reject if only one of planned/actual is provided."""
        monday = _last_monday()
        response = client.post(
            "/finalized-weeks",
            json={"week_start": str(monday), "planned_hours": 40},
            headers=auth_headers,
        )
        assert response.status_code == 422

    def test_finalize_direct_hours_rejects_week_ending_in_future(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Reject weeks whose Sunday is still in the future."""
        today = date.today()
        # Find a Monday whose week hasn't ended yet
        next_monday = today
        while next_monday.weekday() != 0:
            next_monday += timedelta(days=1)
        # If today is Sunday, next_monday is tomorrow - guaranteed future week
        if next_monday == today and today.weekday() == 0:
            next_monday += timedelta(days=7)
        response = client.post(
            "/finalized-weeks",
            json={"week_start": str(next_monday), "planned_hours": 40, "actual_hours": 40},
            headers=auth_headers,
        )
        assert response.status_code == 400

    def test_finalize_direct_hours_allows_week_ending_today(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Allow direct-hours finalization when the week ends today (Sunday)."""
        import app.routers.finalized_weeks as finalized_weeks_router

        class FixedDateTime(datetime):
            @classmethod
            def now(cls, tz=None):
                return cls(2025, 12, 7, 12, 0, 0, tzinfo=tz)

        monkeypatch.setattr(finalized_weeks_router, "datetime", FixedDateTime)

        response = client.post(
            "/finalized-weeks",
            json={"week_start": "2025-12-01", "planned_hours": 40, "actual_hours": 45},
            headers=auth_headers,
        )
        assert response.status_code == 201

    def test_finalize_direct_hours_conflict(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """409 if week already finalized."""
        monday = _last_monday()
        client.post(
            "/finalized-weeks",
            json={"week_start": str(monday), "planned_hours": 40, "actual_hours": 45},
            headers=auth_headers,
        )
        response = client.post(
            "/finalized-weeks",
            json={"week_start": str(monday), "planned_hours": 40, "actual_hours": 45},
            headers=auth_headers,
        )
        assert response.status_code == 409

    def test_legacy_mode_still_works(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Old mode (no hours in body) still works when work_events exist."""
        monday = _last_monday()
        _create_full_week(client, auth_headers, monday)
        response = client.post(
            "/finalized-weeks",
            json={"week_start": str(monday)},
            headers=auth_headers,
        )
        assert response.status_code == 201

    def test_finalize_direct_hours_snapshots_user_profile(
        self,
        client: TestClient,
        auth_headers: dict[str, str],
    ) -> None:
        """Direct-hours mode still snapshots user demographics."""
        monday = _last_monday()
        response = client.post(
            "/finalized-weeks",
            json={"week_start": str(monday), "planned_hours": 40, "actual_hours": 45},
            headers=auth_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert "hospital_id" in data
        assert "specialty" in data
        assert "state_code" in data
