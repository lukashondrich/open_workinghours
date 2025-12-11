"""Integration tests for work events endpoints."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import WorkEvent


@pytest.mark.integration
class TestWorkEventsCreate:
    """Test work event creation."""

    def test_create_work_event(
        self, client: TestClient, auth_headers: dict[str, str], sample_work_event: dict
    ):
        """Test successful work event creation."""
        response = client.post("/work-events", json=sample_work_event, headers=auth_headers)

        assert response.status_code == 201
        data = response.json()
        assert "event_id" in data
        assert data["date"] == sample_work_event["date"]
        assert data["planned_hours"] == sample_work_event["planned_hours"]
        assert data["actual_hours"] == sample_work_event["actual_hours"]
        assert data["source"] == sample_work_event["source"]

    def test_create_work_event_unauthorized(self, client: TestClient, sample_work_event: dict):
        """Test that creating work event without auth fails."""
        response = client.post("/work-events", json=sample_work_event)
        assert response.status_code == 401

    def test_create_work_event_invalid_hours(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """Test validation of work hours."""
        # Test negative hours
        invalid_payload = {
            "date": "2025-12-09",
            "planned_hours": -1.0,
            "actual_hours": 8.0,
            "source": "manual",
        }
        response = client.post("/work-events", json=invalid_payload, headers=auth_headers)
        assert response.status_code == 422  # Validation error

        # Test hours > 24
        invalid_payload["planned_hours"] = 25.0
        response = client.post("/work-events", json=invalid_payload, headers=auth_headers)
        assert response.status_code == 422

    def test_create_duplicate_date(
        self, client: TestClient, auth_headers: dict[str, str], sample_work_event: dict
    ):
        """Test that duplicate dates for same user are handled."""
        # Create first event
        response1 = client.post("/work-events", json=sample_work_event, headers=auth_headers)
        assert response1.status_code == 201

        # Try to create duplicate (same date, same user)
        response2 = client.post("/work-events", json=sample_work_event, headers=auth_headers)
        assert response2.status_code == 409  # Conflict


@pytest.mark.integration
class TestWorkEventsList:
    """Test work events listing."""

    def test_list_work_events(
        self, client: TestClient, auth_headers: dict[str, str], sample_work_event: dict
    ):
        """Test listing work events."""
        # Create a work event first
        client.post("/work-events", json=sample_work_event, headers=auth_headers)

        # List work events
        response = client.get("/work-events", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["date"] == sample_work_event["date"]

    def test_list_work_events_with_date_filter(
        self, client: TestClient, auth_headers: dict[str, str]
    ):
        """Test filtering work events by date range."""
        # Create multiple events
        events = [
            {"date": "2025-12-01", "planned_hours": 8.0, "actual_hours": 8.0, "source": "manual"},
            {"date": "2025-12-05", "planned_hours": 8.0, "actual_hours": 8.5, "source": "geofence"},
            {"date": "2025-12-10", "planned_hours": 8.0, "actual_hours": 9.0, "source": "mixed"},
        ]
        for event in events:
            client.post("/work-events", json=event, headers=auth_headers)

        # Filter by date range
        response = client.get(
            "/work-events?start_date=2025-12-04&end_date=2025-12-08", headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["date"] == "2025-12-05"

    def test_list_work_events_unauthorized(self, client: TestClient):
        """Test that listing without auth fails."""
        response = client.get("/work-events")
        assert response.status_code == 401


@pytest.mark.integration
class TestWorkEventsUpdate:
    """Test work event updates."""

    def test_update_work_event(
        self, client: TestClient, auth_headers: dict[str, str], sample_work_event: dict
    ):
        """Test updating a work event."""
        # Create event
        create_response = client.post(
            "/work-events", json=sample_work_event, headers=auth_headers
        )
        event_id = create_response.json()["event_id"]

        # Update event
        update_payload = {"actual_hours": 10.0, "source": "mixed"}
        response = client.patch(
            f"/work-events/{event_id}", json=update_payload, headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["actual_hours"] == 10.0
        assert data["source"] == "mixed"
        # Planned hours should be unchanged
        assert data["planned_hours"] == sample_work_event["planned_hours"]

    def test_update_nonexistent_event(self, client: TestClient, auth_headers: dict[str, str]):
        """Test updating a non-existent event."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        update_payload = {"actual_hours": 10.0}
        response = client.patch(
            f"/work-events/{fake_id}", json=update_payload, headers=auth_headers
        )
        assert response.status_code == 404


@pytest.mark.integration
class TestWorkEventsDelete:
    """Test work event deletion."""

    def test_delete_work_event(
        self, client: TestClient, auth_headers: dict[str, str], sample_work_event: dict
    ):
        """Test deleting a work event."""
        # Create event
        create_response = client.post(
            "/work-events", json=sample_work_event, headers=auth_headers
        )
        event_id = create_response.json()["event_id"]

        # Delete event
        response = client.delete(f"/work-events/{event_id}", headers=auth_headers)
        assert response.status_code == 204

        # Verify deletion
        list_response = client.get("/work-events", headers=auth_headers)
        data = list_response.json()
        assert len([e for e in data if e["event_id"] == event_id]) == 0

    def test_delete_nonexistent_event(self, client: TestClient, auth_headers: dict[str, str]):
        """Test deleting a non-existent event."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = client.delete(f"/work-events/{fake_id}", headers=auth_headers)
        assert response.status_code == 404


@pytest.mark.integration
class TestRightToErasure:
    """Test GDPR right to erasure via CASCADE delete."""

    def test_cascade_delete_on_user_deletion(
        self, client: TestClient, auth_headers: dict[str, str], test_db: Session
    ):
        """Test that deleting a user cascades to work events."""
        # Create multiple work events
        events = [
            {"date": "2025-12-01", "planned_hours": 8.0, "actual_hours": 8.0, "source": "manual"},
            {"date": "2025-12-02", "planned_hours": 8.0, "actual_hours": 8.5, "source": "geofence"},
        ]
        for event in events:
            client.post("/work-events", json=event, headers=auth_headers)

        # Get user ID from auth
        me_response = client.get("/auth/me", headers=auth_headers)
        user_id = me_response.json()["user_id"]

        # Verify work events exist
        work_events_before = test_db.query(WorkEvent).filter(WorkEvent.user_id == user_id).count()
        assert work_events_before >= 2

        # Delete user (simulating right to erasure)
        from app.models import User
        user = test_db.query(User).filter(User.user_id == user_id).first()
        test_db.delete(user)
        test_db.commit()

        # Verify work events were cascade deleted
        work_events_after = test_db.query(WorkEvent).filter(WorkEvent.user_id == user_id).count()
        assert work_events_after == 0
