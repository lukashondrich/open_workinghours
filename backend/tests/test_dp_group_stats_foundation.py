from __future__ import annotations

from datetime import date

import pytest

from app.dp_group_stats.accounting import (
    EpsilonBreakdown,
    EpsilonLedger,
    record_state_specialty_ledger_entry,
    record_user_ledger_entries,
    state_specialty_entries_for_cell,
    state_specialty_spent,
    user_cumulative_spent,
)
from app.dp_group_stats.config import (
    ContributionBounds,
    DPGroupStatsV1Config,
    EpsilonSplit,
    ReleasePolicyConfig,
)
from app.dp_group_stats.mechanisms import laplace_noise
from app.dp_group_stats.policy import PublicationStatus, get_publication_status


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
    assert bounds.clip_actual(180.0) == 140.0


def test_epsilon_split_total() -> None:
    split = EpsilonSplit(planned_sum=0.3, actual_sum=0.7)

    assert split.total == pytest.approx(1.0)


def test_epsilon_split_defaults() -> None:
    split = EpsilonSplit()
    assert split.planned_sum == 0.3
    assert split.actual_sum == 0.7
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
    assert config.annual_epsilon_cap is None

    # Cap that allows the default budget: 1.0 * 52 = 52.0
    config = DPGroupStatsV1Config(annual_epsilon_cap=52.0)
    assert config.annual_epsilon_cap == 52.0

    # Cap too low for the default budget
    with pytest.raises(ValueError, match="exceeds annual cap"):
        DPGroupStatsV1Config(annual_epsilon_cap=10.0)


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
    breakdown = EpsilonBreakdown(planned_sum=0.3, actual_sum=0.7)
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
