"""Integration tests for privacy-preserving statistics endpoints."""
from __future__ import annotations

from datetime import date

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
                role_level="all",
                period_start=date(2025, 12, 2),
                period_end=date(2025, 12, 8),
                n_users=15,
                avg_planned_hours_noised=40.5,
                avg_actual_hours_noised=43.2,
                avg_overtime_hours_noised=2.7,
                publication_status="published",
                k_min_threshold=11,
                noise_epsilon=1.0,
            ),
            StatsByStateSpecialty(
                country_code="DEU",
                state_code="BE",
                specialty="emergency",
                role_level="all",
                period_start=date(2025, 12, 2),
                period_end=date(2025, 12, 8),
                n_users=12,
                avg_planned_hours_noised=45.1,
                avg_actual_hours_noised=48.8,
                avg_overtime_hours_noised=3.7,
                publication_status="published",
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
        assert "planned_mean_hours" in stat
        assert "overtime_mean_hours" in stat
        assert "status" in stat
        assert "n_users" not in stat
        assert "role_level" not in stat
        assert stat["status"] == "published"

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
        assert "published_records" in data
        assert "suppressed_records" in data
        assert "earliest_period" in data
        assert "latest_period" in data
        assert "states" in data
        assert "specialties" in data

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
            # This one has n_users < 10 (should appear as suppressed)
            StatsByStateSpecialty(
                country_code="DEU",
                state_code="HH",
                specialty="pediatrics",
                role_level="all",
                period_start=date(2025, 12, 2),
                period_end=date(2025, 12, 8),
                n_users=5,  # Below threshold
                avg_planned_hours_noised=40.0,
                avg_actual_hours_noised=42.0,
                avg_overtime_hours_noised=2.0,
                publication_status="suppressed",
                k_min_threshold=10,
                noise_epsilon=1.0,
            ),
            # This one is still warming up internally and should still appear as suppressed publicly.
            StatsByStateSpecialty(
                country_code="DEU",
                state_code="SN",
                specialty="neurology",
                role_level="all",
                period_start=date(2025, 12, 2),
                period_end=date(2025, 12, 8),
                n_users=15,
                avg_planned_hours_noised=41.0,
                avg_actual_hours_noised=44.0,
                avg_overtime_hours_noised=3.0,
                publication_status="warming_up",
                k_min_threshold=10,
                noise_epsilon=1.0,
            ),
            # This one is fully published.
            StatsByStateSpecialty(
                country_code="DEU",
                state_code="NW",
                specialty="internal_medicine",
                role_level="all",
                period_start=date(2025, 12, 2),
                period_end=date(2025, 12, 8),
                n_users=18,
                avg_planned_hours_noised=38.5,
                avg_actual_hours_noised=41.2,
                avg_overtime_hours_noised=2.7,
                publication_status="published",
                k_min_threshold=10,
                noise_epsilon=1.0,
            ),
        ]
        for stat in stats:
            test_db.add(stat)
        test_db.commit()

    def test_suppressed_groups_are_generic_in_public_api(self, client: TestClient, test_db: Session):
        """Test that low-n groups appear only as generically suppressed."""
        response = client.get("/stats/by-state-specialty")

        assert response.status_code == 200
        data = response.json()

        suppressed = next(stat for stat in data if stat["state_code"] == "HH")
        warming_up = next(stat for stat in data if stat["state_code"] == "SN")
        published = next(stat for stat in data if stat["state_code"] == "NW")

        assert suppressed["status"] == "suppressed"
        assert suppressed["planned_mean_hours"] is None
        assert suppressed["overtime_mean_hours"] is None

        assert warming_up["status"] == "suppressed"
        assert warming_up["planned_mean_hours"] is None
        assert warming_up["overtime_mean_hours"] is None

        assert published["status"] == "published"
        assert published["planned_mean_hours"] is not None
        assert published["overtime_mean_hours"] is not None
