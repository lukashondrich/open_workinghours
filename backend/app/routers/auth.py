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
from ..dp_group_stats.accounting import user_annual_summary
from ..models import FeedbackReport, User, VerificationRequest, VerificationStatus, WorkEvent
from ..rate_limit import rate_limit
from ..schemas import (
    AppleAuthIn,
    AuthTokenOut,
    ConsentUpdateIn,
    GoogleAuthIn,
    PrivacyBudgetOut,
    SocialAuthStartOut,
    SocialRegisterIn,
    UserDataExportOut,
    UserLoginIn,
    UserOut,
    UserProfileUpdateIn,
    UserRegisterIn,
)
from ..security import create_user_access_token, hash_code, hash_email
from ..social_auth import (
    ProviderIdentity,
    ProviderVerificationError,
    create_social_registration_token,
    verify_apple_identity_token,
    verify_google_id_token,
    verify_social_registration_token,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])


def _get_db_session():
    yield from get_db()


@router.post("/register", response_model=AuthTokenOut, status_code=status.HTTP_201_CREATED)
def register_user(
    payload: UserRegisterIn,
    db: Session = Depends(_get_db_session),
    _rl: None = Depends(rate_limit(5, 60)),
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
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Registration failed. Please verify your email and try again.",
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
        # v2 taxonomy fields (when present)
        profession=payload.profession,
        seniority=None if payload.profession == "other" else payload.seniority,
        department_group=payload.department_group,
        specialization_code=payload.specialization_code,
        hospital_ref_id=payload.hospital_ref_id,
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
    _rl: None = Depends(rate_limit(5, 60)),
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
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid verification code.",
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


@router.get("/me/export", response_model=UserDataExportOut)
def export_user_data(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(_get_db_session),
) -> UserDataExportOut:
    """
    Export all user data (GDPR Art. 20 - Data Portability).

    Returns JSON containing:
    - User profile information
    - All work events

    Format is structured and machine-readable as required by GDPR.

    Requires:
    - Valid JWT token in Authorization header
    """
    # Re-fetch user in this session
    user = db.query(User).filter(User.user_id == current_user.user_id).one()

    # Get all work events
    work_events = (
        db.query(WorkEvent)
        .filter(WorkEvent.user_id == user.user_id)
        .order_by(WorkEvent.date.desc())
        .all()
    )

    return UserDataExportOut(
        exported_at=datetime.now(timezone.utc),
        profile={
            "user_id": str(user.user_id),
            "hospital_id": user.hospital_id,
            "specialty": user.specialty,
            "role_level": user.role_level,
            "state_code": user.state_code,
            "country_code": user.country_code,
            "profession": user.profession,
            "seniority": user.seniority,
            "department_group": user.department_group,
            "specialization_code": user.specialization_code,
            "hospital_ref_id": user.hospital_ref_id,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "terms_accepted_version": user.terms_accepted_version,
            "privacy_accepted_version": user.privacy_accepted_version,
            "consent_accepted_at": user.consent_accepted_at.isoformat() if user.consent_accepted_at else None,
        },
        work_events=[
            {
                "event_id": str(event.event_id),
                "date": str(event.date),
                "planned_hours": float(event.planned_hours),
                "actual_hours": float(event.actual_hours),
                "source": event.source,
                "submitted_at": event.submitted_at.isoformat() if event.submitted_at else None,
            }
            for event in work_events
        ],
    )


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


@router.patch("/me/profile", response_model=UserOut)
def update_profile(
    payload: UserProfileUpdateIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(_get_db_session),
) -> UserOut:
    """
    Update profile fields (GDPR Art. 16 — right to rectification).

    Only updates provided (non-None) fields. Already-finalized weeks retain
    their snapshot values; changes apply to future weeks only.
    """
    user = db.query(User).filter(User.user_id == current_user.user_id).one()

    # If seniority provided without profession, validate against existing profession
    if payload.seniority is not None and payload.profession is None and user.profession is not None:
        from ..taxonomy import validate_seniority
        if not validate_seniority(user.profession, payload.seniority):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Seniority '{payload.seniority}' is not valid for profession '{user.profession}'.",
            )

    update_fields = payload.dict(exclude_unset=True)
    for field_name, value in update_fields.items():
        if value is not None:
            setattr(user, field_name, value)

    # Clear seniority when profession changes to 'other' — no valid
    # seniority exists for this profession, and stale values would
    # pollute finalized-week snapshots used in aggregation.
    if user.profession == "other":
        user.seniority = None

    db.commit()
    db.refresh(user)

    logger.info(f"User {user.user_id} updated profile fields: {list(update_fields.keys())}")

    return UserOut.from_orm(user)


@router.get("/me/privacy-budget", response_model=PrivacyBudgetOut)
def get_privacy_budget(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(_get_db_session),
    year: int | None = None,
) -> PrivacyBudgetOut:
    """
    Get current user's privacy budget summary (GDPR Art. 15 transparency).

    Returns total ε spent, cells contributed to, and date range for the year.
    """
    if year is None:
        year = datetime.now(timezone.utc).year

    summary = user_annual_summary(db, user_id=current_user.user_id, year=year)
    return PrivacyBudgetOut(**summary)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(_get_db_session),
) -> None:
    """
    Delete current user account and all associated data (GDPR Art. 17).

    Deletes:
    - User record
    - WorkEvents (via cascade)
    - FeedbackReports (manual cleanup, no FK)
    - VerificationRequest (by email_hash)

    Aggregated statistics are retained as they are anonymous data.

    Requires:
    - Valid JWT token in Authorization header
    """
    settings = get_settings()
    user_id = current_user.user_id
    user_id_str = str(user_id)
    email_hash = current_user.email_hash

    # Prevent demo account deletion
    if settings.demo is not None and email_hash is not None:
        demo_email_hash = hash_email(settings.demo.email.lower())
        if email_hash == demo_email_hash:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Demo account cannot be deleted.",
            )

    # Re-fetch user in this session to avoid SQLAlchemy session conflict
    user = db.query(User).filter(User.user_id == user_id).one()

    # Delete FeedbackReports associated with this user (no FK cascade)
    db.query(FeedbackReport).filter(
        FeedbackReport.user_id == user_id_str
    ).delete(synchronize_session=False)

    # Delete VerificationRequest (email_hash + domain should be removed)
    # Social auth users have no email_hash, so skip this step for them
    if email_hash is not None:
        db.query(VerificationRequest).filter(
            VerificationRequest.email_hash == email_hash
        ).delete(synchronize_session=False)

    # Delete user - WorkEvents are cascade deleted automatically
    logger.info(f"User {user_id} deleted account (GDPR Art. 17)")
    db.delete(user)
    db.commit()


# ============================================================================
# SOCIAL AUTH (Sign in with Apple + Google)
# ============================================================================


def _social_login(
    provider_identity: ProviderIdentity,
    db: Session,
) -> SocialAuthStartOut:
    """
    Shared logic for Apple/Google sign-in endpoints.

    - Existing linked user → issue app JWT
    - First-time user → return registration_required + social_registration_token
    """
    user = (
        db.query(User)
        .filter(
            User.auth_provider == provider_identity.provider,
            User.provider_sub == provider_identity.sub,
        )
        .one_or_none()
    )

    if user is not None:
        token, expires_at = create_user_access_token(user_id=str(user.user_id))
        logger.info(f"Social login ({provider_identity.provider}) for existing user {user.user_id}")
        return SocialAuthStartOut(
            status="authenticated",
            access_token=token,
            expires_at=expires_at,
            user_id=user.user_id,
            user=UserOut.from_orm(user),
        )

    # First-time social sign-in — issue registration token, do NOT create user
    reg_token = create_social_registration_token(
        provider=provider_identity.provider,
        sub=provider_identity.sub,
    )
    logger.info(f"Social login ({provider_identity.provider}) — new user, registration required")
    return SocialAuthStartOut(
        status="registration_required",
        social_registration_token=reg_token,
    )


@router.post("/apple", response_model=SocialAuthStartOut)
def login_with_apple(
    payload: AppleAuthIn,
    db: Session = Depends(_get_db_session),
    _rl: None = Depends(rate_limit(5, 60)),
) -> SocialAuthStartOut:
    """
    Sign in with Apple.

    Verifies the Apple identity token, extracts the opaque `sub`,
    and returns either an app session or a registration-required response.
    """
    settings = get_settings()
    try:
        identity = verify_apple_identity_token(
            payload.identity_token,
            bundle_id=settings.social_auth.apple_bundle_id,
        )
    except ProviderVerificationError as exc:
        logger.warning("Apple token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Apple authentication failed.",
        )

    return _social_login(identity, db)


@router.post("/google", response_model=SocialAuthStartOut)
def login_with_google(
    payload: GoogleAuthIn,
    db: Session = Depends(_get_db_session),
    _rl: None = Depends(rate_limit(5, 60)),
) -> SocialAuthStartOut:
    """
    Sign in with Google.

    Verifies the Google ID token, extracts the opaque `sub`,
    and returns either an app session or a registration-required response.
    """
    settings = get_settings()
    if not settings.social_auth.google_client_id:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Google Sign-In is not configured.",
        )

    try:
        identity = verify_google_id_token(
            payload.id_token,
            client_id=settings.social_auth.google_client_id,
        )
    except ProviderVerificationError as exc:
        logger.warning("Google token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Google authentication failed.",
        )

    return _social_login(identity, db)


@router.post("/social/register", response_model=AuthTokenOut, status_code=status.HTTP_201_CREATED)
def register_social_user(
    payload: SocialRegisterIn,
    db: Session = Depends(_get_db_session),
    _rl: None = Depends(rate_limit(5, 60)),
) -> AuthTokenOut:
    """
    Complete registration for a first-time social auth user.

    Verifies the social_registration_token, creates a full User row with the
    same field contract as email registration, and issues an app JWT.
    """
    # Verify the registration token
    try:
        identity = verify_social_registration_token(payload.social_registration_token)
    except ProviderVerificationError as exc:
        logger.warning("Social registration token verification failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Registration token invalid or expired. Please sign in again.",
        )

    # Check for duplicate — prevent re-registration with replayed token
    existing = (
        db.query(User)
        .filter(
            User.auth_provider == identity.provider,
            User.provider_sub == identity.sub,
        )
        .one_or_none()
    )
    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account already registered. Please sign in instead.",
        )

    # Create full user row — same contract as email registration
    now = datetime.now(timezone.utc)
    new_user = User(
        email_hash=None,  # Social auth users have no stored email
        auth_provider=identity.provider,
        provider_sub=identity.sub,
        hospital_id=payload.hospital_id,
        specialty=payload.specialty,
        role_level=payload.role_level,
        state_code=payload.state_code,
        country_code="DEU",
        # v2 taxonomy fields
        profession=payload.profession,
        seniority=None if payload.profession == "other" else payload.seniority,
        department_group=payload.department_group,
        specialization_code=payload.specialization_code,
        hospital_ref_id=payload.hospital_ref_id,
        # GDPR consent
        terms_accepted_version=payload.terms_version,
        privacy_accepted_version=payload.privacy_version,
        consent_accepted_at=now if payload.terms_version else None,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token, expires_at = create_user_access_token(user_id=str(new_user.user_id))
    logger.info(f"Social registration complete ({identity.provider}) — user {new_user.user_id}")

    return AuthTokenOut(
        access_token=token,
        expires_at=expires_at,
        user_id=new_user.user_id,
    )
