from __future__ import annotations

from collections.abc import Generator
from decimal import Decimal

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import WeeklySubmission
from ..schemas import WeeklySubmissionIn, WeeklySubmissionListItem, WeeklySubmissionOut

router = APIRouter(prefix="/submissions", tags=["submissions"], deprecated=True)


def _get_db_session() -> Generator[Session, None, None]:
    yield from get_db()


@router.post(
    "/weekly",
    response_model=WeeklySubmissionOut,
    status_code=status.HTTP_201_CREATED,
    deprecated=True,
)
def submit_weekly(
    payload: WeeklySubmissionIn,
    db: Session = Depends(_get_db_session),
    response: Response = None,
) -> WeeklySubmissionOut:
    """
    Submit weekly hours (DEPRECATED).

    **DEPRECATED:** This endpoint stores anonymous weekly submissions and will be removed in v2.0.0.
    Please migrate to POST /work-events which uses authenticated daily submissions with server-side aggregation.

    Migration guide:
    - Old: POST /submissions/weekly (anonymous, client-side noise)
    - New: POST /work-events (authenticated, no noise, privacy-preserving aggregation on server)

    Breaking changes in v2.0.0:
    - Requires user authentication (JWT token)
    - Submit daily events instead of weekly totals
    - No client-side noise required
    """
    if response:
        response.headers["Deprecation"] = "true"
        response.headers["Sunset"] = "2026-03-01"
        response.headers["Link"] = '</work-events>; rel="alternate"'

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


@router.get("/weekly", response_model=list[WeeklySubmissionListItem], deprecated=True)
def list_weekly_submissions(
    limit: int = 10,
    db: Session = Depends(_get_db_session),
    response: Response = None,
) -> list[WeeklySubmissionListItem]:
    """
    List weekly submissions (DEPRECATED).

    **DEPRECATED:** This endpoint will be removed in v2.0.0.
    Use GET /work-events to retrieve authenticated daily work events instead.
    """
    if response:
        response.headers["Deprecation"] = "true"
        response.headers["Sunset"] = "2026-03-01"
        response.headers["Link"] = '</work-events>; rel="alternate"'

    limit = max(1, min(limit, 100))
    rows = (
        db.query(WeeklySubmission)
        .order_by(WeeklySubmission.created_at.desc())
        .limit(limit)
        .all()
    )
    return [WeeklySubmissionListItem.model_validate(row) for row in rows]
