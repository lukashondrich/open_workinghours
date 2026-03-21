"""
Security hardening regression tests.

Tests for:
- Rate limiting returns 429 after threshold
- Security headers present on responses
- CORS rejects unauthorized origins
- Email enumeration resistance (same response for existing vs non-existing)
- Verification confirm requires correct (email, code) pair
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

@pytest.mark.integration
class TestSecurityHeaders:
    """Verify security headers are set on responses."""

    def test_healthcheck_has_security_headers(self, client: TestClient):
        response = client.get("/healthz")
        assert response.status_code == 200
        assert response.headers["X-Content-Type-Options"] == "nosniff"
        assert response.headers["X-Frame-Options"] == "DENY"
        assert response.headers["X-XSS-Protection"] == "1; mode=block"
        assert response.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"
        assert "geolocation=()" in response.headers["Permissions-Policy"]

    def test_no_hsts_in_development(self, client: TestClient):
        """HSTS should only be set in production."""
        response = client.get("/healthz")
        assert "Strict-Transport-Security" not in response.headers


@pytest.mark.integration
class TestCORS:
    """Verify CORS restrictions."""

    def test_unauthorized_origin_rejected(self, client: TestClient):
        response = client.options(
            "/healthz",
            headers={
                "Origin": "https://evil.com",
                "Access-Control-Request-Method": "GET",
            },
        )
        # Should not have Access-Control-Allow-Origin for evil.com
        allow_origin = response.headers.get("Access-Control-Allow-Origin")
        assert allow_origin != "https://evil.com"
        assert allow_origin != "*"


@pytest.mark.integration
class TestRateLimiting:
    """Verify rate limiting returns 429 after threshold."""

    def test_login_rate_limit(self, client: TestClient):
        """POST /auth/login is limited to 5/minute."""
        payload = {"email": "test@example.com", "code": "000000"}
        statuses = [client.post("/auth/login", json=payload).status_code for _ in range(7)]
        assert 429 in statuses, f"Expected 429 in responses, got: {statuses}"

    def test_register_rate_limit(self, client: TestClient):
        """POST /auth/register is limited to 5/minute."""
        payload = {
            "email": "ratelimit@example.com",
            "hospital_id": "test",
            "specialty": "test",
            "role_level": "test",
        }
        statuses = [client.post("/auth/register", json=payload).status_code for _ in range(7)]
        assert 429 in statuses, f"Expected 429 in responses, got: {statuses}"

    def test_feedback_rate_limit(self, client: TestClient):
        """POST /feedback is limited to 10/minute."""
        payload = {
            "app_version": "1.0.0",
            "build_number": "30",
            "platform": "ios",
            "description": "test",
        }
        statuses = [client.post("/feedback", json=payload).status_code for _ in range(12)]
        assert 429 in statuses, f"Expected 429 in responses, got: {statuses}"

    def test_rate_limit_response_format(self, client: TestClient):
        """429 responses should have JSON body with detail field."""
        payload = {"email": "test@example.com", "code": "000000"}
        for _ in range(7):
            r = client.post("/auth/login", json=payload)
            if r.status_code == 429:
                data = r.json()
                assert "detail" in data
                assert "Rate limit" in data["detail"]
                return
        pytest.fail("Never got a 429 response")


@pytest.mark.integration
class TestEmailEnumeration:
    """Verify email enumeration resistance."""

    def test_register_existing_vs_unverified_same_error(self, client: TestClient, test_db: Session):
        """
        Both 'email not verified' and 'already exists' should return
        the same status code and generic message.
        """
        from app.models import VerificationRequest, VerificationStatus
        from app.security import hash_email, hash_code
        from datetime import datetime, timedelta, timezone

        # Unverified email -> 400
        response_unverified = client.post("/auth/register", json={
            "email": "unverified@example.com",
            "hospital_id": "test",
            "specialty": "test",
            "role_level": "test",
        })

        # Set up a verified user
        email = "existing@example.com"
        email_hash = hash_email(email)
        code_hash = hash_code("123456")

        verification = VerificationRequest(
            email_hash=email_hash,
            email_domain="example.com",
            code_hash=code_hash,
            status=VerificationStatus.confirmed.value,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            confirmed_at=datetime.now(timezone.utc),
        )
        test_db.add(verification)
        test_db.commit()

        # First registration succeeds
        response_first = client.post("/auth/register", json={
            "email": email,
            "hospital_id": "test",
            "specialty": "test",
            "role_level": "test",
        })
        assert response_first.status_code == 201

        # Second registration (existing user) -> should be 400, same as unverified
        response_existing = client.post("/auth/register", json={
            "email": email,
            "hospital_id": "test",
            "specialty": "test",
            "role_level": "test",
        })

        assert response_unverified.status_code == 400
        assert response_existing.status_code == 400

    @pytest.mark.xfail(reason="SQLite stores naive datetimes; production uses PostgreSQL with tz-aware")
    def test_login_nonexistent_user_same_as_bad_code(self, client: TestClient, test_db: Session):
        """Login with non-existent user should return 401, same as bad code."""
        from app.models import VerificationRequest, VerificationStatus
        from app.security import hash_email, hash_code
        from datetime import datetime, timedelta

        email = "notregistered@example.com"
        code = "654321"
        email_hash = hash_email(email)
        code_hash = hash_code(code)

        verification = VerificationRequest(
            email_hash=email_hash,
            email_domain="example.com",
            code_hash=code_hash,
            status=VerificationStatus.pending.value,
            expires_at=datetime.utcnow() + timedelta(hours=1),
        )
        test_db.add(verification)
        test_db.commit()

        response = client.post("/auth/login", json={
            "email": email,
            "code": code,
        })
        assert response.status_code == 401
        assert response.json()["detail"] == "Invalid verification code."


@pytest.mark.integration
class TestVerificationScope:
    """Verify that verification confirm requires correct (email, code) pair."""

    def test_confirm_without_email_falls_back_to_code_only(self, client: TestClient, test_db: Session):
        """POST /verification/confirm without email uses code-only lookup (backwards compat)."""
        response = client.post("/verification/confirm", json={"code": "123456"})
        # No matching code in DB → 400, but not 422 (email is optional)
        assert response.status_code == 400

    @pytest.mark.xfail(reason="SQLite stores naive datetimes; production uses PostgreSQL with tz-aware")
    def test_confirm_correct_pair_succeeds(self, client: TestClient, test_db: Session):
        """Correct email + correct code should succeed."""
        from app.models import VerificationRequest, VerificationStatus
        from app.security import hash_email, hash_code
        from datetime import datetime, timedelta

        email = "correct@example.com"
        code = "999888"
        email_hash = hash_email(email)
        code_hash = hash_code(code)

        verification = VerificationRequest(
            email_hash=email_hash,
            email_domain="example.com",
            code_hash=code_hash,
            status=VerificationStatus.pending.value,
            expires_at=datetime.utcnow() + timedelta(hours=1),
        )
        test_db.add(verification)
        test_db.commit()

        response = client.post("/verification/confirm", json={
            "email": email,
            "code": code,
        })
        assert response.status_code == 200

    def test_confirm_wrong_email_returns_400(self, client: TestClient, test_db: Session):
        """Code valid for one email should not work with a different email."""
        from app.models import VerificationRequest, VerificationStatus
        from app.security import hash_email, hash_code
        from datetime import datetime, timedelta

        email = "real@example.com"
        code = "777666"
        email_hash = hash_email(email)
        code_hash = hash_code(code)

        verification = VerificationRequest(
            email_hash=email_hash,
            email_domain="example.com",
            code_hash=code_hash,
            status=VerificationStatus.pending.value,
            expires_at=datetime.utcnow() + timedelta(hours=1),
        )
        test_db.add(verification)
        test_db.commit()

        response = client.post("/verification/confirm", json={
            "email": "wrong@example.com",
            "code": code,
        })
        assert response.status_code == 400
        assert response.json()["detail"] == "Invalid verification code"
