"""
Feedback / Bug Report API
Allows mobile app users to submit bug reports and feedback
"""
from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import FeedbackReport
from ..rate_limit import rate_limit
from ..schemas import FeedbackIn, FeedbackOut

router = APIRouter(prefix="/feedback", tags=["feedback"])


def _round_coordinate(value: object) -> float | None:
    try:
        return round(float(value), 3)
    except (TypeError, ValueError):
        return None


def _sanitize_location_details(location_details: list[dict] | None) -> list[dict]:
    sanitized_locations: list[dict] = []
    for location in location_details or []:
        sanitized_locations.append({
            "name": location.get("name"),
            "latitude": _round_coordinate(location.get("latitude")),
            "longitude": _round_coordinate(location.get("longitude")),
        })
    return sanitized_locations


@router.post("", response_model=FeedbackOut, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    payload: FeedbackIn,
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit(10, 60)),
) -> FeedbackOut:
    """
    Submit bug report / feedback from mobile app

    This endpoint:
    1. Receives app state and user description
    2. Stores the report in database
    3. Returns success confirmation to user

    No authentication required - we want users to report issues easily
    Reports can be viewed in the admin dashboard at /admin
    """
    include_location_diagnostics = (
        payload.include_location_diagnostics
        and payload.diagnostics_scope == "location"
    )

    gps_telemetry = payload.gps_telemetry.model_dump() if payload.gps_telemetry else None
    if gps_telemetry and not include_location_diagnostics:
        for event in gps_telemetry.get("recent_events", []):
            event.pop("location_name", None)
    location_details = (
        _sanitize_location_details(payload.locations_details)
        if include_location_diagnostics
        else None
    )

    # Build app_state JSON
    app_state = {
        "diagnostics": {
            "scope": "location" if include_location_diagnostics else "standard",
            "include_location_diagnostics": include_location_diagnostics,
            "feature_area": payload.feature_area,
        },
        "locations": {
            "count": payload.locations_count,
            "details": location_details,
        },
        "work_events": {
            "total": payload.work_events_total,
            "pending": payload.work_events_pending,
            "last_submission": payload.last_submission.isoformat() if payload.last_submission else None,
        },
        "app": {
            "version": payload.app_version,
            "build_number": payload.build_number,
            "platform": payload.platform,
            "device_model": payload.device_model,
            "os_version": payload.os_version,
        },
        # GPS telemetry for geofence parameter tuning
        "gps_telemetry": gps_telemetry,
    }

    # Create feedback report
    # user_id is sufficient to identify the user if needed; email is not collected.
    report = FeedbackReport(
        user_id=payload.user_id,
        hospital_id=None,
        specialty=None,
        role_level=None,
        state_code=None,
        description=payload.description,
        app_state=app_state,
        created_at=datetime.now(timezone.utc),
        resolved="pending",
    )

    db.add(report)
    db.commit()

    return FeedbackOut(
        success=True,
        message="Thank you! Your feedback has been submitted."
    )
