"""
Aggregation script for privacy-preserving statistics.

Implements k-anonymity + differential privacy (Laplace mechanism)
over finalized user-weeks.
"""
from __future__ import annotations

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from .database import get_db
from .dp_group_stats.accounting import EpsilonBreakdown, record_state_specialty_ledger_entry, record_user_ledger_entries
from .dp_group_stats.config import DPGroupStatsV1Config
from .dp_group_stats.mechanisms import laplace_noise
from .dp_group_stats.policy import PublicationStatus, get_publication_status
from .models import (
    FinalizedUserWeek,
    StateSpecialtyPrivacyLedger,
    StateSpecialtyReleaseCell,
    StatsByStateSpecialty,
)
from .periods import get_iso_week_bounds as get_week_bounds


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


def _period_before(period_start: date, *, weeks: int = 1) -> date:
    return period_start - timedelta(days=7 * weeks)


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
) -> int:
    streak = 0
    expected_period = _period_before(current_period_start)

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
        expected_period = _period_before(expected_period)


def _derive_noised_means(
    *,
    count: int,
    planned_sum: float,
    actual_sum: float,
) -> tuple[float, float, float]:
    # Under substitution neighboring relation, counts are public — no ε spent.
    # Noise is added only to sums; true count is used as denominator.
    noised_planned_sum = planned_sum + laplace_noise(
        _EPSILON_SPLIT.planned_sum,
        _BOUNDS.planned_weekly_max,
    )
    noised_actual_sum = actual_sum + laplace_noise(
        _EPSILON_SPLIT.actual_sum,
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
) -> list[tuple[Any, float]]:
    """Return (user_id, actual_hours) pairs for a cell+period."""
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


def compute_aggregates_by_state_specialty(
    db: Session,
    target_date: date | None = None,
) -> int:
    """
    Compute aggregated statistics by state × specialty × week.

    Applies v1 publication policy:
    - state x specialty release family
    - activation/deactivation streak handling
    - differential privacy noise only for published cells

    Args:
        db: Database session
        target_date: Date to aggregate around (defaults to yesterday)
                     Will aggregate the ISO week containing this date

    Returns:
        Number of statistics records created
    """
    if target_date is None:
        target_date = date.today() - timedelta(days=1)

    iso_year, iso_week, _ = target_date.isocalendar()
    period_start, period_end = get_week_bounds(target_date)
    previous_period_start = _period_before(period_start)

    print(f"Aggregating for ISO week {iso_year}-W{iso_week:02d} ({period_start} to {period_end})")

    # Query to aggregate finalized user-weeks.
    # v1 scope is state x specialty, so role is intentionally collapsed to "all".
    query = (
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

    # Apply release policy and add noise only for publicly published cells.
    stats_created = 0

    per_user_data_by_cell: dict[tuple[str, str, str], list[tuple[Any, float]]] = {}

    for cell in sorted(relevant_cells):
        row: Any | None = observed_by_cell.get(cell)
        previous_row = previous_by_cell.get(cell)
        n_users = int(row.n_users) if row is not None else 0
        planned_sum = float(row.clipped_planned_sum or 0.0) if row is not None else 0.0
        actual_sum = float(row.clipped_actual_sum or 0.0) if row is not None else 0.0

        # Query per-user data (used for dominance check + per-user ledger in Step 4)
        per_user_actual = _get_per_user_actual_hours(db, cell_key=cell, period_start=period_start)
        per_user_data_by_cell[cell] = per_user_actual

        # Eligibility: K_MIN + dominance rule
        is_eligible = n_users >= K_MIN and not _check_dominance(per_user_actual)

        was_active = previous_row is not None and _parse_internal_status(previous_row.publication_status) in {
            PublicationStatus.published,
            PublicationStatus.cooling_down,
        }
        consecutive_eligible = (
            1 + _count_prior_streak(db, cell_key=cell, current_period_start=period_start, eligible=True)
            if is_eligible
            else 0
        )
        consecutive_ineligible = (
            1 + _count_prior_streak(db, cell_key=cell, current_period_start=period_start, eligible=False)
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

        if reuse_existing_release:
            avg_planned_noised, avg_actual_noised, avg_overtime_noised = _existing_release_values(existing)
            print(f"  Reusing existing {status.value} release: {cell[1]}/{cell[2]}")
        elif needs_noise:
            avg_planned = planned_sum / n_users if n_users else 0.0
            avg_actual = actual_sum / n_users if n_users else 0.0

            avg_planned_noised, avg_actual_noised, avg_overtime_noised = _derive_noised_means(
                count=n_users,
                planned_sum=planned_sum,
                actual_sum=actual_sum,
            )

            print(f"  {status.value.title()} group (n={n_users}): {cell[1]}/{cell[2]}")
            print(f"    Planned: {avg_planned:.2f} → {avg_planned_noised:.2f}")
            print(f"    Actual: {avg_actual:.2f} → {avg_actual_noised:.2f}")
        else:
            print(
                f"  Tracking group as {status.value} "
                f"(n={n_users}, eligible_streak={consecutive_eligible}, ineligible_streak={consecutive_ineligible}): "
                f"{cell[1]}/{cell[2]}"
            )

        if existing and not reuse_existing_release:
            # Update existing record
            existing.n_users = n_users
            existing.avg_planned_hours_noised = None if avg_planned_noised is None else Decimal(str(round(avg_planned_noised, 2)))
            existing.avg_actual_hours_noised = None if avg_actual_noised is None else Decimal(str(round(avg_actual_noised, 2)))
            existing.avg_overtime_hours_noised = None if avg_overtime_noised is None else Decimal(str(round(avg_overtime_noised, 2)))
            existing.publication_status = status.value
            existing.k_min_threshold = K_MIN
            existing.noise_epsilon = Decimal(str(EPSILON))
            existing.computed_at = datetime.utcnow()
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
                noise_epsilon=Decimal(str(EPSILON)),
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
                    breakdown=_LEDGER_BREAKDOWN,
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
                        epsilon_per_user=_LEDGER_BREAKDOWN.total,
                    )
            if status == PublicationStatus.published:
                stats_created += 1

    db.commit()

    print(f"\nAggregation complete:")
    print(f"  Total observed groups: {len(results)}")
    print(f"  Total tracked cells: {len(relevant_cells)}")
    print(f"  Published: {stats_created}")
    print(f"  Non-public: {len(relevant_cells) - stats_created}")

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
