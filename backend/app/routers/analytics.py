from __future__ import annotations

import math
import random
from datetime import date
from collections.abc import Generator

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Report, StaffGroup
from ..schemas import (
    AnalyticsResponse,
    HospitalMonthlySummary,
    StaffGroupMonthlySummary,
)

router = APIRouter(prefix="/analytics", tags=["analytics"], deprecated=True)

SUPPRESSION_THRESHOLD = 5
BOOTSTRAP_ITERATIONS = 200
NOISE_SCALE = 0.05  # hours


def _get_db_session() -> Generator[Session, None, None]:
    yield from get_db()


@router.get("/", response_model=AnalyticsResponse, deprecated=True)
def analytics_overview(
    months: int = Query(default=6, ge=1, le=36),
    staff_group: StaffGroup | None = Query(default=None),
    db: Session = Depends(_get_db_session),
    response: Response = None,
) -> AnalyticsResponse:
    """
    Get analytics overview (DEPRECATED).

    **DEPRECATED:** This endpoint queries the old Report table and will be removed in a future release.
    Please migrate to GET /stats/by-state-specialty which uses the new privacy-preserving architecture.

    Migration guide:
    - Old: GET /analytics/?months=6
    - New: GET /stats/by-state-specialty?limit=100
    """
    if response:
        response.headers["Deprecation"] = "true"
        response.headers["Sunset"] = "2026-03-01"
        response.headers["Link"] = '</stats/by-state-specialty>; rel="alternate"'

    hospital_rows = _fetch_hospital_monthly(db=db, months=months, staff_group=staff_group)
    staff_group_rows = _fetch_staff_group_monthly(db=db, months=months, staff_group=staff_group)
    return AnalyticsResponse(
        hospital_monthly=hospital_rows,
        staff_group_monthly=staff_group_rows,
    )


def _fetch_hospital_monthly(
    *,
    db: Session,
    months: int,
    staff_group: StaffGroup | None,
) -> list[HospitalMonthlySummary]:
    month_trunc = func.date_trunc("month", Report.shift_date).label("month_start")
    cutoff_date = _months_back_start(months)

    query = (
        select(
            Report.hospital_domain.label("hospital_domain"),
            Report.staff_group.label("staff_group"),
            month_trunc,
            func.count(Report.id).label("report_count"),
            func.sum(Report.actual_hours_worked).label("total_actual_hours"),
            func.sum(Report.overtime_hours).label("total_overtime_hours"),
            func.array_agg(Report.actual_hours_worked).label("actual_samples"),
            func.array_agg(Report.overtime_hours).label("overtime_samples"),
        )
        .where(Report.shift_date >= cutoff_date)
        .group_by(Report.hospital_domain, Report.staff_group, month_trunc)
        .order_by(month_trunc.desc(), Report.hospital_domain.asc(), Report.staff_group.asc())
    )
    if staff_group is not None:
        query = query.where(Report.staff_group == staff_group.value)

    results: list[HospitalMonthlySummary] = []
    for row in db.execute(query):
        month_start_dt = row.month_start.date() if hasattr(row.month_start, "date") else date.fromisoformat(row.month_start)
        suppressed = row.report_count < SUPPRESSION_THRESHOLD
        total_actual = float(row.total_actual_hours or 0)
        total_overtime = float(row.total_overtime_hours or 0)
        actual_samples = _to_float_list(row.actual_samples)
        overtime_samples = _to_float_list(row.overtime_samples)
        metrics = _compute_metrics(actual_samples, overtime_samples, row.report_count, suppressed)
        results.append(
            HospitalMonthlySummary(
                hospital_domain=row.hospital_domain,
                staff_group=StaffGroup(row.staff_group),
                month_start=month_start_dt,
                report_count=row.report_count,
                average_actual_hours=None if suppressed else metrics["avg_actual"],
                average_overtime_hours=None if suppressed else metrics["avg_overtime"],
                total_actual_hours=None if suppressed else _safe_float(total_actual),
                total_overtime_hours=None if suppressed else _safe_float(total_overtime),
                ci_actual_low=None if suppressed else metrics["ci_actual_low"],
                ci_actual_high=None if suppressed else metrics["ci_actual_high"],
                ci_overtime_low=None if suppressed else metrics["ci_overtime_low"],
                ci_overtime_high=None if suppressed else metrics["ci_overtime_high"],
                suppressed=suppressed,
            )
        )
    return results


def _fetch_staff_group_monthly(
    *,
    db: Session,
    months: int,
    staff_group: StaffGroup | None,
) -> list[StaffGroupMonthlySummary]:
    month_trunc = func.date_trunc("month", Report.shift_date).label("month_start")
    cutoff_date = _months_back_start(months)

    query = (
        select(
            Report.staff_group.label("staff_group"),
            month_trunc,
            func.count(Report.id).label("report_count"),
            func.sum(Report.actual_hours_worked).label("total_actual_hours"),
            func.sum(Report.overtime_hours).label("total_overtime_hours"),
            func.array_agg(Report.actual_hours_worked).label("actual_samples"),
            func.array_agg(Report.overtime_hours).label("overtime_samples"),
        )
        .where(Report.shift_date >= cutoff_date)
        .group_by(Report.staff_group, month_trunc)
        .order_by(month_trunc.desc(), Report.staff_group.asc())
    )
    if staff_group is not None:
        query = query.where(Report.staff_group == staff_group.value)

    results: list[StaffGroupMonthlySummary] = []
    for row in db.execute(query):
        month_start_dt = row.month_start.date() if hasattr(row.month_start, "date") else date.fromisoformat(row.month_start)
        suppressed = row.report_count < SUPPRESSION_THRESHOLD
        total_actual = float(row.total_actual_hours or 0)
        total_overtime = float(row.total_overtime_hours or 0)
        actual_samples = _to_float_list(row.actual_samples)
        overtime_samples = _to_float_list(row.overtime_samples)
        metrics = _compute_metrics(actual_samples, overtime_samples, row.report_count, suppressed)
        results.append(
            StaffGroupMonthlySummary(
                staff_group=StaffGroup(row.staff_group),
                month_start=month_start_dt,
                report_count=row.report_count,
                average_actual_hours=None if suppressed else metrics["avg_actual"],
                average_overtime_hours=None if suppressed else metrics["avg_overtime"],
                total_actual_hours=None if suppressed else _safe_float(total_actual),
                total_overtime_hours=None if suppressed else _safe_float(total_overtime),
                ci_actual_low=None if suppressed else metrics["ci_actual_low"],
                ci_actual_high=None if suppressed else metrics["ci_actual_high"],
                ci_overtime_low=None if suppressed else metrics["ci_overtime_low"],
                ci_overtime_high=None if suppressed else metrics["ci_overtime_high"],
                suppressed=suppressed,
            )
        )
    return results


def _compute_metrics(
    actual_samples: list[float],
    overtime_samples: list[float],
    count: int,
    suppressed: bool,
) -> dict[str, float | None]:
    if suppressed or count == 0:
        return {
            "avg_actual": None,
            "avg_overtime": None,
            "ci_actual_low": None,
            "ci_actual_high": None,
            "ci_overtime_low": None,
            "ci_overtime_high": None,
        }

    avg_actual = _safe_float(sum(actual_samples) / count)
    avg_overtime = _safe_float(sum(overtime_samples) / count)

    ci_actual_low, ci_actual_high = _bootstrap_ci(actual_samples)
    ci_overtime_low, ci_overtime_high = _bootstrap_ci(overtime_samples)

    ci_actual_low = _apply_dp(ci_actual_low)
    ci_actual_high = _apply_dp(ci_actual_high)
    ci_overtime_low = _apply_dp(ci_overtime_low)
    ci_overtime_high = _apply_dp(ci_overtime_high)

    if ci_actual_low is not None and ci_actual_high is not None and ci_actual_low > ci_actual_high:
        ci_actual_low, ci_actual_high = ci_actual_high, ci_actual_low
    if ci_overtime_low is not None and ci_overtime_high is not None and ci_overtime_low > ci_overtime_high:
        ci_overtime_low, ci_overtime_high = ci_overtime_high, ci_overtime_low

    return {
        "avg_actual": avg_actual,
        "avg_overtime": avg_overtime,
        "ci_actual_low": _safe_float(ci_actual_low) if ci_actual_low is not None else None,
        "ci_actual_high": _safe_float(ci_actual_high) if ci_actual_high is not None else None,
        "ci_overtime_low": _safe_float(ci_overtime_low) if ci_overtime_low is not None else None,
        "ci_overtime_high": _safe_float(ci_overtime_high) if ci_overtime_high is not None else None,
    }


def _safe_float(value: float | None) -> float | None:
    if value is None:
        return None
    return float(round(value, 2))


def _to_float_list(values: list | None) -> list[float]:
    if not values:
        return []
    return [float(v) for v in values]


def _bootstrap_ci(samples: list[float], iterations: int = BOOTSTRAP_ITERATIONS, alpha: float = 0.05) -> tuple[float | None, float | None]:
    if not samples:
        return (None, None)
    if len(samples) == 1:
        value = samples[0]
        return (value, value)
    means: list[float] = []
    for _ in range(iterations):
        resample = [random.choice(samples) for _ in range(len(samples))]
        means.append(sum(resample) / len(resample))
    means.sort()
    lower_index = max(int((alpha / 2) * iterations) - 1, 0)
    upper_index = min(int((1 - alpha / 2) * iterations), iterations - 1)
    return (means[lower_index], means[upper_index])


def _apply_dp(value: float | None, scale: float = NOISE_SCALE) -> float | None:
    if value is None:
        return None
    return value + _laplace_noise(scale)


def _laplace_noise(scale: float) -> float:
    u = random.random() - 0.5
    return -scale * math.copysign(1.0, u) * math.log(1 - 2 * abs(u))


def _months_back_start(months: int) -> date:
    today = date.today()
    year = today.year
    month = today.month - (months - 1)
    while month <= 0:
        month += 12
        year -= 1
    return date(year, month, 1)
