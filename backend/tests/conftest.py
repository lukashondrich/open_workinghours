"""Pytest configuration and fixtures for backend tests."""
from __future__ import annotations

import os
from typing import Generator

# Override database URL BEFORE any app imports so database.py creates a
# SQLite engine instead of trying to connect to PostgreSQL from .env.
os.environ.setdefault("DATABASE__URL", "sqlite:///:memory:")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app

# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite:///:memory:"


@pytest.fixture(scope="function")
def test_db() -> Generator[Session, None, None]:
    """
    Create a fresh test database for each test function.

    Uses in-memory SQLite with StaticPool to ensure
    the same connection is used throughout the test.
    """
    engine = create_engine(
        TEST_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    # Create all tables
    Base.metadata.create_all(bind=engine)

    # Create session
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()

    try:
        yield db
    finally:
        db.close()
        # Drop all tables after test
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    """Reset rate limit state between every test."""
    from app.rate_limit import store
    store.reset()
    yield
    store.reset()


@pytest.fixture(scope="function")
def client(test_db: Session) -> TestClient:
    """
    Create a FastAPI test client with the test database.

    Overrides the get_db dependency to use the test database.
    """
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    # Also override router-specific _get_db_session / get_db_session functions
    # that call get_db() directly (bypassing FastAPI's dependency override system)
    from app.routers.analytics import _get_db_session as analytics_get_db
    from app.routers.auth import _get_db_session as auth_get_db
    from app.routers.reports import _get_db_session as reports_get_db
    from app.routers.stats import _get_db_session as stats_get_db
    from app.routers.submissions import _get_db_session as submissions_get_db
    from app.routers.verification import _get_db_session as verification_get_db
    from app.dependencies import get_db_session as deps_get_db
    app.dependency_overrides[analytics_get_db] = override_get_db
    app.dependency_overrides[auth_get_db] = override_get_db
    app.dependency_overrides[reports_get_db] = override_get_db
    app.dependency_overrides[stats_get_db] = override_get_db
    app.dependency_overrides[submissions_get_db] = override_get_db
    app.dependency_overrides[verification_get_db] = override_get_db
    app.dependency_overrides[deps_get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    # Clean up
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def auth_headers(client: TestClient, test_db: Session) -> dict[str, str]:
    """
    Create a test user and return JWT authentication headers.

    Usage:
        response = client.get("/work-events", headers=auth_headers)
    """
    from app.models import VerificationRequest, VerificationStatus
    from app.security import hash_email, hash_code
    from datetime import datetime, timedelta, timezone

    email = "test@example.com"
    code = "123456"
    email_hash_value = hash_email(email)
    code_hash_value = hash_code(code)

    # Create a verified email verification request (bypass actual email sending)
    verification = VerificationRequest(
        email_hash=email_hash_value,
        email_domain="example.com",
        code_hash=code_hash_value,
        status=VerificationStatus.confirmed.value,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
        confirmed_at=datetime.now(timezone.utc),
    )
    test_db.add(verification)
    test_db.commit()

    # Register a test user
    register_data = {
        "email": email,
        "hospital_id": "test-hospital",
        "specialty": "surgery",
        "role_level": "resident",
        "state_code": "BY",
    }

    response = client.post("/auth/register", json=register_data)
    assert response.status_code == 201, f"Failed to register: {response.json()}"

    token = response.json()["access_token"]

    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def sample_work_event() -> dict:
    """Sample work event payload for testing."""
    return {
        "date": "2025-12-09",
        "planned_hours": 8.0,
        "actual_hours": 9.5,
        "source": "geofence",
    }
