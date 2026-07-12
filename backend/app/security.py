from __future__ import annotations

import base64
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from .config import get_settings

settings = get_settings()


def generate_code(length: int = 32) -> str:
    """Generate URL-safe token (for legacy compatibility)"""
    return secrets.token_urlsafe(length)


def generate_numeric_code(length: int = 6) -> str:
    """Generate a numeric verification code (e.g., '123456')"""
    return ''.join(secrets.choice('0123456789') for _ in range(length))


def hash_email(email: str) -> str:
    secret = settings.security.email_hash_secret.encode("utf-8")
    digest = hmac.new(secret, email.encode("utf-8"), "sha256").digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


def hash_code(code: str) -> str:
    secret = settings.security.email_hash_secret.encode("utf-8")
    digest = hmac.new(secret, code.encode("utf-8"), "sha256").digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


# Affiliation tokens have no refresh mechanism and keep their original 30-day
# lifetime — deliberately decoupled from the (renewable) user-token lifetime.
AFFILIATION_TOKEN_EXP_HOURS = 720


def create_affiliation_token(*, hospital_domain: str) -> tuple[str, datetime]:
    expire = datetime.now(timezone.utc) + timedelta(hours=AFFILIATION_TOKEN_EXP_HOURS)
    payload = {
        "sub": hospital_domain,
        "hd": hospital_domain,
        "exp": expire,
        "scope": "report:submit",
    }
    token = jwt.encode(payload, settings.security.secret_key, algorithm="HS256")
    return token, expire


def verify_affiliation_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.security.secret_key, algorithms=["HS256"])
    except JWTError:
        return None
    return payload.get("hd")


# ============================================================================
# USER AUTHENTICATION (NEW - Privacy Architecture)
# ============================================================================


def create_user_access_token(
    *,
    user_id: str,
    auth_time: datetime | None = None,
    max_expires_at: datetime | None = None,
) -> tuple[str, datetime]:
    """
    Create JWT access token for authenticated user.
    Lifetime comes from SECURITY__TOKEN_EXP_HOURS (default 90 days); active
    users renew via POST /auth/refresh long before expiry.

    auth_time records when the user last *interactively* authenticated. Refresh
    carries it forward unchanged so the refresh chain can be age-capped — a
    stolen token cannot be renewed forever.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=settings.security.token_exp_hours)
    if max_expires_at is not None and expire > max_expires_at:
        # Refresh clamps expiry to the chain deadline (auth_time + max session
        # age) so the FINAL token of a chain also dies at the deadline — the
        # cap bounds access, not merely the ability to refresh.
        expire = max_expires_at
    payload = {
        "sub": user_id,
        "exp": expire,
        "type": "access",
        "auth_time": int((auth_time or now).timestamp()),
    }
    token = jwt.encode(payload, settings.security.secret_key, algorithm="HS256")
    return token, expire


def get_token_auth_time(token: str) -> datetime | None:
    """Read the auth_time claim from a valid token (None if absent/invalid)."""
    try:
        payload = jwt.decode(token, settings.security.secret_key, algorithms=["HS256"])
    except JWTError:
        return None
    ts = payload.get("auth_time")
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, tz=timezone.utc)


def verify_user_access_token(token: str) -> str | None:
    """
    Verify JWT access token and return user_id.
    Returns None if token is invalid or expired.
    """
    try:
        payload = jwt.decode(token, settings.security.secret_key, algorithms=["HS256"])
        if payload.get("type") != "access":
            return None
        user_id: str | None = payload.get("sub")
        return user_id
    except JWTError:
        return None
