"""
Authentication router - User registration and login.
Part of the Privacy Architecture Redesign (Module 2).
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..dependencies import get_current_user
from ..models import User, VerificationRequest, VerificationStatus
from ..schemas import AuthTokenOut, ConsentUpdateIn, UserLoginIn, UserOut, UserRegisterIn
from ..security import create_user_access_token, hash_code, hash_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _get_db_session():
    yield from get_db()


@router.post("/register", response_model=AuthTokenOut, status_code=status.HTTP_201_CREATED)
def register_user(
    payload: UserRegisterIn,
    db: Session = Depends(_get_db_session),
) -> AuthTokenOut:
    """
    Register a new user account.

    Requirements:
    - Email must have been verified (via /verification/confirm)
    - Email hash must exist in verification_requests with status='confirmed'
    - User with this email must not already exist

    Returns:
    - JWT access token (30-day expiry)
    - User ID
    """
    email = payload.email.strip().lower()
    email_hash_value = hash_email(email)

    # Check if email has been verified
    verification = (
        db.query(VerificationRequest)
        .filter(VerificationRequest.email_hash == email_hash_value)
        .filter(VerificationRequest.status == VerificationStatus.confirmed.value)
        .one_or_none()
    )

    if verification is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email must be verified before registration. Please complete email verification first.",
        )

    # Check if user already exists
    existing_user = (
        db.query(User)
        .filter(User.email_hash == email_hash_value)
        .one_or_none()
    )

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists. Please use /auth/login instead.",
        )

    # Create new user with consent data
    now = datetime.now(timezone.utc)
    new_user = User(
        email_hash=email_hash_value,
        hospital_id=payload.hospital_id,
        specialty=payload.specialty,
        role_level=payload.role_level,
        state_code=payload.state_code,
        country_code="DEU",  # Default to Germany
        # GDPR consent
        terms_accepted_version=payload.terms_version,
        privacy_accepted_version=payload.privacy_version,
        consent_accepted_at=now if payload.terms_version else None,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Generate JWT token
    token, expires_at = create_user_access_token(user_id=str(new_user.user_id))

    return AuthTokenOut(
        access_token=token,
        expires_at=expires_at,
        user_id=new_user.user_id,
    )


@router.post("/login", response_model=AuthTokenOut)
def login_user(
    payload: UserLoginIn,
    db: Session = Depends(_get_db_session),
) -> AuthTokenOut:
    """
    Login existing user with email + verification code.

    Flow:
    1. User requests verification code via POST /verification/request
    2. User receives code via email
    3. User calls this endpoint with email + code
    4. Returns JWT access token if code is valid

    Requirements:
    - Verification code must be valid and not expired
    - User must exist in the system (registered via /auth/register)

    Returns:
    - JWT access token (30-day expiry)
    - User ID
    """
    email = payload.email.strip().lower()
    email_hash_value = hash_email(email)
    now = datetime.now(timezone.utc)

    # Demo account bypass for Apple App Review
    settings = get_settings()
    if settings.demo is not None:
        demo_email = settings.demo.email.lower()
        demo_code = settings.demo.code
        if email == demo_email and payload.code == demo_code:
            logger.info("Demo account login attempt")
            user = (
                db.query(User)
                .filter(User.email_hash == email_hash_value)
                .one_or_none()
            )
            if user is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Demo user not found. Please run the seed script.",
                )
            token, expires_at = create_user_access_token(user_id=str(user.user_id))
            logger.info(f"Demo account login successful for user {user.user_id}")
            return AuthTokenOut(
                access_token=token,
                expires_at=expires_at,
                user_id=user.user_id,
            )

    # Normal verification flow
    code_hash_value = hash_code(payload.code)

    # Verify the code
    verification = (
        db.query(VerificationRequest)
        .filter(VerificationRequest.email_hash == email_hash_value)
        .filter(VerificationRequest.code_hash == code_hash_value)
        .one_or_none()
    )

    if verification is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid verification code.",
        )

    if verification.expires_at < now:
        verification.status = VerificationStatus.expired.value
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Verification code expired. Please request a new one.",
        )

    # Mark verification as confirmed
    verification.status = VerificationStatus.confirmed.value
    verification.confirmed_at = now

    # Check if user exists
    user = (
        db.query(User)
        .filter(User.email_hash == email_hash_value)
        .one_or_none()
    )

    if user is None:
        db.commit()  # Still commit the verification status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Please register first via /auth/register.",
        )

    db.commit()

    # Generate JWT token
    token, expires_at = create_user_access_token(user_id=str(user.user_id))

    return AuthTokenOut(
        access_token=token,
        expires_at=expires_at,
        user_id=user.user_id,
    )


@router.get("/me", response_model=UserOut)
def get_current_user_info(
    current_user: User = Depends(get_current_user),
) -> UserOut:
    """
    Get current authenticated user's information.

    Requires:
    - Valid JWT token in Authorization header
    """
    return UserOut.from_orm(current_user)


@router.post("/consent", response_model=UserOut)
def update_consent(
    payload: ConsentUpdateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(_get_db_session),
) -> UserOut:
    """
    Update user's GDPR consent (for policy updates).

    Called when Terms of Service or Privacy Policy are updated
    and user needs to re-accept.

    Requires:
    - Valid JWT token in Authorization header
    """
    now = datetime.now(timezone.utc)

    current_user.terms_accepted_version = payload.terms_version
    current_user.privacy_accepted_version = payload.privacy_version
    current_user.consent_accepted_at = now

    db.commit()
    db.refresh(current_user)

    logger.info(f"User {current_user.user_id} updated consent to terms={payload.terms_version}, privacy={payload.privacy_version}")

    return UserOut.from_orm(current_user)
