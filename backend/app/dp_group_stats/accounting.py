from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import StateSpecialtyPrivacyLedger, UserPrivacyLedger
from .policy import PublicationStatus


CellKey = tuple[str, ...]


@dataclass(frozen=True, slots=True)
class BudgetEntry:
    cell_key: CellKey
    period_start: date
    epsilon: float


@dataclass(frozen=True, slots=True)
class EpsilonBreakdown:
    planned_sum: float
    actual_sum: float

    def __post_init__(self) -> None:
        if self.planned_sum < 0 or self.actual_sum < 0:
            raise ValueError("epsilon components must be non-negative")

    @property
    def total(self) -> float:
        return self.planned_sum + self.actual_sum


class EpsilonLedger:
    def __init__(self) -> None:
        self._entries: list[BudgetEntry] = []
        self._totals_by_cell: dict[CellKey, float] = defaultdict(float)

    def record(self, *, cell_key: CellKey, period_start: date, epsilon: float) -> BudgetEntry:
        if epsilon < 0:
            raise ValueError("epsilon must be non-negative")

        entry = BudgetEntry(cell_key=cell_key, period_start=period_start, epsilon=epsilon)
        self._entries.append(entry)
        self._totals_by_cell[cell_key] += epsilon
        return entry

    def spent(self, cell_key: CellKey) -> float:
        return self._totals_by_cell.get(cell_key, 0.0)

    def entries_for_cell(self, cell_key: CellKey) -> list[BudgetEntry]:
        return [entry for entry in self._entries if entry.cell_key == cell_key]

    def all_entries(self) -> list[BudgetEntry]:
        return list(self._entries)


def _to_decimal(value: float) -> Decimal:
    return Decimal(str(round(value, 3)))


def record_state_specialty_ledger_entry(
    db: Session,
    *,
    cell_key: tuple[str, str, str],
    period_start: date,
    breakdown: EpsilonBreakdown,
    mechanism: str = "laplace",
    publication_status: str = PublicationStatus.published.value,
) -> StateSpecialtyPrivacyLedger:
    existing = (
        db.query(StateSpecialtyPrivacyLedger)
        .filter(
            StateSpecialtyPrivacyLedger.country_code == cell_key[0],
            StateSpecialtyPrivacyLedger.state_code == cell_key[1],
            StateSpecialtyPrivacyLedger.specialty == cell_key[2],
            StateSpecialtyPrivacyLedger.period_start == period_start,
        )
        .one_or_none()
    )

    if existing is None:
        existing = StateSpecialtyPrivacyLedger(
            country_code=cell_key[0],
            state_code=cell_key[1],
            specialty=cell_key[2],
            period_start=period_start,
        )
        db.add(existing)

    existing.mechanism = mechanism
    existing.publication_status = publication_status
    existing.planned_sum_epsilon = _to_decimal(breakdown.planned_sum)
    existing.actual_sum_epsilon = _to_decimal(breakdown.actual_sum)
    existing.total_epsilon = _to_decimal(breakdown.total)
    return existing


def state_specialty_entries_for_cell(
    db: Session,
    *,
    cell_key: tuple[str, str, str],
) -> list[StateSpecialtyPrivacyLedger]:
    return (
        db.query(StateSpecialtyPrivacyLedger)
        .filter(
            StateSpecialtyPrivacyLedger.country_code == cell_key[0],
            StateSpecialtyPrivacyLedger.state_code == cell_key[1],
            StateSpecialtyPrivacyLedger.specialty == cell_key[2],
        )
        .order_by(StateSpecialtyPrivacyLedger.period_start.asc())
        .all()
    )


def state_specialty_spent(
    db: Session,
    *,
    cell_key: tuple[str, str, str],
) -> float:
    spent = (
        db.query(func.sum(StateSpecialtyPrivacyLedger.total_epsilon))
        .filter(
            StateSpecialtyPrivacyLedger.country_code == cell_key[0],
            StateSpecialtyPrivacyLedger.state_code == cell_key[1],
            StateSpecialtyPrivacyLedger.specialty == cell_key[2],
        )
        .scalar()
    )
    return float(spent or 0.0)


def record_user_ledger_entries(
    db: Session,
    *,
    cell_key: tuple[str, str, str],
    period_start: date,
    user_ids: list,
    epsilon_per_user: float,
    family_key: str = "state_specialty_v1",
) -> int:
    """Record one UserPrivacyLedger row per user. Skips if already exists. Returns count created."""
    cell_key_str = "/".join(cell_key)
    created = 0
    for uid in user_ids:
        existing = (
            db.query(UserPrivacyLedger)
            .filter(
                UserPrivacyLedger.user_id == uid,
                UserPrivacyLedger.period_start == period_start,
                UserPrivacyLedger.family_key == family_key,
                UserPrivacyLedger.cell_key == cell_key_str,
            )
            .one_or_none()
        )
        if existing is None:
            db.add(UserPrivacyLedger(
                user_id=uid,
                period_start=period_start,
                family_key=family_key,
                cell_key=cell_key_str,
                epsilon_spent=_to_decimal(epsilon_per_user),
            ))
            created += 1
    return created


def compute_adaptive_epsilon(
    *,
    config_epsilon: float,
    annual_cap: float,
    period_index: int,
    total_periods: int,
    spent_so_far: float,
) -> float:
    """Compute adaptive per-period ε that never overshoots the annual cap.

    Returns min(config_epsilon, remaining_budget / remaining_periods).
    """
    remaining = max(0.0, annual_cap - spent_so_far)
    remaining_periods = max(1, total_periods - period_index)
    return min(config_epsilon, remaining / remaining_periods)


def user_annual_summary(
    db: Session,
    *,
    user_id,
    year: int,
) -> dict:
    """Return per-user ε summary for a given year (GDPR Art. 15)."""
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)

    entries = (
        db.query(UserPrivacyLedger)
        .filter(
            UserPrivacyLedger.user_id == user_id,
            UserPrivacyLedger.period_start >= year_start,
            UserPrivacyLedger.period_start <= year_end,
        )
        .order_by(UserPrivacyLedger.period_start.asc())
        .all()
    )

    total_spent = sum(float(e.epsilon_spent) for e in entries)
    cells = list({e.cell_key for e in entries})

    return {
        "year": year,
        "total_spent": total_spent,
        "n_entries": len(entries),
        "cells": cells,
        "earliest_period": entries[0].period_start.isoformat() if entries else None,
        "latest_period": entries[-1].period_start.isoformat() if entries else None,
    }


def worst_case_user_spend(
    db: Session,
    *,
    year: int,
) -> dict | None:
    """Return the user with the highest ε spend for the year."""
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)

    result = (
        db.query(
            UserPrivacyLedger.user_id,
            func.sum(UserPrivacyLedger.epsilon_spent).label('total_spent'),
        )
        .filter(
            UserPrivacyLedger.period_start >= year_start,
            UserPrivacyLedger.period_start <= year_end,
        )
        .group_by(UserPrivacyLedger.user_id)
        .order_by(func.sum(UserPrivacyLedger.epsilon_spent).desc())
        .first()
    )

    if result is None:
        return None

    return {
        "user_id": str(result.user_id),
        "total_spent": float(result.total_spent),
    }


def budget_monitoring_summary(
    db: Session,
    *,
    year: int,
    annual_cap: float,
) -> dict:
    """Admin-level overview of privacy budget consumption for the year."""
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)

    per_user = (
        db.query(
            UserPrivacyLedger.user_id,
            func.sum(UserPrivacyLedger.epsilon_spent).label('total_spent'),
        )
        .filter(
            UserPrivacyLedger.period_start >= year_start,
            UserPrivacyLedger.period_start <= year_end,
        )
        .group_by(UserPrivacyLedger.user_id)
        .all()
    )

    n_users = len(per_user)
    if n_users == 0:
        return {
            "year": year,
            "n_users": 0,
            "worst_case_spent": 0.0,
            "avg_spent": 0.0,
            "utilization_pct": 0.0,
            "annual_cap": annual_cap,
        }

    spends = [float(r.total_spent) for r in per_user]
    worst = max(spends)
    avg = sum(spends) / n_users

    return {
        "year": year,
        "n_users": n_users,
        "worst_case_spent": worst,
        "avg_spent": avg,
        "utilization_pct": (worst / annual_cap * 100) if annual_cap > 0 else 0.0,
        "annual_cap": annual_cap,
    }


def user_cumulative_spent(
    db: Session,
    *,
    user_id,
    since: date | None = None,
) -> float:
    """Return total ε spent for a user, optionally since a given date."""
    query = db.query(func.sum(UserPrivacyLedger.epsilon_spent)).filter(
        UserPrivacyLedger.user_id == user_id,
    )
    if since is not None:
        query = query.filter(UserPrivacyLedger.period_start >= since)
    spent = query.scalar()
    return float(spent or 0.0)
