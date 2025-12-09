from collections.abc import Generator
from uuid import UUID

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import verify_affiliation_token, verify_user_access_token


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


# ============================================================================
# USER AUTHENTICATION DEPENDENCIES (NEW - Privacy Architecture)
# ============================================================================


def get_current_user(
    authorization: str | None = Header(default=None, convert_underscores=False),
    db: Session = Depends(get_db_session),
) -> User:
    """
    FastAPI dependency to get the current authenticated user from JWT token.

    Extracts JWT token from Authorization header, verifies it, and returns the User object.

    Raises HTTPException if:
    - No Authorization header
    - Invalid token format
    - Token expired or invalid
    - User not found in database
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header. Expected: Bearer <token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = authorization.split(" ", 1)[1]
    user_id_str = verify_user_access_token(token)

    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        user_id = UUID(user_id_str)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user ID in token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.user_id == user_id).one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user
