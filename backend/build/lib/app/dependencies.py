from collections.abc import Generator

from fastapi import Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .security import verify_affiliation_token


def get_db_session() -> Generator[Session, None, None]:
    yield from get_db()


def require_affiliation_token(
    authorization: str | None = Header(default=None, convert_underscores=False),
) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing affiliation token",
        )
    token = authorization.split(" ", 1)[1]
    hospital_domain = verify_affiliation_token(token)
    if not hospital_domain:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired affiliation token",
        )
    return hospital_domain
