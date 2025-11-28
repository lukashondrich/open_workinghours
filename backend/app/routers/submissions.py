from __future__ import annotations

from collections.abc import Generator
from decimal import Decimal

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import WeeklySubmission
from ..schemas import WeeklySubmissionIn, WeeklySubmissionListItem, WeeklySubmissionOut

router = APIRouter(prefix="/submissions", tags=["submissions"])


def _get_db_session() -> Generator[Session, None, None]:
    yield from get_db()


@router.post(
    "/weekly",
    response_model=WeeklySubmissionOut,
    status_code=status.HTTP_201_CREATED,
)
def submit_weekly(payload: WeeklySubmissionIn, db: Session = Depends(_get_db_session)) -> WeeklySubmissionOut:
    record = WeeklySubmission(
        week_start=payload.week_start,
        week_end=payload.week_end,
        planned_hours=Decimal(str(payload.planned_hours)),
        actual_hours=Decimal(str(payload.actual_hours)),
        client_version=payload.client_version,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return WeeklySubmissionOut(id=record.id, received_at=record.created_at)


@router.get("/weekly", response_model=list[WeeklySubmissionListItem])
def list_weekly_submissions(limit: int = 10, db: Session = Depends(_get_db_session)) -> list[WeeklySubmissionListItem]:
    limit = max(1, min(limit, 100))
    rows = (
        db.query(WeeklySubmission)
        .order_by(WeeklySubmission.created_at.desc())
        .limit(limit)
        .all()
    )
    return [WeeklySubmissionListItem.model_validate(row) for row in rows]
