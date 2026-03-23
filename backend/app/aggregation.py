"""
Aggregation script for privacy-preserving statistics.

Implements k-anonymity + differential privacy (Laplace mechanism)
over finalized user-weeks.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from .database import get_db
from .dp_group_stats.accounting import (
    EpsilonBreakdown,
    compute_adaptive_epsilon,
    record_state_specialty_ledger_entry,
    record_user_ledger_entries,
)
from .dp_group_stats.config import DPGroupStatsV1Config, PeriodType, periods_per_year
from .dp_group_stats.mechanisms import laplace_ci_half_width, laplace_noise
from .dp_group_stats.policy import PublicationStatus, get_publication_status
from .models import (
    FinalizedUserWeek,
    StateSpecialtyPrivacyLedger,
    StateSpecialtyReleaseCell,
    StatsByStateSpecialty,
)
from .periods import compute_period_index, get_period_bounds, period_before

logger = logging.getLogger(__name__)

_V1_CONFIG = DPGroupStatsV1Config()
K_MIN = _V1_CONFIG.release_policy.k_min
EPSILON = _V1_CONFIG.epsilon_split.total
_BOUNDS = _V1_CONFIG.bounds
_EPSILON_SPLIT = _V1_CONFIG.epsilon_split
_RELEASE_POLICY = _V1_CONFIG.release_policy
_LEDGER_BREAKDOWN = EpsilonBreakdown(
    planned_sum=_EPSILON_SPLIT.planned_sum,
    actual_sum=_EPSILON_SPLIT.actual_sum,
)
_TRACKED_INTERNAL_STATUSES = {
    PublicationStatus.published.value,
    PublicationStatus.warming_up.value,
    PublicationStatus.cooling_down.value,
}


def _cell_key(*, country_code: str, state_code: str, specialty: str) -> tuple[str, str, str]:
    return country_code, state_code, specialty


def _parse_internal_status(raw_status: str | None) -> PublicationStatus:
    try:
        return PublicationStatus(raw_status)
    except (TypeError, ValueError):
        return PublicationStatus.published


def _count_prior_streak(
    db: Session,
    *,
    cell_key: tuple[str, str, str],
    current_period_start: date,
    eligible: bool,
    period_type: PeriodType = "weekly",
) -> int:
    streak = 0
    expected_period = period_before(current_period_start, period_type)

    while True:
        prior = (
            db.query(StatsByStateSpecialty)
            .filter(
                StatsByStateSpecialty.country_code == cell_key[0],
                StatsByStateSpecialty.state_code == cell_key[1],
                StatsByStateSpecialty.specialty == cell_key[2],
                StatsByStateSpecialty.role_level == "all",
                StatsByStateSpecialty.period_start == expected_period,
            )
            .one_or_none()
        )

        if prior is None:
            return streak

        prior_is_eligible = (
            prior.n_users >= K_MIN
            and prior.publication_status != PublicationStatus.suppressed.value
        )
        if prior_is_eligible != eligible:
            return streak

        streak += 1
        expected_period = period_before(expected_period, period_type)


def _build_weekly_query(period_start: date):
    """Build aggregation query for a single week."""
    return (
        select(
            FinalizedUserWeek.country_code,
            FinalizedUserWeek.state_code,
            FinalizedUserWeek.specialty,
            func.count(FinalizedUserWeek.user_id).label('n_users'),
            func.sum(case(
                (FinalizedUserWeek.planned_hours < _BOUNDS.planned_weekly_min, _BOUNDS.planned_weekly_min),
                (FinalizedUserWeek.planned_hours > _BOUNDS.planned_weekly_max, _BOUNDS.planned_weekly_max),
                else_=FinalizedUserWeek.planned_hours,
            )).label('clipped_planned_sum'),
            func.sum(case(
                (FinalizedUserWeek.actual_hours < _BOUNDS.actual_weekly_min, _BOUNDS.actual_weekly_min),
                (FinalizedUserWeek.actual_hours > _BOUNDS.actual_weekly_max, _BOUNDS.actual_weekly_max),
                else_=FinalizedUserWeek.actual_hours,
            )).label('clipped_actual_sum'),
        )
        .where(FinalizedUserWeek.week_start == period_start)
        .group_by(
            FinalizedUserWeek.country_code,
            FinalizedUserWeek.state_code,
            FinalizedUserWeek.specialty,
        )
    )


def _build_multi_week_query(period_start: date, period_end: date):
    """Build aggregation query for multi-week periods (biweekly/monthly).

    Uses per-user mean across weeks in the period (clip each week first),
    then aggregates across users. Sensitivity is unchanged since each user's
    mean is in [0, clip_max].
    """
    # CTE: per-user averages of clipped weekly values
    user_avgs = (
        select(
            FinalizedUserWeek.user_id,
            FinalizedUserWeek.country_code,
            FinalizedUserWeek.state_code,
            FinalizedUserWeek.specialty,
            func.avg(case(
                (FinalizedUserWeek.planned_hours < _BOUNDS.planned_weekly_min, _BOUNDS.planned_weekly_min),
                (FinalizedUserWeek.planned_hours > _BOUNDS.planned_weekly_max, _BOUNDS.planned_weekly_max),
                else_=FinalizedUserWeek.planned_hours,
            )).label('avg_planned'),
            func.avg(case(
                (FinalizedUserWeek.actual_hours < _BOUNDS.actual_weekly_min, _BOUNDS.actual_weekly_min),
                (FinalizedUserWeek.actual_hours > _BOUNDS.actual_weekly_max, _BOUNDS.actual_weekly_max),
                else_=FinalizedUserWeek.actual_hours,
            )).label('avg_actual'),
        )
        .where(
            FinalizedUserWeek.week_start >= period_start,
            FinalizedUserWeek.week_start <= period_end,
        )
        .group_by(
            FinalizedUserWeek.user_id,
            FinalizedUserWeek.country_code,
            FinalizedUserWeek.state_code,
            FinalizedUserWeek.specialty,
        )
    ).cte('user_avgs')

    return (
        select(
            user_avgs.c.country_code,
            user_avgs.c.state_code,
            user_avgs.c.specialty,
            func.count(user_avgs.c.user_id).label('n_users'),
            func.sum(user_avgs.c.avg_planned).label('clipped_planned_sum'),
            func.sum(user_avgs.c.avg_actual).label('clipped_actual_sum'),
        )
        .group_by(
            user_avgs.c.country_code,
            user_avgs.c.state_code,
            user_avgs.c.specialty,
        )
    )


def _derive_noised_means(
    *,
    count: int,
    planned_sum: float,
    actual_sum: float,
    epsilon_split: EpsilonBreakdown | None = None,
) -> tuple[float, float, float]:
    """Add Laplace noise to sums and compute means.

    Under substitution neighboring relation, counts are public — no ε spent.
    Noise is added only to sums; true count is used as denominator.
    """
    split = epsilon_split or _EPSILON_SPLIT
    noised_planned_sum = planned_sum + laplace_noise(
        split.planned_sum,
        _BOUNDS.planned_weekly_max,
    )
    noised_actual_sum = actual_sum + laplace_noise(
        split.actual_sum,
        _BOUNDS.actual_weekly_max,
    )

    denominator = max(count, 1)
    avg_planned_noised = max(0.0, noised_planned_sum / denominator)
    avg_actual_noised = max(0.0, noised_actual_sum / denominator)
    avg_overtime_noised = avg_actual_noised - avg_planned_noised
    return avg_planned_noised, avg_actual_noised, avg_overtime_noised


def _existing_release_values(
    stat: StatsByStateSpecialty,
) -> tuple[float | None, float | None, float | None]:
    return (
        None if stat.avg_planned_hours_noised is None else float(stat.avg_planned_hours_noised),
        None if stat.avg_actual_hours_noised is None else float(stat.avg_actual_hours_noised),
        None if stat.avg_overtime_hours_noised is None else float(stat.avg_overtime_hours_noised),
    )


def _get_per_user_actual_hours(
    db: Session,
    *,
    cell_key: tuple[str, str, str],
    period_start: date,
    period_end: date | None = None,
) -> list[tuple[Any, float]]:
    """Return (user_id, actual_hours) pairs for a cell+period.

    For multi-week periods (period_end != period_start), returns per-user
    AVG of clipped actual hours across weeks in the range.
    """
    if period_end is None or period_end == period_start + timedelta(days=6):
        # Single week: original query
        rows = (
            db.query(FinalizedUserWeek.user_id, FinalizedUserWeek.actual_hours)
            .filter(
                FinalizedUserWeek.country_code == cell_key[0],
                FinalizedUserWeek.state_code == cell_key[1],
                FinalizedUserWeek.specialty == cell_key[2],
                FinalizedUserWeek.week_start == period_start,
            )
            .all()
        )
        return [(row.user_id, float(row.actual_hours)) for row in rows]

    # Multi-week: per-user average
    rows = (
        db.query(
            FinalizedUserWeek.user_id,
            func.avg(FinalizedUserWeek.actual_hours).label('avg_actual'),
        )
        .filter(
            FinalizedUserWeek.country_code == cell_key[0],
            FinalizedUserWeek.state_code == cell_key[1],
            FinalizedUserWeek.specialty == cell_key[2],
            FinalizedUserWeek.week_start >= period_start,
            FinalizedUserWeek.week_start <= period_end,
        )
        .group_by(FinalizedUserWeek.user_id)
        .all()
    )
    return [(row.user_id, float(row.avg_actual)) for row in rows]


def _check_dominance(
    per_user_actual: list[tuple[Any, float]],
    threshold: float = _RELEASE_POLICY.dominance_threshold,
) -> bool:
    """Return True if a single user dominates the cell (should be suppressed)."""
    if not per_user_actual:
        return False
    clipped = [_BOUNDS.clip_actual(hours) for _, hours in per_user_actual]
    total = sum(clipped)
    if total == 0:
        return False
    return max(clipped) / total > threshold


def _compute_year_to_date_spending(db: Session, *, year: int) -> float:
    """Sum total_epsilon from state specialty ledger for the given year."""
    year_start = date(year, 1, 1)
    year_end = date(year, 12, 31)
    spent = (
        db.query(func.sum(StateSpecialtyPrivacyLedger.total_epsilon))
        .filter(
            StateSpecialtyPrivacyLedger.period_start >= year_start,
            StateSpecialtyPrivacyLedger.period_start <= year_end,
        )
        .scalar()
    )
    return float(spent or 0.0)


def compute_aggregates_by_state_specialty(
    db: Session,
    target_date: date | None = None,
    *,
    period_type: PeriodType = "weekly",
) -> int:
    """
    Compute aggregated statistics by state × specialty × period.

    Applies v1 publication policy:
    - state x specialty release family
    - activation/deactivation streak handling
    - differential privacy noise only for published cells
    - adaptive ε schedule (never exceeds annual cap)
    - confidence intervals for published cells

    Args:
        db: Database session
        target_date: Date to aggregate around (defaults to yesterday)
        period_type: Aggregation granularity ("weekly", "biweekly", "monthly")

    Returns:
        Number of statistics records created
    """
    if target_date is None:
        target_date = date.today() - timedelta(days=1)

    period_start, period_end = get_period_bounds(target_date, period_type)
    previous_period_start = period_before(period_start, period_type)

    print(f"Aggregating for period {period_start} to {period_end} (type={period_type})")

    # Build the appropriate query
    if period_type == "weekly":
        query = _build_weekly_query(period_start)
    else:
        query = _build_multi_week_query(period_start, period_end)

    results = db.execute(query).all()
    observed_by_cell = {
        _cell_key(
            country_code=row.country_code,
            state_code=row.state_code,
            specialty=row.specialty,
        ): row
        for row in results
    }
    configured_cells = {
        _cell_key(
            country_code=row.country_code,
            state_code=row.state_code,
            specialty=row.specialty,
        )
        for row in db.query(StateSpecialtyReleaseCell)
        .filter(StateSpecialtyReleaseCell.is_enabled.is_(True))
        .all()
    }
    current_ledger_rows = (
        db.query(StateSpecialtyPrivacyLedger)
        .filter(StateSpecialtyPrivacyLedger.period_start == period_start)
        .all()
    )
    ledger_by_cell = {
        _cell_key(
            country_code=row.country_code,
            state_code=row.state_code,
            specialty=row.specialty,
        ): row
        for row in current_ledger_rows
    }
    previous_rows = (
        db.query(StatsByStateSpecialty)
        .filter(
            StatsByStateSpecialty.role_level == "all",
            StatsByStateSpecialty.period_start == previous_period_start,
            StatsByStateSpecialty.publication_status.in_(_TRACKED_INTERNAL_STATUSES),
        )
        .all()
    )
    previous_by_cell = {
        _cell_key(
            country_code=row.country_code,
            state_code=row.state_code,
            specialty=row.specialty,
        ): row
        for row in previous_rows
    }
    ignored_observed_cells = set(observed_by_cell) - configured_cells
    relevant_cells = configured_cells | set(previous_by_cell)

    print(f"Found {len(results)} groups before k-anonymity filter")
    if ignored_observed_cells:
        print(f"Ignoring {len(ignored_observed_cells)} unconfigured observed groups")

    # Compute adaptive epsilon for this period
    year = period_start.year
    spent_ytd = _compute_year_to_date_spending(db, year=year)
    p_index = compute_period_index(period_start, period_type)
    total_periods = periods_per_year(period_type)
    annual_cap = _V1_CONFIG.annual_epsilon_cap

    if annual_cap is not None:
        adaptive_eps = compute_adaptive_epsilon(
            config_epsilon=_EPSILON_SPLIT.total,
            annual_cap=annual_cap,
            period_index=p_index,
            total_periods=total_periods,
            spent_so_far=spent_ytd,
        )
    else:
        adaptive_eps = _EPSILON_SPLIT.total

    # Scale the split proportionally
    if adaptive_eps > 0 and _EPSILON_SPLIT.total > 0:
        scale = adaptive_eps / _EPSILON_SPLIT.total
    else:
        scale = 0.0
    effective_split = EpsilonBreakdown(
        planned_sum=_EPSILON_SPLIT.planned_sum * scale,
        actual_sum=_EPSILON_SPLIT.actual_sum * scale,
    )
    effective_ledger_breakdown = effective_split

    # Anomaly logging (Gap 2)
    expected_per_period = (_EPSILON_SPLIT.total if annual_cap is None
                          else annual_cap / total_periods)
    if adaptive_eps < expected_per_period * 0.5:
        logger.warning(
            "Privacy budget anomaly: adaptive_eps=%.4f < 50%% of expected_per_period=%.4f "
            "(spent_ytd=%.4f, cap=%.1f)",
            adaptive_eps, expected_per_period, spent_ytd,
            annual_cap if annual_cap is not None else 0.0,
        )

    # Apply release policy and add noise only for publicly published cells.
    stats_created = 0

    per_user_data_by_cell: dict[tuple[str, str, str], list[tuple[Any, float]]] = {}

    for cell in sorted(relevant_cells):
        row: Any | None = observed_by_cell.get(cell)
        previous_row = previous_by_cell.get(cell)
        n_users = int(row.n_users) if row is not None else 0
        planned_sum = float(row.clipped_planned_sum or 0.0) if row is not None else 0.0
        actual_sum = float(row.clipped_actual_sum or 0.0) if row is not None else 0.0

        # Query per-user data (used for dominance check + per-user ledger)
        per_user_actual = _get_per_user_actual_hours(
            db, cell_key=cell, period_start=period_start,
            period_end=period_end if period_type != "weekly" else None,
        )
        per_user_data_by_cell[cell] = per_user_actual

        # Eligibility: K_MIN + dominance rule
        is_eligible = n_users >= K_MIN and not _check_dominance(per_user_actual)

        was_active = previous_row is not None and _parse_internal_status(previous_row.publication_status) in {
            PublicationStatus.published,
            PublicationStatus.cooling_down,
        }
        consecutive_eligible = (
            1 + _count_prior_streak(db, cell_key=cell, current_period_start=period_start, eligible=True, period_type=period_type)
            if is_eligible
            else 0
        )
        consecutive_ineligible = (
            1 + _count_prior_streak(db, cell_key=cell, current_period_start=period_start, eligible=False, period_type=period_type)
            if not is_eligible
            else 0
        )
        status = get_publication_status(
            was_active=was_active,
            consecutive_eligible=consecutive_eligible,
            consecutive_ineligible=consecutive_ineligible,
            activation_weeks=_RELEASE_POLICY.activation_weeks,
            deactivation_grace_weeks=_RELEASE_POLICY.deactivation_grace_weeks,
        )
        existing = (
            db.query(StatsByStateSpecialty)
            .filter(
                StatsByStateSpecialty.country_code == cell[0],
                StatsByStateSpecialty.state_code == cell[1],
                StatsByStateSpecialty.specialty == cell[2],
                StatsByStateSpecialty.role_level == "all",
                StatsByStateSpecialty.period_start == period_start,
            )
            .one_or_none()
        )
        existing_ledger = ledger_by_cell.get(cell)
        needs_noise = status in {PublicationStatus.published, PublicationStatus.cooling_down}
        reuse_existing_release = (
            needs_noise
            and existing is not None
            and existing_ledger is not None
        )
        avg_planned_noised: float | None = None
        avg_actual_noised: float | None = None
        avg_overtime_noised: float | None = None
        planned_ci_half: float | None = None
        actual_ci_half: float | None = None
        overtime_ci_half: float | None = None
        n_display: int | None = None

        if reuse_existing_release:
            avg_planned_noised, avg_actual_noised, avg_overtime_noised = _existing_release_values(existing)
            # Reuse CI values too
            planned_ci_half = None if existing.planned_ci_half is None else float(existing.planned_ci_half)
            actual_ci_half = None if existing.actual_ci_half is None else float(existing.actual_ci_half)
            overtime_ci_half = None if existing.overtime_ci_half is None else float(existing.overtime_ci_half)
            n_display = existing.n_display
            print(f"  Reusing existing {status.value} release: {cell[1]}/{cell[2]}")
        elif needs_noise:
            avg_planned = planned_sum / n_users if n_users else 0.0
            avg_actual = actual_sum / n_users if n_users else 0.0

            avg_planned_noised, avg_actual_noised, avg_overtime_noised = _derive_noised_means(
                count=n_users,
                planned_sum=planned_sum,
                actual_sum=actual_sum,
                epsilon_split=effective_split,
            )

            # Compute confidence intervals (Gap 4)
            if effective_split.planned_sum > 0 and effective_split.actual_sum > 0 and n_users > 0:
                planned_ci_half, n_display = laplace_ci_half_width(
                    effective_split.planned_sum, _BOUNDS.planned_weekly_max, n_users,
                )
                actual_ci_half, _ = laplace_ci_half_width(
                    effective_split.actual_sum, _BOUNDS.actual_weekly_max, n_users,
                )
                overtime_ci_half = planned_ci_half + actual_ci_half  # Conservative (triangle inequality)

            print(f"  {status.value.title()} group (n={n_users}): {cell[1]}/{cell[2]}")
            print(f"    Planned: {avg_planned:.2f} → {avg_planned_noised:.2f}")
            print(f"    Actual: {avg_actual:.2f} → {avg_actual_noised:.2f}")
        else:
            print(
                f"  Tracking group as {status.value} "
                f"(n={n_users}, eligible_streak={consecutive_eligible}, ineligible_streak={consecutive_ineligible}): "
                f"{cell[1]}/{cell[2]}"
            )

        effective_epsilon = adaptive_eps

        if existing and not reuse_existing_release:
            # Update existing record
            existing.n_users = n_users
            existing.avg_planned_hours_noised = None if avg_planned_noised is None else Decimal(str(round(avg_planned_noised, 2)))
            existing.avg_actual_hours_noised = None if avg_actual_noised is None else Decimal(str(round(avg_actual_noised, 2)))
            existing.avg_overtime_hours_noised = None if avg_overtime_noised is None else Decimal(str(round(avg_overtime_noised, 2)))
            existing.publication_status = status.value
            existing.k_min_threshold = K_MIN
            existing.noise_epsilon = Decimal(str(round(effective_epsilon, 2)))
            existing.computed_at = datetime.utcnow()
            existing.period_type = period_type
            existing.planned_ci_half = None if planned_ci_half is None else Decimal(str(round(planned_ci_half, 2)))
            existing.actual_ci_half = None if actual_ci_half is None else Decimal(str(round(actual_ci_half, 2)))
            existing.overtime_ci_half = None if overtime_ci_half is None else Decimal(str(round(overtime_ci_half, 2)))
            existing.n_display = n_display
            print(f"    Updated existing stat record")
        elif existing is None:
            # Create new record
            stat = StatsByStateSpecialty(
                country_code=cell[0],
                state_code=cell[1],
                specialty=cell[2],
                role_level="all",
                period_start=period_start,
                period_end=period_end,
                n_users=n_users,
                avg_planned_hours_noised=None if avg_planned_noised is None else Decimal(str(round(avg_planned_noised, 2))),
                avg_actual_hours_noised=None if avg_actual_noised is None else Decimal(str(round(avg_actual_noised, 2))),
                avg_overtime_hours_noised=None if avg_overtime_noised is None else Decimal(str(round(avg_overtime_noised, 2))),
                publication_status=status.value,
                k_min_threshold=K_MIN,
                noise_epsilon=Decimal(str(round(effective_epsilon, 2))),
                period_type=period_type,
                planned_ci_half=None if planned_ci_half is None else Decimal(str(round(planned_ci_half, 2))),
                actual_ci_half=None if actual_ci_half is None else Decimal(str(round(actual_ci_half, 2))),
                overtime_ci_half=None if overtime_ci_half is None else Decimal(str(round(overtime_ci_half, 2))),
                n_display=n_display,
            )
            db.add(stat)
            print(f"    Created new stat record")
        else:
            print(f"    Preserved existing published stat record")

        if needs_noise:
            if not reuse_existing_release:
                record_state_specialty_ledger_entry(
                    db,
                    cell_key=cell,
                    period_start=period_start,
                    breakdown=effective_ledger_breakdown,
                    publication_status=status.value,
                )
                # Per-user ledger: record ε exposure for each contributing user
                contributing_user_ids = [uid for uid, _ in per_user_data_by_cell.get(cell, [])]
                if contributing_user_ids:
                    record_user_ledger_entries(
                        db,
                        cell_key=cell,
                        period_start=period_start,
                        user_ids=contributing_user_ids,
                        epsilon_per_user=effective_ledger_breakdown.total,
                    )
            if status == PublicationStatus.published:
                stats_created += 1

    db.commit()

    print(f"\nAggregation complete:")
    print(f"  Total observed groups: {len(results)}")
    print(f"  Total tracked cells: {len(relevant_cells)}")
    print(f"  Published: {stats_created}")
    print(f"  Non-public: {len(relevant_cells) - stats_created}")
    print(f"  Adaptive ε: {adaptive_eps:.4f} (YTD spend: {spent_ytd:.4f})")

    return stats_created


def main():
    """Run aggregation for yesterday's ISO week."""
    db = next(get_db())
    try:
        stats_created = compute_aggregates_by_state_specialty(db)
        print(f"\n✅ Created {stats_created} statistics records")
    finally:
        db.close()


if __name__ == "__main__":
    main()
