"""Integration tests for privacy-preserving statistics endpoints."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import StatsByStateSpecialty


@pytest.mark.integration
class TestStatsEndpoints:
    """Test stats query endpoints."""

    @pytest.fixture(autouse=True)
    def setup_stats_data(self, test_db: Session):
        """Create sample stats data for testing."""
        stats = [
            StatsByStateSpecialty(
                country_code="DEU",
                state_code="BY",
                specialty="surgery",
                role_level="specialist",
                period_start="2025-12-02",
                period_end="2025-12-08",
                n_users=15,
                avg_planned_hours_noised=40.5,
                avg_actual_hours_noised=43.2,
                avg_overtime_hours_noised=2.7,
                k_min_threshold=11,
                noise_epsilon=1.0,
            ),
            StatsByStateSpecialty(
                country_code="DEU",
                state_code="BE",
                specialty="emergency",
                role_level="resident",
                period_start="2025-12-02",
                period_end="2025-12-08",
                n_users=12,
                avg_planned_hours_noised=45.1,
                avg_actual_hours_noised=48.8,
                avg_overtime_hours_noised=3.7,
                k_min_threshold=11,
                noise_epsilon=1.0,
            ),
        ]
        for stat in stats:
            test_db.add(stat)
        test_db.commit()

    def test_get_all_stats(self, client: TestClient):
        """Test querying all statistics."""
        response = client.get("/stats/by-state-specialty")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2

        # Check first stat
        stat = data[0]
        assert "state_code" in stat
        assert "specialty" in stat
        assert "n_users" in stat
        assert "avg_planned_hours_noised" in stat
        assert stat["n_users"] >= 10  # K-anonymity threshold

    def test_filter_by_state(self, client: TestClient):
        """Test filtering stats by state."""
        response = client.get("/stats/by-state-specialty?state_code=BY")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert all(stat["state_code"] == "BY" for stat in data)

    def test_filter_by_specialty(self, client: TestClient):
        """Test filtering stats by specialty."""
        response = client.get("/stats/by-state-specialty?specialty=surgery")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert all(stat["specialty"] == "surgery" for stat in data)

    def test_filter_by_role(self, client: TestClient):
        """Test filtering stats by role level."""
        response = client.get("/stats/by-state-specialty?role_level=specialist")

        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert all(stat["role_level"] == "specialist" for stat in data)

    def test_pagination(self, client: TestClient):
        """Test pagination parameters."""
        response = client.get("/stats/by-state-specialty?limit=1&offset=0")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

    def test_get_latest_stats(self, client: TestClient):
        """Test getting latest period stats."""
        response = client.get("/stats/by-state-specialty/latest")

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

        if len(data) > 0:
            # All stats should have the same period_start (most recent)
            periods = set(stat["period_start"] for stat in data)
            assert len(periods) == 1

    def test_get_stats_summary(self, client: TestClient):
        """Test stats summary metadata endpoint."""
        response = client.get("/stats/summary")

        assert response.status_code == 200
        data = response.json()
        assert "total_records" in data
        assert "earliest_period" in data
        assert "latest_period" in data
        assert "states" in data
        assert "specialties" in data
        assert "roles" in data
        assert "total_users_in_sets" in data

        assert data["total_records"] >= 2
        assert isinstance(data["states"], list)
        assert isinstance(data["specialties"], list)


@pytest.mark.integration
class TestStatsPrivacyProperties:
    """Test that stats endpoints enforce privacy properties."""

    @pytest.fixture(autouse=True)
    def setup_mixed_data(self, test_db: Session):
        """Create stats with different n_users values."""
        stats = [
            # This one has n_users < 10 (should not appear in results)
            StatsByStateSpecialty(
                country_code="DEU",
                state_code="HH",
                specialty="pediatrics",
                role_level="resident",
                period_start="2025-12-02",
                period_end="2025-12-08",
                n_users=5,  # Below threshold
                avg_planned_hours_noised=40.0,
                avg_actual_hours_noised=42.0,
                avg_overtime_hours_noised=2.0,
                k_min_threshold=10,
                noise_epsilon=1.0,
            ),
            # This one has n_users >= 10 (should appear)
            StatsByStateSpecialty(
                country_code="DEU",
                state_code="NW",
                specialty="internal_medicine",
                role_level="specialist",
                period_start="2025-12-02",
                period_end="2025-12-08",
                n_users=18,
                avg_planned_hours_noised=38.5,
                avg_actual_hours_noised=41.2,
                avg_overtime_hours_noised=2.7,
                k_min_threshold=10,
                noise_epsilon=1.0,
            ),
        ]
        for stat in stats:
            test_db.add(stat)
        test_db.commit()

    def test_only_k_anonymous_groups_published(self, client: TestClient, test_db: Session):
        """Test that only groups with n_users >= K_MIN are accessible via API."""
        response = client.get("/stats/by-state-specialty")

        assert response.status_code == 200
        data = response.json()

        # All returned stats should have n_users >= 10
        for stat in data:
            assert stat["n_users"] >= 10

        # Verify the suppressed stat is not in results
        assert not any(stat["state_code"] == "HH" and stat["specialty"] == "pediatrics" for stat in data)

        # Verify the published stat is in results
        assert any(stat["state_code"] == "NW" and stat["specialty"] == "internal_medicine" for stat in data)
