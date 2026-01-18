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
from ..schemas import FeedbackIn, FeedbackOut

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackOut, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    payload: FeedbackIn,
    db: Session = Depends(get_db),
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

    # Build app_state JSON
    app_state = {
        "locations": {
            "count": payload.locations_count,
            "details": payload.locations_details,
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
        "gps_telemetry": payload.gps_telemetry.model_dump() if payload.gps_telemetry else None,
    }

    # Create feedback report
    # Note: user_email intentionally not stored (privacy-by-design)
    # user_id is sufficient to identify the user if needed
    report = FeedbackReport(
        user_id=payload.user_id,
        user_email=None,
        hospital_id=payload.hospital_id,
        specialty=payload.specialty,
        role_level=payload.role_level,
        state_code=payload.state_code,
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
