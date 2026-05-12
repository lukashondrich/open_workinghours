"""
Social auth provider verification (Apple + Google).

Verifies identity tokens from Apple/Google, extracts the opaque `sub` identifier,
and manages short-lived social registration tokens for first-time users.
"""
from __future__ import annotations

import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import NamedTuple

import httpx
from jose import JWTError, jwt
from jose.backends import RSAKey

from .config import get_settings

logger = logging.getLogger(__name__)

# Token verification constants
APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys"
APPLE_ISSUER = "https://appleid.apple.com"
GOOGLE_KEYS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}

# Public key cache TTL (seconds)
_KEY_CACHE_TTL = 3600  # 1 hour

# Social registration token expiry
SOCIAL_REGISTRATION_TOKEN_EXPIRY_MINUTES = 30


class ProviderIdentity(NamedTuple):
    """Verified identity from a social auth provider."""
    provider: str       # "apple" | "google"
    sub: str            # opaque, stable user identifier


class ProviderVerificationError(Exception):
    """Raised when provider token verification fails."""
    pass


# ---------------------------------------------------------------------------
# Public key cache
# ---------------------------------------------------------------------------

_key_cache: dict[str, tuple[float, dict]] = {}  # url -> (fetched_at, jwks)


def _fetch_jwks(url: str) -> dict:
    """Fetch JSON Web Key Set from provider, with in-memory TTL cache."""
    now = time.time()
    cached = _key_cache.get(url)
    if cached and (now - cached[0]) < _KEY_CACHE_TTL:
        return cached[1]

    try:
        response = httpx.get(url, timeout=10.0)
        response.raise_for_status()
        jwks = response.json()
        _key_cache[url] = (now, jwks)
        logger.info("Refreshed JWKS from %s (%d keys)", url, len(jwks.get("keys", [])))
        return jwks
    except (httpx.HTTPError, ValueError) as exc:
        # If we have stale cache, use it rather than failing
        if cached:
            logger.warning("Failed to refresh JWKS from %s, using stale cache: %s", url, exc)
            return cached[1]
        raise ProviderVerificationError(f"Failed to fetch provider keys from {url}: {exc}") from exc


def _clear_key_cache() -> None:
    """Clear the key cache (for testing)."""
    _key_cache.clear()


# ---------------------------------------------------------------------------
# Apple token verification
# ---------------------------------------------------------------------------


def verify_apple_identity_token(identity_token: str, *, bundle_id: str) -> ProviderIdentity:
    """
    Verify an Apple identity token and extract the sub claim.

    Args:
        identity_token: JWT from ASAuthorizationAppleIDProvider
        bundle_id: Expected audience (app bundle ID)

    Returns:
        ProviderIdentity with provider="apple" and the opaque sub

    Raises:
        ProviderVerificationError on any verification failure
    """
    if _is_test_mode():
        return _test_mode_identity("apple", identity_token)

    try:
        jwks = _fetch_jwks(APPLE_KEYS_URL)
        payload = jwt.decode(
            identity_token,
            jwks,
            algorithms=["RS256"],
            audience=bundle_id,
            issuer=APPLE_ISSUER,
        )
    except JWTError as exc:
        raise ProviderVerificationError(f"Apple token verification failed: {exc}") from exc

    sub = payload.get("sub")
    if not sub:
        raise ProviderVerificationError("Apple token missing 'sub' claim")

    return ProviderIdentity(provider="apple", sub=sub)


# ---------------------------------------------------------------------------
# Google token verification
# ---------------------------------------------------------------------------


def verify_google_id_token(id_token: str, *, client_id: str) -> ProviderIdentity:
    """
    Verify a Google ID token and extract the sub claim.

    Args:
        id_token: JWT from Google Sign-In SDK
        client_id: Expected audience (Web/Server OAuth client ID)

    Returns:
        ProviderIdentity with provider="google" and the opaque sub

    Raises:
        ProviderVerificationError on any verification failure
    """
    if _is_test_mode():
        return _test_mode_identity("google", id_token)

    try:
        jwks = _fetch_jwks(GOOGLE_KEYS_URL)

        # Google tokens can have either issuer
        # Try decoding — jose checks issuer if provided
        header = jwt.get_unverified_header(id_token)
        claims = jwt.get_unverified_claims(id_token)

        issuer = claims.get("iss", "")
        if issuer not in GOOGLE_ISSUERS:
            raise ProviderVerificationError(f"Invalid Google token issuer: {issuer}")

        payload = jwt.decode(
            id_token,
            jwks,
            algorithms=["RS256"],
            audience=client_id,
            issuer=issuer,
        )
    except JWTError as exc:
        raise ProviderVerificationError(f"Google token verification failed: {exc}") from exc

    sub = payload.get("sub")
    if not sub:
        raise ProviderVerificationError("Google token missing 'sub' claim")

    # Intentionally discard email — privacy consistency with Apple
    return ProviderIdentity(provider="google", sub=sub)


# ---------------------------------------------------------------------------
# Social registration token (short-lived, signed by our backend)
# ---------------------------------------------------------------------------


def create_social_registration_token(*, provider: str, sub: str) -> str:
    """
    Create a short-lived signed token that encodes the provider identity.

    This token is returned to the mobile app when a first-time social user
    needs to complete registration. It's NOT a session token — it only proves
    the user authenticated with the provider.
    """
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(minutes=SOCIAL_REGISTRATION_TOKEN_EXPIRY_MINUTES)
    payload = {
        "provider": provider,
        "sub": sub,
        "exp": expire,
        "type": "social_registration",
    }
    return jwt.encode(payload, settings.security.secret_key, algorithm="HS256")


def verify_social_registration_token(token: str) -> ProviderIdentity:
    """
    Verify a social registration token and extract the provider identity.

    Returns:
        ProviderIdentity

    Raises:
        ProviderVerificationError on invalid/expired token
    """
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.security.secret_key, algorithms=["HS256"])
        if payload.get("type") != "social_registration":
            raise ProviderVerificationError("Invalid token type")
        provider = payload.get("provider")
        sub = payload.get("sub")
        if not provider or not sub:
            raise ProviderVerificationError("Token missing provider or sub")
        return ProviderIdentity(provider=provider, sub=sub)
    except JWTError as exc:
        raise ProviderVerificationError(f"Social registration token invalid or expired: {exc}") from exc


# ---------------------------------------------------------------------------
# TEST_MODE support
# ---------------------------------------------------------------------------

_TEST_SUB_APPLE = "test-apple-sub-001"
_TEST_SUB_GOOGLE = "test-google-sub-001"


def _is_test_mode() -> bool:
    return os.getenv("TEST_MODE", "").lower() in ("1", "true", "yes")


def _test_mode_identity(provider: str, token: str) -> ProviderIdentity:
    """In TEST_MODE, accept any token and return a deterministic sub."""
    logger.info("TEST_MODE: Accepting %s token without verification", provider)
    sub = _TEST_SUB_APPLE if provider == "apple" else _TEST_SUB_GOOGLE
    return ProviderIdentity(provider=provider, sub=sub)
