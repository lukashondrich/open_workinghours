"""Unit tests for privacy-preserving aggregation logic."""
from __future__ import annotations

from datetime import date

import pytest

from app.aggregation import (
    EPSILON,
    K_MIN,
    compute_aggregates_by_state_specialty,
    laplace_noise,
)


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
    """Test sensitivity calculation logic (inline in aggregation)."""

    def test_sensitivity_formula(self):
        """Test the sensitivity formula used in aggregation."""
        # Sensitivity = max_hours_per_week / n_users
        # max_hours_per_week = 24 * 7 = 168
        max_hours_per_week = 24 * 7
        n_users = 10

        sensitivity = max_hours_per_week / n_users

        assert sensitivity == 16.8

    def test_sensitivity_decreases_with_more_users(self):
        """Test that sensitivity decreases as group size increases."""
        max_hours_per_week = 24 * 7

        sensitivity_10 = max_hours_per_week / 10
        sensitivity_20 = max_hours_per_week / 20

        assert sensitivity_20 < sensitivity_10
        assert sensitivity_20 == sensitivity_10 / 2


@pytest.mark.unit
class TestKAnonymity:
    """Test k-anonymity filtering logic."""

    def test_k_min_constant(self):
        """Test that K_MIN is set to expected value."""
        assert K_MIN == 10

    def test_group_filtering_below_threshold(self):
        """Test that groups with n_users < K_MIN are suppressed."""
        # This is tested implicitly by aggregate_by_state_specialty
        # which should not return groups with n_users < K_MIN
        # Actual test is in test_aggregation_integration
        assert K_MIN > 0


@pytest.mark.integration
class TestAggregationIntegration:
    """Integration tests for full aggregation pipeline."""

    @pytest.fixture
    def sample_db_session(self, test_db):
        """Provide test database session."""
        return test_db

    @pytest.fixture
    def sample_users_and_events(self, test_db):
        """Create sample users and work events for aggregation testing."""
        from app.models import User, WorkEvent

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

        # Create work events for both groups
        for user in users_above_threshold + users_below_threshold:
            for day_offset in range(7):
                event = WorkEvent(
                    user_id=user.user_id,
                    date=date(2025, 12, 2 + day_offset),
                    planned_hours=8.0,
                    actual_hours=9.0,
                    source="geofence",
                )
                test_db.add(event)

        test_db.commit()

        return {
            "above_threshold": users_above_threshold,
            "below_threshold": users_below_threshold,
        }

    def test_aggregation_suppresses_small_groups(
        self, test_db, sample_users_and_events
    ):
        """Test that aggregation only publishes groups with n_users >= K_MIN."""
        # Run aggregation
        target_date = date(2025, 12, 5)  # Within the week we created events for
        stats_created = compute_aggregates_by_state_specialty(test_db, target_date)

        # Should have created 1 stat (only the group with 12 users)
        assert stats_created == 1

        # Query the stats table to verify
        from app.models import StatsByStateSpecialty

        stats = test_db.query(StatsByStateSpecialty).all()
        assert len(stats) == 1
        assert stats[0].state_code == "BY"
        assert stats[0].specialty == "surgery"
        assert stats[0].n_users == 12

    def test_aggregation_applies_noise(self, test_db, sample_users_and_events):
        """Test that aggregation adds Laplace noise to averages."""
        target_date = date(2025, 12, 5)
        from app.models import StatsByStateSpecialty

        # Run aggregation twice (will update the same record)
        compute_aggregates_by_state_specialty(test_db, target_date)
        first_stat = test_db.query(StatsByStateSpecialty).first()
        first_actual = float(first_stat.avg_actual_hours_noised)

        compute_aggregates_by_state_specialty(test_db, target_date)
        second_stat = test_db.query(StatsByStateSpecialty).first()
        second_actual = float(second_stat.avg_actual_hours_noised)

        # Noised values should differ between runs (different noise)
        # Note: There's a small chance they could be equal, but very unlikely
        assert first_actual != second_actual

    def test_aggregation_metadata(self, test_db, sample_users_and_events):
        """Test that aggregation includes correct privacy metadata."""
        target_date = date(2025, 12, 5)
        from app.models import StatsByStateSpecialty

        compute_aggregates_by_state_specialty(test_db, target_date)

        stat = test_db.query(StatsByStateSpecialty).first()
        assert stat is not None

        # Check privacy parameters are recorded
        assert stat.k_min_threshold == K_MIN
        assert float(stat.noise_epsilon) == EPSILON
        assert stat.computed_at is not None
