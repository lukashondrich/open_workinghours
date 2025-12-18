from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import uuid4

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import declarative_base, relationship

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


# ============================================================================
# NEW SCHEMA - Privacy Architecture Redesign
# ============================================================================


class User(Base):
    """
    User accounts (pseudonymous personal data).
    Operational layer - GDPR applies, supports right to erasure.
    """
    __tablename__ = "users"

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    email_hash = Column(String(64), unique=True, nullable=False, index=True)
    hospital_id = Column(String(255), nullable=False, index=True)
    specialty = Column(String(100), nullable=False, index=True)
    role_level = Column(String(50), nullable=False)
    state_code = Column(String(10), index=True)
    country_code = Column(String(3), nullable=False, default='DEU')
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    last_submission_at = Column(DateTime(timezone=True))

    # Relationships
    work_events = relationship("WorkEvent", back_populates="user", cascade="all, delete-orphan")


class WorkEvent(Base):
    """
    Daily work events per confirmed day (per-user data).
    Operational layer - GDPR applies, CASCADE delete on user deletion.
    """
    __tablename__ = "work_events"

    event_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey('users.user_id', ondelete='CASCADE'),
        nullable=False,
        index=True
    )
    date = Column(Date, nullable=False, index=True)
    planned_hours = Column(Numeric(precision=5, scale=2), nullable=False)
    actual_hours = Column(Numeric(precision=5, scale=2), nullable=False)
    source = Column(String(20), nullable=False)  # 'geofence', 'manual', 'mixed'
    submitted_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True)

    # Relationship
    user = relationship("User", back_populates="work_events")

    __table_args__ = (
        UniqueConstraint("user_id", "date", name="uq_work_event_user_date"),
    )


class StatsByStateSpecialty(Base):
    """
    Aggregated statistics by state × specialty × role × period.
    Analytics layer - k-anonymous + noised, treated as anonymous data.
    """
    __tablename__ = "stats_by_state_specialty"

    stat_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    country_code = Column(String(3), nullable=False)
    state_code = Column(String(10), nullable=False, index=True)
    specialty = Column(String(100), nullable=False, index=True)
    role_level = Column(String(50), nullable=False)
    period_start = Column(Date, nullable=False, index=True)
    period_end = Column(Date, nullable=False)

    n_users = Column(Integer, nullable=False)
    avg_planned_hours_noised = Column(Numeric(precision=5, scale=2))
    avg_actual_hours_noised = Column(Numeric(precision=5, scale=2))
    avg_overtime_hours_noised = Column(Numeric(precision=5, scale=2))

    k_min_threshold = Column(Integer, nullable=False)
    noise_epsilon = Column(Numeric(precision=4, scale=2), nullable=False)
    computed_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "country_code", "state_code", "specialty", "role_level", "period_start",
            name="uq_stats_state_spec_period"
        ),
    )


class StatsByHospital(Base):
    """
    Aggregated statistics by hospital × period (no role dimension).
    Analytics layer - k-anonymous + noised, treated as anonymous data.
    Coarser grouping to avoid sparse cells.
    """
    __tablename__ = "stats_by_hospital"

    stat_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    hospital_id = Column(String(255), nullable=False, index=True)
    period_start = Column(Date, nullable=False, index=True)
    period_end = Column(Date, nullable=False)

    n_users = Column(Integer, nullable=False)
    avg_planned_hours_noised = Column(Numeric(precision=5, scale=2))
    avg_actual_hours_noised = Column(Numeric(precision=5, scale=2))
    avg_overtime_hours_noised = Column(Numeric(precision=5, scale=2))

    k_min_threshold = Column(Integer, nullable=False)
    noise_epsilon = Column(Numeric(precision=4, scale=2), nullable=False)
    computed_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint(
            "hospital_id", "period_start",
            name="uq_stats_hospital_period"
        ),
    )


class FeedbackReport(Base):
    """
    Bug reports and feedback from mobile app users.
    Stored for admin review in dashboard.
    """
    __tablename__ = "feedback_reports"

    report_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    # User info (optional - may be unauthenticated)
    user_id = Column(String(255), nullable=True)
    user_email = Column(String(255), nullable=True)
    hospital_id = Column(String(255), nullable=True)
    specialty = Column(String(100), nullable=True)
    role_level = Column(String(50), nullable=True)
    state_code = Column(String(10), nullable=True)

    # User's description
    description = Column(Text, nullable=True)

    # App state (JSON)
    app_state = Column(JSON, nullable=False)

    # Metadata
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True)
    resolved = Column(String(20), default="pending", nullable=False)  # pending, resolved, dismissed
