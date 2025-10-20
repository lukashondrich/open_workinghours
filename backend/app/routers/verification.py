from __future__ import annotations

from datetime import datetime, timedelta, timezone

from collections.abc import Generator
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import email as email_service
from ..database import get_db
from ..models import VerificationRequest, VerificationStatus
from ..schemas import (
    VerificationConfirmIn,
    VerificationConfirmOut,
    VerificationRequestIn,
    VerificationRequestOut,
)
from ..security import create_affiliation_token, generate_code, hash_code, hash_email
from ..utils import allowed_domains

router = APIRouter(prefix="/verification", tags=["verification"])

VERIFICATION_TTL_MINUTES = 15


def _get_db_session() -> Generator[Session, None, None]:
    yield from get_db()


@router.post(
    "/request",
    response_model=VerificationRequestOut,
    status_code=status.HTTP_202_ACCEPTED,
)
def request_verification(
    payload: VerificationRequestIn,
    background: BackgroundTasks,
    db: Session = Depends(_get_db_session),
) -> VerificationRequestOut:
    email = payload.email.strip().lower()
    domain = email.split("@")[-1]

    domain_allowlist = allowed_domains()
    if domain_allowlist is not None and domain not in domain_allowlist:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email domain is not authorised",
        )

    hashed_email = hash_email(email)
    code = generate_code(48)
    code_digest = hash_code(code)

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=VERIFICATION_TTL_MINUTES)

    record = (
        db.query(VerificationRequest)
        .filter(VerificationRequest.email_hash == hashed_email)
        .one_or_none()
    )

    if record:
        record.code_hash = code_digest
        record.expires_at = expires_at
        record.status = VerificationStatus.pending.value
        record.confirmed_at = None
        record.attempt_count += 1
    else:
        record = VerificationRequest(
            email_hash=hashed_email,
            email_domain=domain,
            code_hash=code_digest,
            expires_at=expires_at,
            status=VerificationStatus.pending.value,
        )
        db.add(record)

    db.commit()

    verification_message = f"Verification code: {code}"
    background.add_task(
        email_service.send_verification_email,
        recipient=email,
        content=verification_message,
    )

    return VerificationRequestOut(
        message="Verification email sent. Please check your inbox."
    )


@router.post("/confirm", response_model=VerificationConfirmOut)
def confirm_verification(
    payload: VerificationConfirmIn,
    db: Session = Depends(_get_db_session),
) -> VerificationConfirmOut:
    now = datetime.now(timezone.utc)
    digest = hash_code(payload.code)

    record = (
        db.query(VerificationRequest)
        .filter(VerificationRequest.code_hash == digest)
        .one_or_none()
    )

    if record is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code",
        )

    if record.expires_at < now:
        record.status = VerificationStatus.expired.value
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code expired",
        )

    record.status = VerificationStatus.confirmed.value
    record.confirmed_at = now
    db.commit()

    token, expires_at = create_affiliation_token(hospital_domain=record.email_domain)

    return VerificationConfirmOut(affiliation_token=token, expires_at=expires_at)
