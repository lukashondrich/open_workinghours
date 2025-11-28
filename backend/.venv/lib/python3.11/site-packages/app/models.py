from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import uuid4

from sqlalchemy import Column, Date, DateTime, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class VerificationStatus(str, Enum):
    pending = "pending"
    confirmed = "confirmed"
    expired = "expired"


class VerificationRequest(Base):
    __tablename__ = "verification_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    email_hash = Column(String(128), index=True, nullable=False)
    email_domain = Column(String(255), index=True, nullable=False)
    code_hash = Column(String(128), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    confirmed_at = Column(DateTime(timezone=True))
    status = Column(String(32), nullable=False, default=VerificationStatus.pending.value)
    attempt_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("email_hash", name="uq_verification_email_hash"),
    )


class StaffGroup(str, Enum):
    group_a = "group_a"  # Assistenz- und Fachärzt:innen
    group_b = "group_b"  # Ober- und Chefärzt:innen
    group_c = "group_c"  # Pflegepersonal


class Report(Base):
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    hospital_domain = Column(String(255), index=True, nullable=False)
    staff_group = Column(String(32), nullable=False)
    shift_date = Column(Date, nullable=False)
    actual_hours_worked = Column(Numeric(precision=5, scale=2), nullable=False)
    overtime_hours = Column(Numeric(precision=5, scale=2), nullable=False, default=0)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)


class WeeklySubmission(Base):
    __tablename__ = "weekly_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    week_start = Column(Date, nullable=False)
    week_end = Column(Date, nullable=False)
    planned_hours = Column(Numeric(precision=6, scale=2), nullable=False)
    actual_hours = Column(Numeric(precision=6, scale=2), nullable=False)
    client_version = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
