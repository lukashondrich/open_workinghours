"""Tests for taxonomy endpoints and validation."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient


@pytest.mark.integration
class TestTaxonomyStates:
    """Test GET /taxonomy/states."""

    def test_list_states_returns_16(self, client: TestClient):
        response = client.get("/taxonomy/states")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 16
        codes = {s["code"] for s in data}
        assert "BY" in codes
        assert "BE" in codes
        assert "NW" in codes

    def test_list_states_structure(self, client: TestClient):
        response = client.get("/taxonomy/states")
        data = response.json()
        for state in data:
            assert "code" in state
            assert "name" in state
            assert len(state["code"]) == 2


@pytest.mark.integration
class TestTaxonomyDepartments:
    """Test GET /taxonomy/departments."""

    def test_list_departments_returns_10_groups(self, client: TestClient):
        response = client.get("/taxonomy/departments")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 10

    def test_departments_have_specializations(self, client: TestClient):
        response = client.get("/taxonomy/departments")
        data = response.json()
        keys = {d["key"] for d in data}
        assert "innere_medizin" in keys
        assert "chirurgie" in keys
        assert "sonstige" in keys
        # Each group should have at least one specialization
        for dept in data:
            assert len(dept["specializations"]) >= 1


@pytest.mark.integration
class TestTaxonomyHospitals:
    """Test GET /taxonomy/hospitals."""

    def test_search_hospitals_default(self, client: TestClient):
        response = client.get("/taxonomy/hospitals")
        assert response.status_code == 200
        data = response.json()
        # Should return some results (up to limit=50)
        assert isinstance(data, list)
        assert len(data) <= 50

    def test_search_hospitals_by_query(self, client: TestClient):
        response = client.get("/taxonomy/hospitals", params={"q": "Charit"})
        assert response.status_code == 200
        data = response.json()
        # All results should contain "Charit" (case-insensitive)
        for h in data:
            assert "charit" in h["name"].lower()

    def test_search_hospitals_by_state(self, client: TestClient):
        response = client.get("/taxonomy/hospitals", params={"state": "Bayern"})
        assert response.status_code == 200
        data = response.json()
        for h in data:
            assert h["state"].lower() == "bayern"

    def test_search_hospitals_with_limit(self, client: TestClient):
        response = client.get("/taxonomy/hospitals", params={"limit": 5})
        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 5

    def test_search_hospitals_structure(self, client: TestClient):
        response = client.get("/taxonomy/hospitals", params={"limit": 1})
        assert response.status_code == 200
        data = response.json()
        if data:
            h = data[0]
            assert "id" in h
            assert "name" in h
            assert "city" in h
            assert "state" in h
            assert "postcode" in h
