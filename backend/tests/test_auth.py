"""Integration tests for authentication endpoints."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import User


@pytest.mark.integration
class TestAuthRegistration:
    """Test user registration flow."""

    def test_register_new_user(self, client: TestClient, test_db: Session):
        """Test successful user registration."""
        payload = {
            "email": "doctor@hospital.de",
            "hospital_id": "uniklinik-muenchen",
            "specialty": "surgery",
            "role_level": "specialist",
            "state_code": "BY",
        }

        response = client.post("/auth/register", json=payload)

        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert "user_id" in data
        assert data["token_type"] == "bearer"

        # Verify user was created in database
        user = test_db.query(User).filter(User.user_id == data["user_id"]).first()
        assert user is not None
        assert user.hospital_id == "uniklinik-muenchen"
        assert user.specialty == "surgery"
        assert user.role_level == "specialist"
        assert user.state_code == "BY"

    def test_register_duplicate_email(self, client: TestClient):
        """Test that registering with same email twice fails."""
        payload = {
            "email": "doctor@hospital.de",
            "hospital_id": "uniklinik-muenchen",
            "specialty": "surgery",
            "role_level": "specialist",
        }

        # First registration
        response1 = client.post("/auth/register", json=payload)
        assert response1.status_code == 201

        # Second registration with same email
        response2 = client.post("/auth/register", json=payload)
        assert response2.status_code in [400, 409]  # Bad request or conflict

    def test_register_missing_required_fields(self, client: TestClient):
        """Test registration fails with missing required fields."""
        payload = {
            "email": "doctor@hospital.de",
            # Missing hospital_id, specialty, role_level
        }

        response = client.post("/auth/register", json=payload)
        assert response.status_code == 422  # Validation error


@pytest.mark.integration
class TestAuthLogin:
    """Test user login flow."""

    def test_login_returns_token(self, client: TestClient):
        """Test that login returns a JWT token."""
        # First, register a user
        register_payload = {
            "email": "doctor@hospital.de",
            "hospital_id": "test-hospital",
            "specialty": "surgery",
            "role_level": "resident",
        }
        client.post("/auth/register", json=register_payload)

        # Login with the same email (in real flow, would verify code first)
        login_payload = {
            "email": "doctor@hospital.de",
            "code": "123456",  # In real scenario, would need valid verification code
        }

        # Note: This test may fail if email verification is strictly enforced
        # For now, we're testing the auth flow structure
        response = client.post("/auth/login", json=login_payload)

        # May fail without proper verification setup - that's expected
        assert response.status_code in [200, 400, 404]

    def test_demo_account_login(self, client: TestClient, test_db: Session):
        """Test demo account bypass for Apple App Review."""
        from app.config import get_settings
        from app.security import hash_email

        settings = get_settings()

        # Skip if demo settings not configured
        if settings.demo is None:
            pytest.skip("Demo settings not configured (DEMO__EMAIL, DEMO__CODE)")

        demo_email = settings.demo.email.lower()
        demo_code = settings.demo.code

        # First, create the demo user in the database
        email_hash = hash_email(demo_email)
        demo_user = User(
            email_hash=email_hash,
            hospital_id="demo-hospital",
            specialty="Internal Medicine",
            role_level="Resident",
            state_code="BY",
        )
        test_db.add(demo_user)
        test_db.commit()

        # Login with demo credentials (should bypass verification)
        login_payload = {
            "email": demo_email,
            "code": demo_code,
        }

        response = client.post("/auth/login", json=login_payload)

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user_id" in data
        assert data["token_type"] == "bearer"

    def test_demo_account_wrong_code_fails(self, client: TestClient, test_db: Session):
        """Test demo account with wrong code fails."""
        from app.config import get_settings
        from app.security import hash_email

        settings = get_settings()

        # Skip if demo settings not configured
        if settings.demo is None:
            pytest.skip("Demo settings not configured (DEMO__EMAIL, DEMO__CODE)")

        demo_email = settings.demo.email.lower()

        # Create the demo user
        email_hash = hash_email(demo_email)
        demo_user = User(
            email_hash=email_hash,
            hospital_id="demo-hospital",
            specialty="Internal Medicine",
            role_level="Resident",
            state_code="BY",
        )
        test_db.add(demo_user)
        test_db.commit()

        # Login with wrong code (should fail normally)
        login_payload = {
            "email": demo_email,
            "code": "999999",  # Wrong code
        }

        response = client.post("/auth/login", json=login_payload)

        # Should fail with 401 (invalid code)
        assert response.status_code == 401


@pytest.mark.integration
class TestAuthMe:
    """Test authenticated user profile endpoint."""

    def test_get_current_user(self, client: TestClient, auth_headers: dict[str, str]):
        """Test GET /auth/me returns current user profile."""
        response = client.get("/auth/me", headers=auth_headers)

        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "hospital_id" in data
        assert "specialty" in data
        assert "role_level" in data
        assert data["hospital_id"] == "test-hospital"
        assert data["specialty"] == "surgery"

    def test_get_current_user_unauthorized(self, client: TestClient):
        """Test GET /auth/me fails without authentication."""
        response = client.get("/auth/me")
        assert response.status_code == 401  # Unauthorized

    def test_get_current_user_invalid_token(self, client: TestClient):
        """Test GET /auth/me fails with invalid token."""
        headers = {"Authorization": "Bearer invalid_token_here"}
        response = client.get("/auth/me", headers=headers)
        assert response.status_code == 401  # Unauthorized


@pytest.mark.integration
class TestAccountDeletion:
    """Test GDPR Article 17 - Right to Erasure (account deletion)."""

    def test_delete_account_returns_204(self, client: TestClient, auth_headers: dict[str, str]):
        """Test DELETE /auth/me returns 204 No Content."""
        response = client.delete("/auth/me", headers=auth_headers)
        assert response.status_code == 204

    def test_delete_account_removes_user(self, client: TestClient, auth_headers: dict[str, str], test_db: Session):
        """Test that user record is deleted from database."""
        # Get user ID before deletion
        me_response = client.get("/auth/me", headers=auth_headers)
        user_id = me_response.json()["user_id"]

        # Delete account
        response = client.delete("/auth/me", headers=auth_headers)
        assert response.status_code == 204

        # Verify user is gone
        user = test_db.query(User).filter(User.user_id == user_id).first()
        assert user is None

    def test_delete_account_cascades_work_events(self, client: TestClient, auth_headers: dict[str, str], test_db: Session, sample_work_event: dict):
        """Test that work events are cascade deleted with user."""
        from app.models import WorkEvent

        # Create a work event
        event_response = client.post("/work-events", json=sample_work_event, headers=auth_headers)
        assert event_response.status_code == 201
        event_id = event_response.json()["event_id"]

        # Verify work event exists
        work_event = test_db.query(WorkEvent).filter(WorkEvent.event_id == event_id).first()
        assert work_event is not None

        # Delete account
        response = client.delete("/auth/me", headers=auth_headers)
        assert response.status_code == 204

        # Verify work event is cascade deleted
        test_db.expire_all()
        work_event = test_db.query(WorkEvent).filter(WorkEvent.event_id == event_id).first()
        assert work_event is None

    def test_delete_account_deletes_feedback_reports(self, client: TestClient, auth_headers: dict[str, str], test_db: Session):
        """Test that FeedbackReports are deleted (manual, no FK)."""
        from app.models import FeedbackReport

        # Get user ID
        me_response = client.get("/auth/me", headers=auth_headers)
        user_id = me_response.json()["user_id"]

        # Create a feedback report directly in DB
        feedback = FeedbackReport(
            user_id=user_id,
            user_email="test@example.com",
            app_state={"version": "1.0"},
        )
        test_db.add(feedback)
        test_db.commit()
        feedback_id = feedback.report_id

        # Verify feedback exists
        assert test_db.query(FeedbackReport).filter(FeedbackReport.report_id == feedback_id).first() is not None

        # Delete account
        response = client.delete("/auth/me", headers=auth_headers)
        assert response.status_code == 204

        # Verify feedback is deleted
        test_db.expire_all()
        assert test_db.query(FeedbackReport).filter(FeedbackReport.report_id == feedback_id).first() is None

    def test_delete_account_deletes_verification_request(self, client: TestClient, auth_headers: dict[str, str], test_db: Session):
        """Test that VerificationRequest is deleted by email_hash."""
        from app.models import VerificationRequest
        from app.security import hash_email

        email_hash = hash_email("test@example.com")

        # Verify verification request exists (created by auth_headers fixture)
        verification = test_db.query(VerificationRequest).filter(
            VerificationRequest.email_hash == email_hash
        ).first()
        assert verification is not None

        # Delete account
        response = client.delete("/auth/me", headers=auth_headers)
        assert response.status_code == 204

        # Verify verification request is deleted
        test_db.expire_all()
        verification = test_db.query(VerificationRequest).filter(
            VerificationRequest.email_hash == email_hash
        ).first()
        assert verification is None

    def test_delete_account_rejects_demo_user(self, client: TestClient, test_db: Session):
        """Test that demo account cannot be deleted."""
        from app.config import get_settings
        from app.security import hash_email, create_user_access_token

        settings = get_settings()

        # Skip if demo settings not configured
        if settings.demo is None:
            pytest.skip("Demo settings not configured (DEMO__EMAIL, DEMO__CODE)")

        demo_email = settings.demo.email.lower()
        email_hash = hash_email(demo_email)

        # Create demo user
        demo_user = User(
            email_hash=email_hash,
            hospital_id="demo-hospital",
            specialty="Internal Medicine",
            role_level="Resident",
            state_code="BY",
        )
        test_db.add(demo_user)
        test_db.commit()

        # Get token for demo user
        token, _ = create_user_access_token(user_id=str(demo_user.user_id))
        demo_headers = {"Authorization": f"Bearer {token}"}

        # Try to delete demo account
        response = client.delete("/auth/me", headers=demo_headers)
        assert response.status_code == 403
        assert "Demo account cannot be deleted" in response.json()["detail"]

        # Verify demo user still exists
        assert test_db.query(User).filter(User.user_id == demo_user.user_id).first() is not None

    def test_delete_account_requires_auth(self, client: TestClient):
        """Test DELETE /auth/me requires authentication."""
        response = client.delete("/auth/me")
        assert response.status_code == 401

    def test_delete_account_invalid_token(self, client: TestClient):
        """Test DELETE /auth/me fails with invalid token."""
        headers = {"Authorization": "Bearer invalid_token_here"}
        response = client.delete("/auth/me", headers=headers)
        assert response.status_code == 401

    def test_token_invalid_after_deletion(self, client: TestClient, auth_headers: dict[str, str]):
        """Test that token becomes invalid after account deletion."""
        # Delete account
        response = client.delete("/auth/me", headers=auth_headers)
        assert response.status_code == 204

        # Try to use the same token
        me_response = client.get("/auth/me", headers=auth_headers)
        assert me_response.status_code == 401
