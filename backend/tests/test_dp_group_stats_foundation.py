from __future__ import annotations

import math
from datetime import date

import pytest

from app.dp_group_stats.accounting import (
    EpsilonBreakdown,
    EpsilonLedger,
    budget_monitoring_summary,
    compute_adaptive_epsilon,
    record_state_specialty_ledger_entry,
    record_user_ledger_entries,
    state_specialty_entries_for_cell,
    state_specialty_spent,
    user_annual_summary,
    user_cumulative_spent,
    worst_case_user_spend,
)
from app.dp_group_stats.config import (
    ContributionBounds,
    DPGroupStatsV1Config,
    EpsilonSplit,
    PeriodType,
    ReleasePolicyConfig,
    periods_per_year,
)
from app.dp_group_stats.mechanisms import laplace_ci_half_width, laplace_noise
from app.dp_group_stats.policy import PublicationStatus, get_publication_status
from app.periods import compute_period_index, get_period_bounds, period_before


class StubRng:
    def __init__(self, value: float) -> None:
        self.value = value

    def uniform(self, a: float, b: float) -> float:
        return self.value


def test_contribution_bounds_clip_values() -> None:
    bounds = ContributionBounds()

    assert bounds.clip_planned(-5.0) == 0.0
    assert bounds.clip_planned(120.0) == 80.0
    assert bounds.clip_actual(-1.0) == 0.0
    assert bounds.clip_actual(180.0) == 120.0


def test_epsilon_split_total() -> None:
    split = EpsilonSplit(planned_sum=0.2, actual_sum=0.8)

    assert split.total == pytest.approx(1.0)


def test_epsilon_split_defaults() -> None:
    split = EpsilonSplit()
    assert split.planned_sum == 0.2
    assert split.actual_sum == 0.8
    assert split.total == pytest.approx(1.0)


def test_release_policy_config_validates_positive_values() -> None:
    with pytest.raises(ValueError):
        ReleasePolicyConfig(activation_weeks=0)


def test_dominance_threshold_in_config() -> None:
    config = ReleasePolicyConfig()
    assert config.dominance_threshold == 0.30

    custom = ReleasePolicyConfig(dominance_threshold=0.5)
    assert custom.dominance_threshold == 0.5

    with pytest.raises(ValueError):
        ReleasePolicyConfig(dominance_threshold=0.0)

    with pytest.raises(ValueError):
        ReleasePolicyConfig(dominance_threshold=1.5)


def test_config_validates_annual_budget_cap() -> None:
    # Default: no cap, should work
    config = DPGroupStatsV1Config()
    assert config.annual_epsilon_cap == 150.0

    # Cap that allows the default budget: 1.0 * 52 = 52.0 <= 150.0
    config = DPGroupStatsV1Config(annual_epsilon_cap=52.0)
    assert config.annual_epsilon_cap == 52.0

    # Cap too low for the default budget
    with pytest.raises(ValueError, match="exceeds annual cap"):
        DPGroupStatsV1Config(annual_epsilon_cap=10.0)


# === Gap 3: Period type + temporal coarsening ===


def test_config_annual_cap_with_period_type() -> None:
    """Monthly: 1.0 × 12 = 12 ≤ 150 ✓"""
    config = DPGroupStatsV1Config(period_type="monthly")
    assert config.period_type == "monthly"
    assert config.annual_epsilon_cap == 150.0

    # Monthly with tight cap: 1.0 × 12 = 12 ≤ 12.0 ✓
    config = DPGroupStatsV1Config(period_type="monthly", annual_epsilon_cap=12.0)
    assert config.annual_epsilon_cap == 12.0

    # Monthly with too-tight cap
    with pytest.raises(ValueError, match="exceeds annual cap"):
        DPGroupStatsV1Config(period_type="monthly", annual_epsilon_cap=5.0)


def test_periods_per_year() -> None:
    assert periods_per_year("weekly") == 52
    assert periods_per_year("biweekly") == 26
    assert periods_per_year("monthly") == 12


def test_get_period_bounds_weekly() -> None:
    start, end = get_period_bounds(date(2026, 3, 18), "weekly")  # Wednesday
    assert start == date(2026, 3, 16)  # Monday
    assert end == date(2026, 3, 22)  # Sunday


def test_get_period_bounds_biweekly() -> None:
    # Week 12 (March 16-22, 2026) pairs with week 11 → biweek is weeks 11-12
    start, end = get_period_bounds(date(2026, 3, 18), "biweekly")
    assert start == date(2026, 3, 9)  # Monday of week 11
    assert end == date(2026, 3, 22)  # Sunday of week 12


def test_get_period_bounds_monthly() -> None:
    start, end = get_period_bounds(date(2026, 3, 18), "monthly")
    assert start == date(2026, 3, 1)
    assert end == date(2026, 3, 31)


def test_get_period_bounds_monthly_february() -> None:
    start, end = get_period_bounds(date(2026, 2, 15), "monthly")
    assert start == date(2026, 2, 1)
    assert end == date(2026, 2, 28)


def test_period_before_weekly() -> None:
    assert period_before(date(2026, 3, 16), "weekly") == date(2026, 3, 9)


def test_period_before_biweekly() -> None:
    assert period_before(date(2026, 3, 16), "biweekly") == date(2026, 3, 2)


def test_period_before_monthly() -> None:
    assert period_before(date(2026, 3, 1), "monthly") == date(2026, 2, 1)
    # January → previous December
    assert period_before(date(2026, 1, 1), "monthly") == date(2025, 12, 1)


def test_compute_period_index_weekly() -> None:
    # Week 12 → index 11
    assert compute_period_index(date(2026, 3, 16), "weekly") == 11


def test_compute_period_index_monthly() -> None:
    assert compute_period_index(date(2026, 1, 1), "monthly") == 0
    assert compute_period_index(date(2026, 12, 1), "monthly") == 11


def test_compute_period_index_biweekly() -> None:
    # Week 1 → biweek index 0, Week 3 → biweek index 1
    assert compute_period_index(date(2026, 1, 5), "biweekly") == 0  # Week 2, index = (2-1)//2 = 0
    assert compute_period_index(date(2026, 1, 12), "biweekly") == 1  # Week 3, index = (3-1)//2 = 1


# === Gap 1: Adaptive epsilon ===


def test_adaptive_epsilon_no_spending() -> None:
    """Fresh year with no spending → returns config_epsilon."""
    result = compute_adaptive_epsilon(
        config_epsilon=1.0,
        annual_cap=150.0,
        period_index=0,
        total_periods=52,
        spent_so_far=0.0,
    )
    assert result == pytest.approx(1.0)


def test_adaptive_epsilon_partial_year() -> None:
    """Half-year spent 50 of 100 cap, 26 periods remaining → 50/26 ≈ 1.923."""
    result = compute_adaptive_epsilon(
        config_epsilon=2.0,
        annual_cap=100.0,
        period_index=26,
        total_periods=52,
        spent_so_far=50.0,
    )
    expected = min(2.0, 50.0 / 26)
    assert result == pytest.approx(expected)


def test_adaptive_epsilon_over_cap() -> None:
    """Spent >= cap → returns 0."""
    result = compute_adaptive_epsilon(
        config_epsilon=1.0,
        annual_cap=50.0,
        period_index=40,
        total_periods=52,
        spent_so_far=50.0,
    )
    assert result == pytest.approx(0.0)


def test_adaptive_preserves_split_ratio() -> None:
    """Verify the split ratio is maintained when scaling."""
    split = EpsilonSplit(planned_sum=0.2, actual_sum=0.8)
    adaptive = compute_adaptive_epsilon(
        config_epsilon=split.total,
        annual_cap=150.0,
        period_index=0,
        total_periods=52,
        spent_so_far=0.0,
    )
    scale = adaptive / split.total
    effective = EpsilonBreakdown(
        planned_sum=split.planned_sum * scale,
        actual_sum=split.actual_sum * scale,
    )
    assert effective.planned_sum / effective.actual_sum == pytest.approx(0.2 / 0.8)


# === Gap 4: Confidence intervals ===


def test_ci_basic_calculation() -> None:
    """Known values: ε=1.0, sensitivity=120, n=10, 90% CI."""
    ci_half, n_disp = laplace_ci_half_width(1.0, 120.0, 10)
    # scale = 120/1 = 120, alpha = 0.05, log(1/0.05) ≈ 2.9957
    # n_display = 10 → ci_half = 120 * 2.9957 / 10 ≈ 35.95
    expected = 120.0 * math.log(20) / 10
    assert ci_half == pytest.approx(expected, rel=1e-4)
    assert n_disp == 10


def test_ci_n_display_rounding() -> None:
    """n_display rounds down to nearest 5, floored at 5."""
    _, n7 = laplace_ci_half_width(1.0, 120.0, 7)
    assert n7 == 5  # 7//5*5 = 5

    _, n12 = laplace_ci_half_width(1.0, 120.0, 12)
    assert n12 == 10  # 12//5*5 = 10

    _, n5 = laplace_ci_half_width(1.0, 120.0, 5)
    assert n5 == 5

    _, n3 = laplace_ci_half_width(1.0, 120.0, 3)
    assert n3 == 5  # max(5, 3//5*5=0) = 5


# === Existing tests ===


def test_laplace_noise_returns_zero_for_zero_sensitivity() -> None:
    assert laplace_noise(epsilon=1.0, sensitivity=0.0) == 0.0


def test_laplace_noise_uses_injected_rng() -> None:
    noise = laplace_noise(epsilon=1.0, sensitivity=10.0, rng=StubRng(0.25))

    assert noise == pytest.approx(-5.0)


def test_epsilon_ledger_tracks_total_spend_per_cell() -> None:
    ledger = EpsilonLedger()
    cell_key = ("DEU", "BE", "cardiology")

    ledger.record(cell_key=cell_key, period_start=date(2026, 3, 16), epsilon=0.3)
    ledger.record(cell_key=cell_key, period_start=date(2026, 3, 23), epsilon=0.2)

    assert ledger.spent(cell_key) == pytest.approx(0.5)
    assert len(ledger.entries_for_cell(cell_key)) == 2


@pytest.mark.integration
def test_state_specialty_privacy_ledger_persists_and_sums(test_db) -> None:
    breakdown = EpsilonBreakdown(planned_sum=0.2, actual_sum=0.8)
    cell_key = ("DEU", "BE", "cardiology")

    record_state_specialty_ledger_entry(
        test_db,
        cell_key=cell_key,
        period_start=date(2026, 3, 16),
        breakdown=breakdown,
    )
    record_state_specialty_ledger_entry(
        test_db,
        cell_key=cell_key,
        period_start=date(2026, 3, 23),
        breakdown=breakdown,
    )
    test_db.commit()

    assert state_specialty_spent(test_db, cell_key=cell_key) == pytest.approx(2.0)
    assert len(state_specialty_entries_for_cell(test_db, cell_key=cell_key)) == 2


@pytest.mark.integration
def test_user_privacy_ledger_persists_and_queries(test_db) -> None:
    from app.models import User

    user = User(
        email_hash="hash_ledger_test",
        hospital_id="test-hospital",
        specialty="cardiology",
        role_level="specialist",
        state_code="BE",
    )
    test_db.add(user)
    test_db.flush()

    cell_key = ("DEU", "BE", "cardiology")

    record_user_ledger_entries(
        test_db,
        cell_key=cell_key,
        period_start=date(2026, 3, 16),
        user_ids=[user.user_id],
        epsilon_per_user=1.0,
    )
    record_user_ledger_entries(
        test_db,
        cell_key=cell_key,
        period_start=date(2026, 3, 23),
        user_ids=[user.user_id],
        epsilon_per_user=1.0,
    )
    test_db.commit()

    total = user_cumulative_spent(test_db, user_id=user.user_id)
    assert total == pytest.approx(2.0)

    since_w13 = user_cumulative_spent(test_db, user_id=user.user_id, since=date(2026, 3, 23))
    assert since_w13 == pytest.approx(1.0)


# === Gap 2: Per-user budget monitoring ===


@pytest.mark.integration
def test_user_annual_summary_empty(test_db) -> None:
    from app.models import User

    user = User(
        email_hash="hash_annual_empty",
        hospital_id="test-hospital",
        specialty="cardiology",
        role_level="specialist",
        state_code="BE",
    )
    test_db.add(user)
    test_db.flush()

    summary = user_annual_summary(test_db, user_id=user.user_id, year=2026)
    assert summary["total_spent"] == 0.0
    assert summary["n_entries"] == 0
    assert summary["cells"] == []


@pytest.mark.integration
def test_user_annual_summary_with_entries(test_db) -> None:
    from app.models import User

    user = User(
        email_hash="hash_annual_entries",
        hospital_id="test-hospital",
        specialty="cardiology",
        role_level="specialist",
        state_code="BE",
    )
    test_db.add(user)
    test_db.flush()

    cell_key = ("DEU", "BE", "cardiology")
    record_user_ledger_entries(
        test_db,
        cell_key=cell_key,
        period_start=date(2026, 3, 16),
        user_ids=[user.user_id],
        epsilon_per_user=1.0,
    )
    record_user_ledger_entries(
        test_db,
        cell_key=cell_key,
        period_start=date(2026, 3, 23),
        user_ids=[user.user_id],
        epsilon_per_user=1.0,
    )
    test_db.commit()

    summary = user_annual_summary(test_db, user_id=user.user_id, year=2026)
    assert summary["total_spent"] == pytest.approx(2.0)
    assert summary["n_entries"] == 2
    assert "DEU/BE/cardiology" in summary["cells"]


@pytest.mark.integration
def test_worst_case_user_spend(test_db) -> None:
    from app.models import User

    users = []
    for i, eps in enumerate([1.0, 3.0, 2.0]):
        u = User(
            email_hash=f"hash_worst_{i}",
            hospital_id="test-hospital",
            specialty="cardiology",
            role_level="specialist",
            state_code="BE",
        )
        test_db.add(u)
        test_db.flush()
        users.append(u)

        record_user_ledger_entries(
            test_db,
            cell_key=("DEU", "BE", "cardiology"),
            period_start=date(2026, 3, 16),
            user_ids=[u.user_id],
            epsilon_per_user=eps,
        )
    test_db.commit()

    worst = worst_case_user_spend(test_db, year=2026)
    assert worst is not None
    assert worst["total_spent"] == pytest.approx(3.0)
    assert worst["user_id"] == str(users[1].user_id)


@pytest.mark.integration
def test_budget_monitoring_summary(test_db) -> None:
    from app.models import User

    user = User(
        email_hash="hash_budget_mon",
        hospital_id="test-hospital",
        specialty="cardiology",
        role_level="specialist",
        state_code="BE",
    )
    test_db.add(user)
    test_db.flush()

    record_user_ledger_entries(
        test_db,
        cell_key=("DEU", "BE", "cardiology"),
        period_start=date(2026, 3, 16),
        user_ids=[user.user_id],
        epsilon_per_user=5.0,
    )
    test_db.commit()

    summary = budget_monitoring_summary(test_db, year=2026, annual_cap=150.0)
    assert summary["n_users"] == 1
    assert summary["worst_case_spent"] == pytest.approx(5.0)
    assert summary["utilization_pct"] == pytest.approx(5.0 / 150.0 * 100)


def test_publication_status_warms_up_before_first_release() -> None:
    status = get_publication_status(
        was_active=False,
        consecutive_eligible=1,
        consecutive_ineligible=0,
        activation_weeks=2,
        deactivation_grace_weeks=2,
    )

    assert status == PublicationStatus.warming_up


def test_publication_status_publishes_after_activation_threshold() -> None:
    status = get_publication_status(
        was_active=False,
        consecutive_eligible=2,
        consecutive_ineligible=0,
        activation_weeks=2,
        deactivation_grace_weeks=2,
    )

    assert status == PublicationStatus.published


def test_publication_status_cools_down_before_deactivation() -> None:
    status = get_publication_status(
        was_active=True,
        consecutive_eligible=0,
        consecutive_ineligible=1,
        activation_weeks=2,
        deactivation_grace_weeks=2,
    )

    assert status == PublicationStatus.cooling_down


def test_publication_status_suppresses_after_grace_period() -> None:
    status = get_publication_status(
        was_active=True,
        consecutive_eligible=0,
        consecutive_ineligible=2,
        activation_weeks=2,
        deactivation_grace_weeks=2,
    )

    assert status == PublicationStatus.suppressed
