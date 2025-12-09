"""
Work Events router - CRUD operations for daily work records.
Part of the Privacy Architecture Redesign (Module 2).
"""
from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User, WorkEvent
from ..schemas import WorkEventIn, WorkEventOut, WorkEventUpdate

router = APIRouter(prefix="/work-events", tags=["work-events"])


def _get_db_session():
    yield from get_db()


@router.post("", response_model=WorkEventOut, status_code=status.HTTP_201_CREATED)
def create_work_event(
    payload: WorkEventIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(_get_db_session),
) -> WorkEventOut:
    """
    Create a new work event for the authenticated user.

    Requirements:
    - Valid JWT token (user must be authenticated)
    - One work event per user per day (enforced by unique constraint)

    Validation:
    - planned_hours and actual_hours must be >= 0 and <= 24
    - source must be 'geofence', 'manual', or 'mixed'
    """
    # Check if work event already exists for this user + date
    existing = (
        db.query(WorkEvent)
        .filter(WorkEvent.user_id == current_user.user_id)
        .filter(WorkEvent.date == payload.date)
        .one_or_none()
    )

    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Work event for date {payload.date} already exists. Use PATCH to update.",
        )

    # Create new work event
    work_event = WorkEvent(
        user_id=current_user.user_id,
        date=payload.date,
        planned_hours=payload.planned_hours,
        actual_hours=payload.actual_hours,
        source=payload.source,
    )

    db.add(work_event)
    db.commit()
    db.refresh(work_event)

    return WorkEventOut.from_orm(work_event)


@router.get("", response_model=list[WorkEventOut])
def list_work_events(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(_get_db_session),
    start_date: date | None = Query(default=None, description="Filter by start date (inclusive)"),
    end_date: date | None = Query(default=None, description="Filter by end date (inclusive)"),
    limit: int = Query(default=100, ge=1, le=1000, description="Maximum number of results"),
) -> list[WorkEventOut]:
    """
    List work events for the authenticated user.

    Optional filters:
    - start_date: Only return events on or after this date
    - end_date: Only return events on or before this date
    - limit: Maximum number of results (default 100, max 1000)

    Returns events ordered by date (descending, most recent first).
    """
    query = db.query(WorkEvent).filter(WorkEvent.user_id == current_user.user_id)

    if start_date is not None:
        query = query.filter(WorkEvent.date >= start_date)

    if end_date is not None:
        query = query.filter(WorkEvent.date <= end_date)

    # Order by date descending (most recent first)
    query = query.order_by(WorkEvent.date.desc())

    # Apply limit
    query = query.limit(limit)

    work_events = query.all()

    return [WorkEventOut.from_orm(event) for event in work_events]


@router.patch("/{event_id}", response_model=WorkEventOut)
def update_work_event(
    event_id: UUID,
    payload: WorkEventUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(_get_db_session),
) -> WorkEventOut:
    """
    Update an existing work event (partial update).

    Requirements:
    - Valid JWT token (user must be authenticated)
    - Work event must belong to the authenticated user
    - At least one field must be provided

    Only provided fields will be updated (null/missing fields are ignored).
    """
    # Find the work event
    work_event = (
        db.query(WorkEvent)
        .filter(WorkEvent.event_id == event_id)
        .one_or_none()
    )

    if work_event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work event not found",
        )

    # Check ownership
    if work_event.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to update this work event",
        )

    # Check if at least one field is provided
    update_data = payload.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No fields to update. Provide at least one field.",
        )

    # Update fields
    for field, value in update_data.items():
        setattr(work_event, field, value)

    db.commit()
    db.refresh(work_event)

    return WorkEventOut.from_orm(work_event)


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_work_event(
    event_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(_get_db_session),
) -> None:
    """
    Delete a work event.

    Requirements:
    - Valid JWT token (user must be authenticated)
    - Work event must belong to the authenticated user

    This is a hard delete (not soft delete).
    Use with caution - deleted events cannot be recovered.
    """
    # Find the work event
    work_event = (
        db.query(WorkEvent)
        .filter(WorkEvent.event_id == event_id)
        .one_or_none()
    )

    if work_event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Work event not found",
        )

    # Check ownership
    if work_event.user_id != current_user.user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this work event",
        )

    db.delete(work_event)
    db.commit()

    return None
