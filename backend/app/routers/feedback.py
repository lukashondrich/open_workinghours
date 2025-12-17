"""
Feedback / Bug Report API
Allows mobile app users to submit bug reports and feedback
"""
from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, HTTPException, status

from .. import email as email_service
from ..schemas import FeedbackIn, FeedbackOut

router = APIRouter(prefix="/feedback", tags=["feedback"])


@router.post("", response_model=FeedbackOut, status_code=status.HTTP_201_CREATED)
def submit_feedback(
    payload: FeedbackIn,
    background: BackgroundTasks,
) -> FeedbackOut:
    """
    Submit bug report / feedback from mobile app

    This endpoint:
    1. Receives app state and user description
    2. Emails the report to the admin
    3. Returns success confirmation to user

    No authentication required - we want users to report issues easily
    """

    # Format the feedback email
    timestamp = datetime.now(timezone.utc).isoformat()

    # Format locations list outside f-string (can't use backslash in f-string)
    locations_list = "\n".join([
        f"- Location {i+1}: \"{loc.get('name', 'Unnamed')}\" ({loc.get('latitude', 0):.4f}, {loc.get('longitude', 0):.4f})"
        for i, loc in enumerate(payload.locations_details)
    ])

    # Format user info
    user_info = f'''- User ID: {payload.user_id}
- Email: {payload.user_email}
- Hospital: {payload.hospital_id}
- Specialty: {payload.specialty}
- Role: {payload.role_level}
- State: {payload.state_code}''' if payload.user_id else '- Not logged in'

    email_body = f"""--- Bug Report / Feedback ---
Submitted: {timestamp}

USER INFO:
{user_info}

LOCATIONS:
- Total configured: {payload.locations_count}
{locations_list}

WORK EVENTS:
- Total tracked: {payload.work_events_total}
- Last submission: {payload.last_submission.isoformat() if payload.last_submission else 'Never'}
- Pending (not submitted): {payload.work_events_pending}

APP STATE:
- Build: #{payload.build_number} (v{payload.app_version})
- Platform: {payload.platform} {payload.os_version or ''}
- Device: {payload.device_model or 'Unknown'}

USER DESCRIPTION:
{payload.description or '(No description provided)'}

---
Submitted via API endpoint
"""

    # Send email in background
    background.add_task(
        email_service.send_verification_email,
        recipient="lukashondrich@googlemail.com",  # Your email
        content=email_body,
        subject=f"Bug Report - {timestamp.split('T')[0]}"
    )

    return FeedbackOut(
        success=True,
        message="Thank you! Your feedback has been submitted."
    )
