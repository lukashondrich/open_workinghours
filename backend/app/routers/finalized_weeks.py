"""
Finalized user-week router.

Creates the server-side protected weekly unit used by downstream DP aggregation.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..dependencies import get_current_user, get_db_session
from ..models import FinalizedUserWeek, User, WorkEvent
from ..periods import get_iso_week_bounds
from ..schemas import FinalizedUserWeekIn, FinalizedUserWeekOut

router = APIRouter(prefix="/finalized-weeks", tags=["finalized-weeks"])


@router.post("", response_model=FinalizedUserWeekOut, status_code=status.HTTP_201_CREATED)
def finalize_user_week(
    payload: FinalizedUserWeekIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
) -> FinalizedUserWeekOut:
    """
    Materialize one finalized user-week from the user's immutable daily work events.

    Requirements:
    - authenticated user
    - requested week is fully in the past
    - all 7 days in the week are already confirmed
    - week has not already been finalized
    """
    week_start = payload.week_start
    week_end = get_iso_week_bounds(week_start)[1]

    if week_end > datetime.now().date():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only weeks ending today or earlier can be finalized.",
        )

    existing = (
        db.query(FinalizedUserWeek)
        .filter(
            FinalizedUserWeek.user_id == current_user.user_id,
            FinalizedUserWeek.week_start == week_start,
        )
        .one_or_none()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Week starting {week_start} has already been finalized.",
        )

    if payload.planned_hours is not None and payload.actual_hours is not None:
        # New mode: client-provided weekly totals (no work_events needed)
        planned_hours = Decimal(str(payload.planned_hours))
        actual_hours = Decimal(str(payload.actual_hours))
    else:
        # Legacy mode: sum from work_events (backward compat for old app versions)
        events = (
            db.query(WorkEvent)
            .filter(
                WorkEvent.user_id == current_user.user_id,
                WorkEvent.date >= week_start,
                WorkEvent.date <= week_end,
            )
            .order_by(WorkEvent.date.asc())
            .all()
        )

        if len(events) != 7:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All 7 days in the week must be confirmed before finalization.",
            )

        planned_hours = sum((event.planned_hours for event in events), Decimal("0"))
        actual_hours = sum((event.actual_hours for event in events), Decimal("0"))

    finalized_week = FinalizedUserWeek(
        user_id=current_user.user_id,
        week_start=week_start,
        week_end=week_end,
        planned_hours=planned_hours,
        actual_hours=actual_hours,
        hospital_id=current_user.hospital_id,
        specialty=current_user.specialty,
        role_level=current_user.role_level,
        state_code=current_user.state_code,
        country_code=current_user.country_code,
        # v2 taxonomy snapshot
        profession=current_user.profession,
        seniority=current_user.seniority,
        department_group=current_user.department_group,
        specialization_code=current_user.specialization_code,
        hospital_ref_id=current_user.hospital_ref_id,
    )

    db.add(finalized_week)
    db.commit()
    db.refresh(finalized_week)

    return FinalizedUserWeekOut.from_orm(finalized_week)


@router.get("", response_model=list[FinalizedUserWeekOut])
def list_finalized_user_weeks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db_session),
    start_date: date | None = Query(default=None, description="Filter by week_start (inclusive)"),
    limit: int = Query(default=52, ge=1, le=260),
) -> list[FinalizedUserWeekOut]:
    query = db.query(FinalizedUserWeek).filter(FinalizedUserWeek.user_id == current_user.user_id)

    if start_date is not None:
        query = query.filter(FinalizedUserWeek.week_start >= start_date)

    rows = (
        query.order_by(FinalizedUserWeek.week_start.desc())
        .limit(limit)
        .all()
    )

    return [FinalizedUserWeekOut.from_orm(row) for row in rows]
