"""
Statistics API - Privacy-preserving analytics endpoints.

Reads from pre-computed, k-anonymous, differentially private statistics.
Part of the Privacy Architecture Redesign (Module 2).
"""
from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..dp_group_stats.policy import PublicationStatus
from ..models import StatsByStateSpecialty
from ..schemas import StatsByStateSpecialtyOut

router = APIRouter(prefix="/stats", tags=["stats"])


def _get_db_session():
    yield from get_db()


def _public_status(stat: StatsByStateSpecialty) -> PublicationStatus:
    if stat.n_users < stat.k_min_threshold:
        return PublicationStatus.suppressed

    raw_status = getattr(stat, "publication_status", None)
    try:
        internal_status = PublicationStatus(raw_status)
    except (TypeError, ValueError):
        internal_status = PublicationStatus.published

    if internal_status == PublicationStatus.published:
        return PublicationStatus.published
    return PublicationStatus.suppressed


def _to_public_stat(stat: StatsByStateSpecialty) -> StatsByStateSpecialtyOut:
    status = _public_status(stat)
    return StatsByStateSpecialtyOut(
        stat_id=stat.stat_id,
        country_code=stat.country_code,
        state_code=stat.state_code,
        specialty=stat.specialty,
        period_start=stat.period_start,
        period_end=stat.period_end,
        planned_mean_hours=None if status != PublicationStatus.published else _safe_float(stat.avg_planned_hours_noised),
        overtime_mean_hours=None if status != PublicationStatus.published else _safe_float(stat.avg_overtime_hours_noised),
        status=status.value,
        computed_at=stat.computed_at,
    )


def _safe_float(value) -> float | None:
    return None if value is None else float(value)


@router.get("/by-state-specialty", response_model=list[StatsByStateSpecialtyOut])
def get_stats_by_state_specialty(
    db: Session = Depends(_get_db_session),
    country_code: str | None = Query(default=None, description="Filter by country (e.g., 'DEU')"),
    state_code: str | None = Query(default=None, description="Filter by state (e.g., 'BY', 'BE')"),
    specialty: str | None = Query(default=None, description="Filter by specialty"),
    period_start: date | None = Query(default=None, description="Filter by period start (ISO week Monday)"),
    limit: int = Query(default=100, ge=1, le=1000, description="Maximum results"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
) -> list[StatsByStateSpecialtyOut]:
    """
    Get aggregated statistics by state × specialty × period.

    Public output is intentionally narrow:
    - `planned_mean_hours`
    - `overtime_mean_hours`
    - generic `status` (`published` or `suppressed`)
    """
    query = db.query(StatsByStateSpecialty)

    # Apply filters
    if country_code:
        query = query.filter(StatsByStateSpecialty.country_code == country_code)
    if state_code:
        query = query.filter(StatsByStateSpecialty.state_code == state_code)
    if specialty:
        query = query.filter(StatsByStateSpecialty.specialty == specialty)
    if period_start:
        query = query.filter(StatsByStateSpecialty.period_start == period_start)

    # Order by most recent first
    query = query.order_by(StatsByStateSpecialty.period_start.desc())

    # Apply pagination
    query = query.limit(limit).offset(offset)

    stats = query.all()

    return [_to_public_stat(stat) for stat in stats]


@router.get("/by-state-specialty/latest", response_model=list[StatsByStateSpecialtyOut])
def get_latest_stats_by_state_specialty(
    db: Session = Depends(_get_db_session),
    country_code: str = Query(default="DEU", description="Country code"),
    limit: int = Query(default=50, ge=1, le=100, description="Maximum results"),
) -> list[StatsByStateSpecialtyOut]:
    """
    Get the most recent statistics for each state/specialty combination.

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
        )
        .limit(limit)
        .all()
    )

    return [_to_public_stat(stat) for stat in stats]


@router.get("/summary")
def get_stats_summary(
    db: Session = Depends(_get_db_session),
    country_code: str = Query(default="DEU", description="Country code"),
) -> dict:
    """
    Get summary statistics about available data.

    Returns metadata about the public state x specialty statistics dataset.
    """
    query = db.query(StatsByStateSpecialty).filter(
        StatsByStateSpecialty.country_code == country_code
    )

    total_records = query.count()

    if total_records == 0:
        return {
            "total_records": 0,
            "published_records": 0,
            "suppressed_records": 0,
            "earliest_period": None,
            "latest_period": None,
            "states": [],
            "specialties": [],
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

    published_records = query.filter(
        StatsByStateSpecialty.publication_status == PublicationStatus.published.value,
        StatsByStateSpecialty.n_users >= StatsByStateSpecialty.k_min_threshold,
    ).count()
    suppressed_records = total_records - published_records

    return {
        "total_records": total_records,
        "published_records": published_records,
        "suppressed_records": suppressed_records,
        "earliest_period": earliest.period_start if earliest else None,
        "latest_period": latest.period_start if latest else None,
        "states": sorted(states),
        "specialties": sorted(specialties),
    }
