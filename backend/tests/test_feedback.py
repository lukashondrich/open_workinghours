from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.cleanup import purge_old_feedback_reports
from app.models import FeedbackReport


def _base_feedback_payload() -> dict:
    return {
        "user_id": "user-123",
        "hospital_id": "legacy-hospital",
        "specialty": "legacy-specialty",
        "role_level": "legacy-role",
        "state_code": "BE",
        "locations_count": 1,
        "locations_details": [
            {
                "name": "Legacy precise location",
                "latitude": 52.520008,
                "longitude": 13.404954,
            }
        ],
        "work_events_total": 3,
        "work_events_pending": 0,
        "app_version": "1.0.0",
        "build_number": "30",
        "platform": "ios",
        "device_model": "iPhone",
        "os_version": "17.0",
        "gps_telemetry": {
            "recent_events": [
                {
                    "timestamp": "2026-06-02T10:00:00Z",
                    "event_type": "enter",
                    "accuracy_meters": 12.5,
                    "accuracy_source": "event",
                    "ignored": False,
                    "ignore_reason": None,
                    "location_name": "Legacy precise location",
                }
            ],
            "accuracy_stats": {
                "min": 12.5,
                "max": 12.5,
                "avg": 12.5,
                "count": 1,
            },
            "ignored_events_count": 0,
            "signal_degradation_count": 0,
            "debounced_events_count": 0,
        },
        "description": "Geofence did not trigger",
    }


def test_feedback_standard_scope_strips_location_diagnostics(
    client: TestClient,
    test_db: Session,
) -> None:
    response = client.post("/feedback", json=_base_feedback_payload())

    assert response.status_code == 201
    report = test_db.query(FeedbackReport).one()
    assert report.user_id == "user-123"
    assert report.hospital_id is None
    assert report.specialty is None
    assert report.role_level is None
    assert report.state_code is None

    assert report.app_state["diagnostics"] == {
        "scope": "standard",
        "include_location_diagnostics": False,
        "feature_area": None,
    }
    assert report.app_state["locations"] == {
        "count": 1,
        "details": None,
    }
    assert "location_name" not in report.app_state["gps_telemetry"]["recent_events"][0]


def test_feedback_location_scope_preserves_rounded_location_diagnostics(
    client: TestClient,
    test_db: Session,
) -> None:
    payload = _base_feedback_payload()
    payload.update(
        {
            "include_location_diagnostics": True,
            "diagnostics_scope": "location",
            "feature_area": "settings",
            "locations_details": [
                {
                    "name": "Rounded workplace",
                    "latitude": 52.520008,
                    "longitude": 13.404954,
                }
            ],
        }
    )

    response = client.post("/feedback", json=payload)

    assert response.status_code == 201
    report = test_db.query(FeedbackReport).one()
    assert report.app_state["diagnostics"] == {
        "scope": "location",
        "include_location_diagnostics": True,
        "feature_area": "settings",
    }
    assert report.app_state["locations"]["details"] == [
        {
            "name": "Rounded workplace",
            "latitude": 52.52,
            "longitude": 13.405,
        }
    ]
    assert report.app_state["gps_telemetry"]["recent_events"][0]["location_name"] == "Legacy precise location"


def test_purge_old_feedback_reports_deletes_reports_after_retention(
    test_db: Session,
) -> None:
    now = datetime(2026, 6, 2, tzinfo=timezone.utc)
    old_report = FeedbackReport(
        user_id="old-user",
        app_state={},
        created_at=now - timedelta(days=91),
    )
    recent_report = FeedbackReport(
        user_id="recent-user",
        app_state={},
        created_at=now - timedelta(days=89),
    )
    test_db.add_all([old_report, recent_report])
    test_db.commit()

    deleted_count = purge_old_feedback_reports(test_db, now=now)

    assert deleted_count == 1
    remaining_user_ids = {
        row.user_id for row in test_db.query(FeedbackReport).all()
    }
    assert remaining_user_ids == {"recent-user"}
