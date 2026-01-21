"""
Public Dashboard API - Coverage and activity endpoints for the public dashboard.

These endpoints are PUBLIC (no authentication required) and designed with
privacy protections:
- Contributor counts shown as ranges, not exact numbers (below threshold)
- Update timestamps at weekly precision only
- No individual-level data exposed
"""
from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..email import send_inquiry_notification
from ..models import InstitutionInquiry, User, WorkEvent
from ..schemas import (
    ActivityOut,
    CoverageOut,
    InstitutionInquiryIn,
    InstitutionInquiryOut,
    StateCoverageOut,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

# German states mapping (state_code -> full name)
GERMAN_STATES = {
    "BW": "Baden-Württemberg",
    "BY": "Bayern",
    "BE": "Berlin",
    "BB": "Brandenburg",
    "HB": "Bremen",
    "HH": "Hamburg",
    "HE": "Hessen",
    "MV": "Mecklenburg-Vorpommern",
    "NI": "Niedersachsen",
    "NW": "Nordrhein-Westfalen",
    "RP": "Rheinland-Pfalz",
    "SL": "Saarland",
    "SN": "Sachsen",
    "ST": "Sachsen-Anhalt",
    "SH": "Schleswig-Holstein",
    "TH": "Thüringen",
}

# Privacy threshold (k-anonymity)
K_MIN = 11


def _count_to_range(count: int) -> str:
    """
    Convert exact count to privacy-preserving range.

    Privacy protection: Don't expose exact counts below threshold.
    """
    if count == 0:
        return "0"
    elif count < K_MIN:
        return "1-10"
    elif count < 50:
        return "11-50"
    else:
        return "50+"


def _count_to_status(count: int) -> str:
    """
    Convert contributor count to coverage status.

    - "none": No contributors
    - "building": 1-10 contributors (below threshold)
    - "available": 11+ contributors (threshold met)
    """
    if count == 0:
        return "none"
    elif count < K_MIN:
        return "building"
    else:
        return "available"


def _get_weekly_timestamp() -> datetime:
    """
    Get timestamp truncated to start of week.

    Privacy protection: Weekly precision prevents timing attacks.
    """
    now = datetime.utcnow()
    # Truncate to Monday of current week
    days_since_monday = now.weekday()
    monday = now - timedelta(days=days_since_monday)
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


@router.get("/coverage", response_model=CoverageOut)
def get_coverage(db: Session = Depends(get_db)) -> CoverageOut:
    """
    Get coverage status for the public dashboard map.

    Returns per-state contributor counts (as ranges) and coverage status.
    Used to color the Germany map on the public dashboard.

    Privacy protections:
    - Contributor counts shown as ranges (e.g., "1-10") not exact numbers
    - Timestamp at weekly precision only
    - No individual-level data exposed
    """
    # Count distinct users per state
    state_counts = (
        db.query(
            User.state_code,
            func.count(User.user_id).label("count")
        )
        .filter(User.state_code.isnot(None))
        .group_by(User.state_code)
        .all()
    )

    state_count_map = {row.state_code: row.count for row in state_counts}

    # Build state coverage list
    states = []
    for state_code, state_name in GERMAN_STATES.items():
        count = state_count_map.get(state_code, 0)
        states.append(StateCoverageOut(
            state_code=state_code,
            state_name=state_name,
            status=_count_to_status(count),
            contributors_range=_count_to_range(count),
            threshold=K_MIN,
        ))

    # Sort by state name
    states.sort(key=lambda s: s.state_name)

    # National total
    total_users = db.query(func.count(User.user_id)).scalar() or 0

    national = StateCoverageOut(
        state_code="DEU",
        state_name="Deutschland",
        status=_count_to_status(total_users),
        contributors_range=_count_to_range(total_users),
        threshold=K_MIN,
    )

    return CoverageOut(
        updated_at=_get_weekly_timestamp(),
        update_precision="weekly",
        threshold=K_MIN,
        states=states,
        national=national,
    )


@router.get("/activity", response_model=ActivityOut)
def get_activity(db: Session = Depends(get_db)) -> ActivityOut:
    """
    Get 30-day rolling activity for the public dashboard.

    Returns:
    - Number of active contributors (as range)
    - Number of confirmed shifts
    - Number of states in each coverage status

    Privacy protections:
    - Contributor count as range
    - Shift count is exact (aggregate, not identifying)
    """
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    # Count distinct users who submitted in last 30 days
    active_contributors = (
        db.query(func.count(func.distinct(WorkEvent.user_id)))
        .filter(WorkEvent.submitted_at >= thirty_days_ago)
        .scalar()
    ) or 0

    # Count total shifts (work events) in last 30 days
    shifts_confirmed = (
        db.query(func.count(WorkEvent.event_id))
        .filter(WorkEvent.submitted_at >= thirty_days_ago)
        .scalar()
    ) or 0

    # Count states by coverage status
    state_counts = (
        db.query(
            User.state_code,
            func.count(User.user_id).label("count")
        )
        .filter(User.state_code.isnot(None))
        .group_by(User.state_code)
        .all()
    )

    states_building = 0
    states_available = 0
    for row in state_counts:
        if row.count >= K_MIN:
            states_available += 1
        elif row.count > 0:
            states_building += 1

    return ActivityOut(
        period_days=30,
        contributors_range=_count_to_range(active_contributors),
        shifts_confirmed=shifts_confirmed,
        states_building=states_building,
        states_available=states_available,
    )


@router.post("/contact", response_model=InstitutionInquiryOut)
def submit_institution_inquiry(
    inquiry: InstitutionInquiryIn,
    db: Session = Depends(get_db),
) -> InstitutionInquiryOut:
    """
    Submit a contact form inquiry from institutions.

    Used by unions, researchers, and press to request information
    or schedule briefings about the platform.
    """
    # Create the inquiry record
    db_inquiry = InstitutionInquiry(
        name=inquiry.name,
        organization=inquiry.organization,
        role=inquiry.role,
        email=inquiry.email,
        message=inquiry.message,
    )

    db.add(db_inquiry)
    db.commit()
    db.refresh(db_inquiry)

    # Send email notification to admin
    send_inquiry_notification(
        inquiry_id=db_inquiry.inquiry_id,
        name=inquiry.name,
        organization=inquiry.organization,
        role=inquiry.role,
        email=inquiry.email,
        message=inquiry.message,
    )

    return InstitutionInquiryOut(
        success=True,
        message="Thank you for your inquiry. We will respond within 2-3 business days.",
        inquiry_id=db_inquiry.inquiry_id,
    )
