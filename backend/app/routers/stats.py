"""
Statistics API - Privacy-preserving analytics endpoints.

Reads from pre-computed, k-anonymous, differentially private statistics.
Part of the Privacy Architecture Redesign (Module 2).
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import StatsByStateSpecialty
from ..schemas import StatsByStateSpecialtyOut

router = APIRouter(prefix="/stats", tags=["stats"])


def _get_db_session():
    yield from get_db()


@router.get("/by-state-specialty", response_model=list[StatsByStateSpecialtyOut])
def get_stats_by_state_specialty(
    db: Session = Depends(_get_db_session),
    country_code: str | None = Query(default=None, description="Filter by country (e.g., 'DEU')"),
    state_code: str | None = Query(default=None, description="Filter by state (e.g., 'BY', 'BE')"),
    specialty: str | None = Query(default=None, description="Filter by specialty"),
    role_level: str | None = Query(default=None, description="Filter by role level"),
    period_start: date | None = Query(default=None, description="Filter by period start (ISO week Monday)"),
    limit: int = Query(default=100, ge=1, le=1000, description="Maximum results"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
) -> list[StatsByStateSpecialtyOut]:
    """
    Get aggregated statistics by state × specialty × role × period.

    Returns privacy-preserving statistics:
    - K-anonymous: Only groups with n_users >= K_MIN are included
    - Differentially private: Laplace noise added to averages
    - GDPR-compliant: Cannot be linked back to individuals

    All returned statistics have already been privacy-processed.
    The `n_users` count indicates the size of the anonymity set.
    """
    query = db.query(StatsByStateSpecialty)

    # Apply filters
    if country_code:
        query = query.filter(StatsByStateSpecialty.country_code == country_code)
    if state_code:
        query = query.filter(StatsByStateSpecialty.state_code == state_code)
    if specialty:
        query = query.filter(StatsByStateSpecialty.specialty == specialty)
    if role_level:
        query = query.filter(StatsByStateSpecialty.role_level == role_level)
    if period_start:
        query = query.filter(StatsByStateSpecialty.period_start == period_start)

    # Order by most recent first
    query = query.order_by(StatsByStateSpecialty.period_start.desc())

    # Apply pagination
    query = query.limit(limit).offset(offset)

    stats = query.all()

    return [StatsByStateSpecialtyOut.from_orm(stat) for stat in stats]


@router.get("/by-state-specialty/latest", response_model=list[StatsByStateSpecialtyOut])
def get_latest_stats_by_state_specialty(
    db: Session = Depends(_get_db_session),
    country_code: str = Query(default="DEU", description="Country code"),
    limit: int = Query(default=50, ge=1, le=100, description="Maximum results"),
) -> list[StatsByStateSpecialtyOut]:
    """
    Get the most recent statistics for each state/specialty/role combination.

    Returns only the latest week's data for quick overview.
    Useful for dashboards and summary views.
    """
    # Get the most recent period_start date
    latest_period = (
        db.query(StatsByStateSpecialty.period_start)
        .filter(StatsByStateSpecialty.country_code == country_code)
        .order_by(StatsByStateSpecialty.period_start.desc())
        .first()
    )

    if not latest_period:
        return []

    # Get all stats for that period
    stats = (
        db.query(StatsByStateSpecialty)
        .filter(
            StatsByStateSpecialty.country_code == country_code,
            StatsByStateSpecialty.period_start == latest_period[0],
        )
        .order_by(
            StatsByStateSpecialty.state_code,
            StatsByStateSpecialty.specialty,
            StatsByStateSpecialty.role_level,
        )
        .limit(limit)
        .all()
    )

    return [StatsByStateSpecialtyOut.from_orm(stat) for stat in stats]


@router.get("/summary")
def get_stats_summary(
    db: Session = Depends(_get_db_session),
    country_code: str = Query(default="DEU", description="Country code"),
) -> dict:
    """
    Get summary statistics about available data.

    Returns metadata about the statistics dataset:
    - Total number of published groups
    - Date range of available data
    - Number of unique states, specialties, roles
    - Total users in anonymity sets
    """
    query = db.query(StatsByStateSpecialty).filter(
        StatsByStateSpecialty.country_code == country_code
    )

    total_records = query.count()

    if total_records == 0:
        return {
            "total_records": 0,
            "earliest_period": None,
            "latest_period": None,
            "states": [],
            "specialties": [],
            "roles": [],
            "total_users_in_sets": 0,
        }

    # Get date range
    earliest = query.order_by(StatsByStateSpecialty.period_start.asc()).first()
    latest = query.order_by(StatsByStateSpecialty.period_start.desc()).first()

    # Get unique values
    states = [
        row[0]
        for row in db.query(StatsByStateSpecialty.state_code)
        .filter(StatsByStateSpecialty.country_code == country_code)
        .distinct()
        .all()
    ]

    specialties = [
        row[0]
        for row in db.query(StatsByStateSpecialty.specialty)
        .filter(StatsByStateSpecialty.country_code == country_code)
        .distinct()
        .all()
    ]

    roles = [
        row[0]
        for row in db.query(StatsByStateSpecialty.role_level)
        .filter(StatsByStateSpecialty.country_code == country_code)
        .distinct()
        .all()
    ]

    # Sum n_users (note: may count same user multiple times across weeks)
    from sqlalchemy import func
    total_user_count = (
        db.query(func.sum(StatsByStateSpecialty.n_users))
        .filter(StatsByStateSpecialty.country_code == country_code)
        .scalar()
    ) or 0

    return {
        "total_records": total_records,
        "earliest_period": earliest.period_start if earliest else None,
        "latest_period": latest.period_start if latest else None,
        "states": sorted(states),
        "specialties": sorted(specialties),
        "roles": sorted(roles),
        "total_users_in_sets": int(total_user_count),
    }
