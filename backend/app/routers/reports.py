from __future__ import annotations

from collections.abc import Generator
from decimal import Decimal

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Report
from ..pii import scrub_text
from ..schemas import ReportIn, ReportOut
from ..dependencies import require_affiliation_token

router = APIRouter(prefix="/reports", tags=["reports"], deprecated=True)


def _get_db_session() -> Generator[Session, None, None]:
    yield from get_db()


@router.post("/", response_model=ReportOut, status_code=status.HTTP_201_CREATED, deprecated=True)
def submit_report(
    payload: ReportIn,
    hospital_domain: str = Depends(require_affiliation_token),
    db: Session = Depends(_get_db_session),
    response: Response = None,
) -> ReportOut:
    """
    Submit daily report (DEPRECATED).

    **DEPRECATED:** This endpoint uses affiliation tokens and stores in the Report table.
    It will be removed in v2.0.0.
    Please migrate to POST /work-events which uses JWT authentication.

    Migration guide:
    - Old: POST /reports/ (affiliation token, Report table)
    - New: POST /work-events (JWT token, WorkEvent table)

    Breaking changes in v2.0.0:
    - Requires user registration and JWT authentication
    - Different payload schema (date, planned_hours, actual_hours, source)
    - Server-side privacy-preserving aggregation
    """
    if response:
        response.headers["Deprecation"] = "true"
        response.headers["Sunset"] = "2026-03-01"
        response.headers["Link"] = '</work-events>; rel="alternate"'

    report = Report(
        hospital_domain=hospital_domain,
        staff_group=payload.staff_group.value,
        shift_date=payload.shift_date,
        actual_hours_worked=Decimal(str(payload.actual_hours_worked)),
        overtime_hours=Decimal(str(payload.overtime_hours)),
        notes=scrub_text(payload.notes),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return ReportOut.model_validate(report)
