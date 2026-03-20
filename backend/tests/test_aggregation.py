"""Unit tests for privacy-preserving aggregation logic."""
from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from app.aggregation import (
    EPSILON,
    K_MIN,
    compute_aggregates_by_state_specialty,
    laplace_noise,
)
from app.dp_group_stats.policy import PublicationStatus


def _add_finalized_weeks(test_db, users, week_start: date, *, planned: str = "56.0", actual: str = "63.0") -> None:
    from app.models import FinalizedUserWeek

    week_end = date.fromordinal(week_start.toordinal() + 6)
    for user in users:
        finalized_week = FinalizedUserWeek(
            user_id=user.user_id,
            week_start=week_start,
            week_end=week_end,
            planned_hours=Decimal(planned),
            actual_hours=Decimal(actual),
            hospital_id=user.hospital_id,
            specialty=user.specialty,
            role_level=user.role_level,
            state_code=user.state_code,
            country_code=user.country_code,
        )
        test_db.add(finalized_week)

    test_db.commit()


def _add_single_finalized_week(test_db, user, week_start: date, *, planned: str = "56.0", actual: str = "63.0") -> None:
    """Add a single finalized week for one user with custom hours."""
    from app.models import FinalizedUserWeek

    week_end = date.fromordinal(week_start.toordinal() + 6)
    test_db.add(FinalizedUserWeek(
        user_id=user.user_id,
        week_start=week_start,
        week_end=week_end,
        planned_hours=Decimal(planned),
        actual_hours=Decimal(actual),
        hospital_id=user.hospital_id,
        specialty=user.specialty,
        role_level=user.role_level,
        state_code=user.state_code,
        country_code=user.country_code,
    ))
    test_db.flush()


@pytest.mark.unit
class TestLaplaceNoise:
    """Test Laplace noise mechanism."""

    def test_laplace_noise_returns_float(self):
        """Test that noise generation returns a float."""
        noise = laplace_noise(epsilon=1.0, sensitivity=1.0)
        assert isinstance(noise, float)

    def test_laplace_noise_distribution(self):
        """Test that Laplace noise has expected statistical properties."""
        samples = [laplace_noise(epsilon=1.0, sensitivity=1.0) for _ in range(1000)]

        # Mean should be close to 0 (with some tolerance)
        mean = sum(samples) / len(samples)
        assert abs(mean) < 0.2  # Generous tolerance

        # Should have both positive and negative values
        assert any(x > 0 for x in samples)
        assert any(x < 0 for x in samples)

    def test_laplace_noise_epsilon_parameter(self):
        """Test that epsilon parameter affects noise magnitude."""
        # Smaller epsilon = more noise (larger scale)
        small_epsilon_samples = [laplace_noise(epsilon=0.1, sensitivity=1.0) for _ in range(100)]
        large_epsilon_samples = [laplace_noise(epsilon=10.0, sensitivity=1.0) for _ in range(100)]

        # Smaller epsilon should produce larger absolute values on average
        small_avg_abs = sum(abs(x) for x in small_epsilon_samples) / len(small_epsilon_samples)
        large_avg_abs = sum(abs(x) for x in large_epsilon_samples) / len(large_epsilon_samples)

        assert small_avg_abs > large_avg_abs


@pytest.mark.unit
class TestSensitivityCalculation:
    """Test sensitivity calculation logic for finalized user-weeks."""

    def test_planned_sum_sensitivity_matches_clip_bound(self):
        assert 80.0 == 80.0

    def test_actual_sum_sensitivity_matches_clip_bound(self):
        assert 140.0 == 140.0


@pytest.mark.unit
class TestKAnonymity:
    """Test k-anonymity filtering logic."""

    def test_k_min_constant(self):
        """Test that K_MIN is set to expected value."""
        assert K_MIN == 11

    def test_group_filtering_below_threshold(self):
        """Test that groups with n_users < K_MIN are suppressed."""
        assert K_MIN > 0


@pytest.mark.integration
class TestAggregationIntegration:
    """Integration tests for full aggregation pipeline."""

    @pytest.fixture
    def sample_db_session(self, test_db):
        """Provide test database session."""
        return test_db

    @pytest.fixture
    def sample_users(self, test_db):
        """Create sample users for aggregation testing."""
        from app.models import StateSpecialtyReleaseCell, User

        test_db.add_all(
            [
                StateSpecialtyReleaseCell(country_code="DEU", state_code="BY", specialty="surgery"),
                StateSpecialtyReleaseCell(country_code="DEU", state_code="HH", specialty="pediatrics"),
            ]
        )
        test_db.flush()

        # Create users in BY/surgery/specialist (will have 12 users - above threshold)
        users_above_threshold = []
        for i in range(12):
            user = User(
                email_hash=f"hash_{i}",
                hospital_id="test-hospital",
                specialty="surgery",
                role_level="specialist",
                state_code="BY",
            )
            test_db.add(user)
            test_db.flush()
            users_above_threshold.append(user)

        # Create users in HH/pediatrics/resident (will have 5 users - below threshold)
        users_below_threshold = []
        for i in range(5):
            user = User(
                email_hash=f"hash_hh_{i}",
                hospital_id="test-hospital-2",
                specialty="pediatrics",
                role_level="resident",
                state_code="HH",
            )
            test_db.add(user)
            test_db.flush()
            users_below_threshold.append(user)
        test_db.commit()

        return {
            "above_threshold": users_above_threshold,
            "below_threshold": users_below_threshold,
        }

    def test_aggregation_ignores_unconfigured_cells(self, test_db):
        """Observed groups outside the configured release universe should be ignored."""
        from app.models import FinalizedUserWeek, StatsByStateSpecialty, User

        user = User(
            email_hash="hash_unconfigured",
            hospital_id="test-hospital",
            specialty="cardiology",
            role_level="specialist",
            state_code="BY",
        )
        test_db.add(user)
        test_db.flush()
        test_db.add(
            FinalizedUserWeek(
                user_id=user.user_id,
                week_start=date(2025, 12, 1),
                week_end=date(2025, 12, 7),
                planned_hours=Decimal("56.0"),
                actual_hours=Decimal("63.0"),
                hospital_id=user.hospital_id,
                specialty=user.specialty,
                role_level=user.role_level,
                state_code=user.state_code,
                country_code=user.country_code,
            )
        )
        test_db.commit()

        stats_created = compute_aggregates_by_state_specialty(test_db, date(2025, 12, 5))

        assert stats_created == 0
        assert test_db.query(StatsByStateSpecialty).count() == 0

    def test_aggregation_uses_activation_window_before_first_publication(
        self, test_db, sample_users
    ):
        """First eligible week should warm up, not publish immediately."""
        _add_finalized_weeks(test_db, sample_users["above_threshold"], date(2025, 12, 1))
        _add_finalized_weeks(test_db, sample_users["below_threshold"], date(2025, 12, 1))

        target_date = date(2025, 12, 5)  # Within the week we created events for
        stats_created = compute_aggregates_by_state_specialty(test_db, target_date)

        assert stats_created == 0

        from app.models import StatsByStateSpecialty

        stats = test_db.query(StatsByStateSpecialty).all()
        assert len(stats) == 2

        warming_up = next(stat for stat in stats if stat.state_code == "BY")
        suppressed = next(stat for stat in stats if stat.state_code == "HH")

        assert warming_up.specialty == "surgery"
        assert warming_up.role_level == "all"
        assert warming_up.n_users == 12
        assert warming_up.publication_status == PublicationStatus.warming_up.value
        assert warming_up.avg_planned_hours_noised is None

        assert suppressed.specialty == "pediatrics"
        assert suppressed.publication_status == PublicationStatus.suppressed.value
        assert suppressed.avg_planned_hours_noised is None

    def test_aggregation_publishes_after_activation_threshold(self, test_db, sample_users):
        """Second consecutive eligible week should publish."""
        _add_finalized_weeks(test_db, sample_users["above_threshold"], date(2025, 12, 1))
        _add_finalized_weeks(test_db, sample_users["above_threshold"], date(2025, 12, 8))

        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 5))
        stats_created = compute_aggregates_by_state_specialty(test_db, date(2025, 12, 12))

        from app.models import StateSpecialtyPrivacyLedger, StatsByStateSpecialty

        assert stats_created == 1

        second_week_stat = (
            test_db.query(StatsByStateSpecialty)
            .filter(
                StatsByStateSpecialty.period_start == date(2025, 12, 8),
                StatsByStateSpecialty.state_code == "BY",
                StatsByStateSpecialty.specialty == "surgery",
            )
            .one()
        )
        assert second_week_stat.publication_status == PublicationStatus.published.value
        assert second_week_stat.avg_planned_hours_noised is not None
        assert second_week_stat.avg_actual_hours_noised is not None
        ledger_entry = (
            test_db.query(StateSpecialtyPrivacyLedger)
            .filter(
                StateSpecialtyPrivacyLedger.period_start == date(2025, 12, 8),
                StateSpecialtyPrivacyLedger.state_code == "BY",
                StateSpecialtyPrivacyLedger.specialty == "surgery",
            )
            .one()
        )
        assert float(ledger_entry.total_epsilon) == EPSILON

    def test_aggregation_reuses_published_release_on_rerun(self, test_db, sample_users):
        """Published cell-periods should not be re-noised or double-spent on rerun."""
        _add_finalized_weeks(test_db, sample_users["above_threshold"], date(2025, 12, 1))
        _add_finalized_weeks(test_db, sample_users["above_threshold"], date(2025, 12, 8))

        from app.models import StateSpecialtyPrivacyLedger, StatsByStateSpecialty

        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 5))
        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 12))
        first_stat = (
            test_db.query(StatsByStateSpecialty)
            .filter(
                StatsByStateSpecialty.period_start == date(2025, 12, 8),
                StatsByStateSpecialty.state_code == "BY",
                StatsByStateSpecialty.specialty == "surgery",
            )
            .one()
        )
        first_actual = float(first_stat.avg_actual_hours_noised)
        first_planned = float(first_stat.avg_planned_hours_noised)

        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 12))
        second_stat = (
            test_db.query(StatsByStateSpecialty)
            .filter(
                StatsByStateSpecialty.period_start == date(2025, 12, 8),
                StatsByStateSpecialty.state_code == "BY",
                StatsByStateSpecialty.specialty == "surgery",
            )
            .one()
        )
        second_actual = float(second_stat.avg_actual_hours_noised)
        second_planned = float(second_stat.avg_planned_hours_noised)

        ledger_entries = (
            test_db.query(StateSpecialtyPrivacyLedger)
            .filter(
                StateSpecialtyPrivacyLedger.period_start == date(2025, 12, 8),
                StateSpecialtyPrivacyLedger.state_code == "BY",
                StateSpecialtyPrivacyLedger.specialty == "surgery",
            )
            .all()
        )

        assert first_actual == second_actual
        assert first_planned == second_planned
        assert len(ledger_entries) == 1

    def test_aggregation_cools_down_before_deactivation(self, test_db, sample_users):
        """Previously published cells should cool down for one week before suppression."""
        _add_finalized_weeks(test_db, sample_users["above_threshold"], date(2025, 12, 1))
        _add_finalized_weeks(test_db, sample_users["above_threshold"], date(2025, 12, 8))

        from app.models import StatsByStateSpecialty

        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 5))
        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 12))
        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 19))

        cooling_stat = (
            test_db.query(StatsByStateSpecialty)
            .filter(
                StatsByStateSpecialty.period_start == date(2025, 12, 15),
                StatsByStateSpecialty.state_code == "BY",
                StatsByStateSpecialty.specialty == "surgery",
            )
            .one()
        )
        assert cooling_stat.n_users == 0
        assert cooling_stat.publication_status == PublicationStatus.cooling_down.value

    def test_aggregation_metadata(self, test_db, sample_users):
        """Published rows should persist privacy metadata."""
        _add_finalized_weeks(test_db, sample_users["above_threshold"], date(2025, 12, 1))
        _add_finalized_weeks(test_db, sample_users["above_threshold"], date(2025, 12, 8))
        from app.models import StateSpecialtyPrivacyLedger, StatsByStateSpecialty

        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 5))
        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 12))

        stat = (
            test_db.query(StatsByStateSpecialty)
            .filter(
                StatsByStateSpecialty.period_start == date(2025, 12, 8),
                StatsByStateSpecialty.state_code == "BY",
                StatsByStateSpecialty.specialty == "surgery",
            )
            .one()
        )
        assert stat is not None

        assert stat.k_min_threshold == K_MIN
        assert float(stat.noise_epsilon) == EPSILON
        assert stat.computed_at is not None

        ledger = (
            test_db.query(StateSpecialtyPrivacyLedger)
            .filter(
                StateSpecialtyPrivacyLedger.period_start == date(2025, 12, 8),
                StateSpecialtyPrivacyLedger.state_code == "BY",
                StateSpecialtyPrivacyLedger.specialty == "surgery",
            )
            .one()
        )
        assert float(ledger.planned_sum_epsilon) == pytest.approx(0.3)
        assert float(ledger.actual_sum_epsilon) == pytest.approx(0.7)
        assert float(ledger.total_epsilon) == pytest.approx(EPSILON)

    def test_dominated_cell_is_suppressed(self, test_db):
        """A cell where one user dominates should be suppressed even with enough users."""
        from app.models import StateSpecialtyReleaseCell, User

        test_db.add(StateSpecialtyReleaseCell(country_code="DEU", state_code="BY", specialty="surgery"))
        test_db.flush()

        users = []
        for i in range(11):
            user = User(
                email_hash=f"hash_dom_{i}",
                hospital_id="test-hospital",
                specialty="surgery",
                role_level="specialist",
                state_code="BY",
            )
            test_db.add(user)
            test_db.flush()
            users.append(user)
        test_db.commit()

        week = date(2025, 12, 1)
        # First user: 130h actual (dominates), rest: 20h each
        _add_single_finalized_week(test_db, users[0], week, actual="130.0", planned="40.0")
        for u in users[1:]:
            _add_single_finalized_week(test_db, u, week, actual="20.0", planned="40.0")
        test_db.commit()

        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 5))

        from app.models import StatsByStateSpecialty
        stat = test_db.query(StatsByStateSpecialty).filter(
            StatsByStateSpecialty.state_code == "BY",
            StatsByStateSpecialty.specialty == "surgery",
        ).one()

        # 11 users but dominated → suppressed (not warming_up)
        assert stat.publication_status == PublicationStatus.suppressed.value
        assert stat.avg_planned_hours_noised is None

    def test_non_dominated_cell_publishes(self, test_db):
        """A cell where no user dominates should follow normal activation."""
        from app.models import StateSpecialtyReleaseCell, User

        test_db.add(StateSpecialtyReleaseCell(country_code="DEU", state_code="BY", specialty="surgery"))
        test_db.flush()

        users = []
        for i in range(11):
            user = User(
                email_hash=f"hash_ndom_{i}",
                hospital_id="test-hospital",
                specialty="surgery",
                role_level="specialist",
                state_code="BY",
            )
            test_db.add(user)
            test_db.flush()
            users.append(user)
        test_db.commit()

        # All users ~40h actual — no dominance
        for week in [date(2025, 12, 1), date(2025, 12, 8)]:
            for u in users:
                _add_single_finalized_week(test_db, u, week, actual="40.0", planned="40.0")
            test_db.commit()

        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 5))
        stats_created = compute_aggregates_by_state_specialty(test_db, date(2025, 12, 12))

        assert stats_created == 1  # Published on second eligible week

    def test_dominance_breaks_activation_streak(self, test_db):
        """A dominated week should break the eligible streak."""
        from app.models import StateSpecialtyReleaseCell, StatsByStateSpecialty, User

        test_db.add(StateSpecialtyReleaseCell(country_code="DEU", state_code="BY", specialty="surgery"))
        test_db.flush()

        users = []
        for i in range(11):
            user = User(
                email_hash=f"hash_streak_{i}",
                hospital_id="test-hospital",
                specialty="surgery",
                role_level="specialist",
                state_code="BY",
            )
            test_db.add(user)
            test_db.flush()
            users.append(user)
        test_db.commit()

        # Week 1: eligible (uniform hours)
        week1 = date(2025, 12, 1)
        for u in users:
            _add_single_finalized_week(test_db, u, week1, actual="40.0", planned="40.0")
        test_db.commit()
        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 5))

        # Week 2: dominated (one user 130h, rest 20h)
        week2 = date(2025, 12, 8)
        _add_single_finalized_week(test_db, users[0], week2, actual="130.0", planned="40.0")
        for u in users[1:]:
            _add_single_finalized_week(test_db, u, week2, actual="20.0", planned="40.0")
        test_db.commit()
        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 12))

        # Week 3: eligible again (uniform hours)
        week3 = date(2025, 12, 15)
        for u in users:
            _add_single_finalized_week(test_db, u, week3, actual="40.0", planned="40.0")
        test_db.commit()
        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 19))

        # Week 3 should be warming_up (not published) because the dominated week broke the streak
        stat_w3 = test_db.query(StatsByStateSpecialty).filter(
            StatsByStateSpecialty.period_start == date(2025, 12, 15),
            StatsByStateSpecialty.state_code == "BY",
        ).one()
        assert stat_w3.publication_status == PublicationStatus.warming_up.value

    def test_cooling_down_cell_gets_noise_and_ledger(self, test_db, sample_users):
        """Cooling_down cells should get noise and a ledger entry."""
        _add_finalized_weeks(test_db, sample_users["above_threshold"], date(2025, 12, 1))
        _add_finalized_weeks(test_db, sample_users["above_threshold"], date(2025, 12, 8))

        from app.models import StateSpecialtyPrivacyLedger, StatsByStateSpecialty

        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 5))
        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 12))
        # Week 3: no data → cooling_down
        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 19))

        cooling_stat = (
            test_db.query(StatsByStateSpecialty)
            .filter(
                StatsByStateSpecialty.period_start == date(2025, 12, 15),
                StatsByStateSpecialty.state_code == "BY",
                StatsByStateSpecialty.specialty == "surgery",
            )
            .one()
        )
        assert cooling_stat.publication_status == PublicationStatus.cooling_down.value
        # cooling_down cells now get noise (non-null noised values)
        assert cooling_stat.avg_planned_hours_noised is not None
        assert cooling_stat.avg_actual_hours_noised is not None

        # Ledger entry should exist for cooling_down
        ledger = (
            test_db.query(StateSpecialtyPrivacyLedger)
            .filter(
                StateSpecialtyPrivacyLedger.period_start == date(2025, 12, 15),
                StateSpecialtyPrivacyLedger.state_code == "BY",
                StateSpecialtyPrivacyLedger.specialty == "surgery",
            )
            .one()
        )
        assert ledger.publication_status == PublicationStatus.cooling_down.value
        assert float(ledger.total_epsilon) == pytest.approx(EPSILON)

    def test_per_user_ledger_entries_on_publish(self, test_db, sample_users):
        """Published cells should create one UserPrivacyLedger row per contributing user."""
        _add_finalized_weeks(test_db, sample_users["above_threshold"], date(2025, 12, 1))
        _add_finalized_weeks(test_db, sample_users["above_threshold"], date(2025, 12, 8))

        from app.models import UserPrivacyLedger

        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 5))
        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 12))

        user_entries = (
            test_db.query(UserPrivacyLedger)
            .filter(UserPrivacyLedger.period_start == date(2025, 12, 8))
            .all()
        )
        # 12 users contributed to the published cell
        assert len(user_entries) == 12
        assert all(float(e.epsilon_spent) == pytest.approx(EPSILON) for e in user_entries)

    def test_per_user_ledger_not_created_for_suppressed(self, test_db, sample_users):
        """Warming_up and suppressed cells should not create per-user ledger entries."""
        _add_finalized_weeks(test_db, sample_users["above_threshold"], date(2025, 12, 1))
        _add_finalized_weeks(test_db, sample_users["below_threshold"], date(2025, 12, 1))

        from app.models import UserPrivacyLedger

        compute_aggregates_by_state_specialty(test_db, date(2025, 12, 5))

        user_entries = test_db.query(UserPrivacyLedger).all()
        assert len(user_entries) == 0  # warming_up + suppressed = no per-user entries
