"""Data retention cleanup helpers."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import FeedbackReport


FEEDBACK_REPORT_RETENTION_DAYS = 90


def purge_old_feedback_reports(
    db: Session,
    *,
    now: datetime | None = None,
    retention_days: int = FEEDBACK_REPORT_RETENTION_DAYS,
) -> int:
    """Delete feedback reports older than the configured retention window."""
    reference_time = now or datetime.now(timezone.utc)
    cutoff = reference_time - timedelta(days=retention_days)
    deleted_count = (
        db.query(FeedbackReport)
        .filter(FeedbackReport.created_at < cutoff)
        .delete(synchronize_session=False)
    )
    db.commit()
    return int(deleted_count)


def purge_old_feedback_reports_once() -> int:
    """Run feedback report retention cleanup using a short-lived DB session."""
    db = SessionLocal()
    try:
        return purge_old_feedback_reports(db)
    finally:
        db.close()
