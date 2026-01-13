"""
Aggregation script for privacy-preserving statistics.

Implements k-anonymity + differential privacy (Laplace mechanism).
"""
from __future__ import annotations

import secrets
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .database import get_db
from .models import StatsByStateSpecialty, User, WorkEvent


# Privacy parameters
K_MIN = 11  # Minimum users per group (k-anonymity threshold, EMA/Health Canada standard)
EPSILON = 1.0  # Privacy budget for differential privacy


def get_iso_week_bounds(iso_year: int, iso_week: int) -> tuple[date, date]:
    """
    Get the start (Monday) and end (Sunday) dates for an ISO week.

    ISO weeks start on Monday and are numbered 1-53.
    """
    # January 4th is always in week 1
    jan_4 = date(iso_year, 1, 4)
    # Find the Monday of week 1
    week_1_monday = jan_4 - timedelta(days=jan_4.weekday())
    # Calculate the target week's Monday
    target_monday = week_1_monday + timedelta(weeks=iso_week - 1)
    target_sunday = target_monday + timedelta(days=6)

    return target_monday, target_sunday


def laplace_noise(epsilon: float, sensitivity: float) -> float:
    """
    Generate Laplace noise for differential privacy.

    Args:
        epsilon: Privacy budget (smaller = more noise)
        sensitivity: Maximum change one individual can cause

    Returns:
        Random noise from Laplace distribution
    """
    # Scale parameter for Laplace distribution
    scale = sensitivity / epsilon

    # Generate uniform random in (-0.5, 0.5) using cryptographically secure RNG
    u = secrets.SystemRandom().uniform(-0.5, 0.5)

    # Inverse CDF of Laplace distribution
    if u < 0:
        noise = scale * (1 + u * 2)  # Left side
    else:
        noise = -scale * (1 - u * 2)  # Right side

    return noise


def compute_aggregates_by_state_specialty(
    db: Session,
    target_date: date | None = None,
) -> int:
    """
    Compute aggregated statistics by state × specialty × role × week.

    Applies k-anonymity filter and differential privacy noise.

    Args:
        db: Database session
        target_date: Date to aggregate around (defaults to yesterday)
                     Will aggregate the ISO week containing this date

    Returns:
        Number of statistics records created
    """
    if target_date is None:
        target_date = date.today() - timedelta(days=1)

    # Get ISO week for the target date
    iso_year, iso_week, _ = target_date.isocalendar()
    period_start, period_end = get_iso_week_bounds(iso_year, iso_week)

    print(f"Aggregating for ISO week {iso_year}-W{iso_week:02d} ({period_start} to {period_end})")

    # Query to aggregate work events
    # Group by: country, state, specialty, role_level, week
    query = (
        select(
            User.country_code,
            User.state_code,
            User.specialty,
            User.role_level,
            func.count(func.distinct(WorkEvent.user_id)).label('n_users'),
            func.avg(WorkEvent.planned_hours).label('avg_planned'),
            func.avg(WorkEvent.actual_hours).label('avg_actual'),
        )
        .join(User, WorkEvent.user_id == User.user_id)
        .where(WorkEvent.date >= period_start)
        .where(WorkEvent.date <= period_end)
        .group_by(
            User.country_code,
            User.state_code,
            User.specialty,
            User.role_level,
        )
    )

    results = db.execute(query).all()

    print(f"Found {len(results)} groups before k-anonymity filter")

    # Apply k-anonymity filter and add noise
    stats_created = 0

    for row in results:
        n_users = row.n_users

        # K-anonymity filter: Only publish if n_users >= K_MIN
        if n_users < K_MIN:
            print(f"  Suppressed group (n={n_users} < {K_MIN}): {row.state_code}/{row.specialty}/{row.role_level}")
            continue

        # Calculate averages
        avg_planned = float(row.avg_planned) if row.avg_planned else 0.0
        avg_actual = float(row.avg_actual) if row.avg_actual else 0.0
        avg_overtime = avg_actual - avg_planned

        # Sensitivity calculation
        # For averages: sensitivity = max_value / n_users
        # Assuming max hours per day = 24, and we're averaging over days in a week (7 days max)
        # Max contribution per user = 24 * 7 = 168 hours/week
        max_hours_per_week = 24 * 7
        sensitivity = max_hours_per_week / n_users

        # Add Laplace noise to each average
        noise_planned = laplace_noise(EPSILON, sensitivity)
        noise_actual = laplace_noise(EPSILON, sensitivity)
        noise_overtime = laplace_noise(EPSILON, sensitivity)

        avg_planned_noised = max(0, avg_planned + noise_planned)  # Clamp to non-negative
        avg_actual_noised = max(0, avg_actual + noise_actual)
        avg_overtime_noised = avg_overtime + noise_overtime  # Can be negative

        print(f"  Publishing group (n={n_users}): {row.state_code}/{row.specialty}/{row.role_level}")
        print(f"    Planned: {avg_planned:.2f} → {avg_planned_noised:.2f} (noise: {noise_planned:+.2f})")
        print(f"    Actual: {avg_actual:.2f} → {avg_actual_noised:.2f} (noise: {noise_actual:+.2f})")

        # Check if this stat already exists (idempotency)
        existing = (
            db.query(StatsByStateSpecialty)
            .filter(
                StatsByStateSpecialty.country_code == row.country_code,
                StatsByStateSpecialty.state_code == row.state_code,
                StatsByStateSpecialty.specialty == row.specialty,
                StatsByStateSpecialty.role_level == row.role_level,
                StatsByStateSpecialty.period_start == period_start,
            )
            .one_or_none()
        )

        if existing:
            # Update existing record
            existing.n_users = n_users
            existing.avg_planned_hours_noised = Decimal(str(round(avg_planned_noised, 2)))
            existing.avg_actual_hours_noised = Decimal(str(round(avg_actual_noised, 2)))
            existing.avg_overtime_hours_noised = Decimal(str(round(avg_overtime_noised, 2)))
            existing.k_min_threshold = K_MIN
            existing.noise_epsilon = Decimal(str(EPSILON))
            existing.computed_at = datetime.utcnow()
            print(f"    Updated existing stat record")
        else:
            # Create new record
            stat = StatsByStateSpecialty(
                country_code=row.country_code,
                state_code=row.state_code,
                specialty=row.specialty,
                role_level=row.role_level,
                period_start=period_start,
                period_end=period_end,
                n_users=n_users,
                avg_planned_hours_noised=Decimal(str(round(avg_planned_noised, 2))),
                avg_actual_hours_noised=Decimal(str(round(avg_actual_noised, 2))),
                avg_overtime_hours_noised=Decimal(str(round(avg_overtime_noised, 2))),
                k_min_threshold=K_MIN,
                noise_epsilon=Decimal(str(EPSILON)),
            )
            db.add(stat)
            stats_created += 1
            print(f"    Created new stat record")

    db.commit()

    print(f"\nAggregation complete:")
    print(f"  Total groups: {len(results)}")
    print(f"  Published (n >= {K_MIN}): {stats_created}")
    print(f"  Suppressed (n < {K_MIN}): {len(results) - stats_created}")

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
