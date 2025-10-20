from __future__ import annotations

from collections.abc import Generator
from decimal import Decimal

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Report
from ..pii import scrub_text
from ..schemas import ReportIn, ReportOut
from ..dependencies import require_affiliation_token

router = APIRouter(prefix="/reports", tags=["reports"])


def _get_db_session() -> Generator[Session, None, None]:
    yield from get_db()


@router.post("/", response_model=ReportOut, status_code=status.HTTP_201_CREATED)
def submit_report(
    payload: ReportIn,
    hospital_domain: str = Depends(require_affiliation_token),
    db: Session = Depends(_get_db_session),
) -> ReportOut:
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
