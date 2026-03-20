from __future__ import annotations

from datetime import date, timedelta


def get_iso_week_bounds(target_date: date) -> tuple[date, date]:
    iso_year, iso_week, _ = target_date.isocalendar()
    week_start = date.fromisocalendar(iso_year, iso_week, 1)
    week_end = week_start + timedelta(days=6)
    return week_start, week_end
