from __future__ import annotations

import base64
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from .config import get_settings

settings = get_settings()


def generate_code(length: int = 32) -> str:
    return secrets.token_urlsafe(length)


def hash_email(email: str) -> str:
    secret = settings.security.email_hash_secret.encode("utf-8")
    digest = hmac.new(secret, email.encode("utf-8"), "sha256").digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


def hash_code(code: str) -> str:
    secret = settings.security.email_hash_secret.encode("utf-8")
    digest = hmac.new(secret, code.encode("utf-8"), "sha256").digest()
    return base64.urlsafe_b64encode(digest).decode("utf-8").rstrip("=")


def create_affiliation_token(*, hospital_domain: str) -> tuple[str, datetime]:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.security.token_exp_hours)
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
