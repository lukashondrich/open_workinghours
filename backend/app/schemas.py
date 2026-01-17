from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, validator

from .models import StaffGroup


class VerificationRequestIn(BaseModel):
    email: EmailStr

    @validator("email")
    def _lowercase_email(cls, value: str) -> str:
        return value.lower()


class VerificationRequestOut(BaseModel):
    message: str


class VerificationConfirmIn(BaseModel):
    code: str = Field(..., min_length=6, max_length=128)


class VerificationConfirmOut(BaseModel):
    affiliation_token: str
    expires_at: datetime


class ReportIn(BaseModel):
    shift_date: date
    actual_hours_worked: float = Field(..., gt=0, le=480)
    overtime_hours: float = Field(default=0, ge=0, le=240)
    staff_group: StaffGroup
    notes: str | None = Field(default=None, max_length=4000)

    @validator("overtime_hours")
    def _overtime_not_exceed_actual(cls, overtime: float, values: dict[str, object]) -> float:
        actual = values.get("actual_hours_worked")
        if actual is not None and overtime > actual:
            raise ValueError("Overtime hours cannot exceed actual hours worked.")
        return overtime


class ReportOut(BaseModel):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class HospitalMonthlySummary(BaseModel):
    hospital_domain: str
    staff_group: StaffGroup
    month_start: date
    report_count: int
    average_actual_hours: float | None
    average_overtime_hours: float | None
    total_actual_hours: float | None
    total_overtime_hours: float | None
    ci_actual_low: float | None
    ci_actual_high: float | None
    ci_overtime_low: float | None
    ci_overtime_high: float | None
    suppressed: bool


class StaffGroupMonthlySummary(BaseModel):
    staff_group: StaffGroup
    month_start: date
    report_count: int
    average_actual_hours: float | None
    average_overtime_hours: float | None
    total_actual_hours: float | None
    total_overtime_hours: float | None
    ci_actual_low: float | None
    ci_actual_high: float | None
    ci_overtime_low: float | None
    ci_overtime_high: float | None
    suppressed: bool


class AnalyticsResponse(BaseModel):
    hospital_monthly: list[HospitalMonthlySummary]
    staff_group_monthly: list[StaffGroupMonthlySummary]


class WeeklySubmissionIn(BaseModel):
    week_start: date
    week_end: date
    planned_hours: float = Field(..., ge=0, le=1000)
    actual_hours: float = Field(..., ge=0, le=1000)
    client_version: str = Field(..., min_length=1, max_length=64)

    @validator("week_end")
    def _week_end_not_before_start(cls, week_end: date, values: dict[str, object]) -> date:
        week_start = values.get("week_start")
        if week_start and week_end < week_start:
            raise ValueError("week_end must be on or after week_start.")
        return week_end


class WeeklySubmissionOut(BaseModel):
    id: UUID
    received_at: datetime


class WeeklySubmissionListItem(BaseModel):
    id: UUID
    week_start: date
    week_end: date
    planned_hours: float
    actual_hours: float
    client_version: str
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# USER AUTHENTICATION (NEW - Privacy Architecture)
# ============================================================================


class UserRegisterIn(BaseModel):
    """User registration request."""
    email: EmailStr
    hospital_id: str = Field(..., min_length=1, max_length=255)
    specialty: str = Field(..., min_length=1, max_length=100)
    role_level: str = Field(..., min_length=1, max_length=50)
    state_code: str | None = Field(default=None, max_length=10)
    # GDPR consent (optional for backward compatibility, required for new registrations)
    terms_version: str | None = Field(default=None, max_length=20)
    privacy_version: str | None = Field(default=None, max_length=20)

    @validator("email")
    def _lowercase_email(cls, value: str) -> str:
        return value.lower()


class UserLoginIn(BaseModel):
    """User login request (email + verification code)."""
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=128)

    @validator("email")
    def _lowercase_email(cls, value: str) -> str:
        return value.lower()


class AuthTokenOut(BaseModel):
    """Authentication response with JWT token."""
    access_token: str
    token_type: str = "bearer"
    expires_at: datetime
    user_id: UUID


class UserOut(BaseModel):
    """User information response."""
    user_id: UUID
    hospital_id: str
    specialty: str
    role_level: str
    state_code: str | None
    created_at: datetime
    # GDPR consent status
    terms_accepted_version: str | None = None
    privacy_accepted_version: str | None = None
    consent_accepted_at: datetime | None = None

    class Config:
        from_attributes = True


class ConsentUpdateIn(BaseModel):
    """Update user's consent (for policy updates)."""
    terms_version: str = Field(..., min_length=1, max_length=20)
    privacy_version: str = Field(..., min_length=1, max_length=20)


class UserDataExportOut(BaseModel):
    """GDPR Art. 20 Data Portability export format."""
    exported_at: datetime
    profile: dict
    work_events: list[dict]


# ============================================================================
# WORK EVENTS (NEW - Privacy Architecture)
# ============================================================================


class WorkEventIn(BaseModel):
    """Create a new work event (daily work record)."""
    date: date
    planned_hours: float = Field(..., ge=0, le=24)
    actual_hours: float = Field(..., ge=0, le=24)
    source: str = Field(..., pattern="^(geofence|manual|mixed)$")

    @validator("actual_hours")
    def _validate_time_ordering(cls, actual_hours: float, values: dict[str, object]) -> float:
        """Ensure basic consistency (can add more validation later)."""
        # MVP: Just ensure non-negative, more complex validation later
        return actual_hours


class WorkEventUpdate(BaseModel):
    """Update an existing work event (partial updates allowed)."""
    planned_hours: float | None = Field(default=None, ge=0, le=24)
    actual_hours: float | None = Field(default=None, ge=0, le=24)
    source: str | None = Field(default=None, pattern="^(geofence|manual|mixed)$")


class WorkEventOut(BaseModel):
    """Work event response."""
    event_id: UUID
    user_id: UUID
    date: date
    planned_hours: float
    actual_hours: float
    source: str
    submitted_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# STATISTICS (NEW - Privacy Architecture)
# ============================================================================


class StatsByStateSpecialtyOut(BaseModel):
    """
    Privacy-preserving statistics response.

    All data is k-anonymous (n_users >= K_MIN) and differentially private
    (Laplace noise added). Cannot be linked back to individuals.
    """
    stat_id: UUID
    country_code: str
    state_code: str
    specialty: str
    role_level: str
    period_start: date
    period_end: date

    # Anonymity set size
    n_users: int

    # Noised averages (hours per week)
    avg_planned_hours_noised: float | None
    avg_actual_hours_noised: float | None
    avg_overtime_hours_noised: float | None

    # Privacy parameters used
    k_min_threshold: int
    noise_epsilon: float

    # Metadata
    computed_at: datetime

    class Config:
        from_attributes = True


# Feedback / Bug Reports

class FeedbackIn(BaseModel):
    """Bug report / feedback submission from mobile app"""
    user_id: str | None = None
    user_email: str | None = None
    hospital_id: str | None = None
    specialty: str | None = None
    role_level: str | None = None
    state_code: str | None = None

    # Location info
    locations_count: int = 0
    locations_details: list[dict] = Field(default_factory=list)

    # Work events info
    work_events_total: int = 0
    work_events_pending: int = 0
    last_submission: datetime | None = None

    # App info
    app_version: str
    build_number: str
    platform: str
    device_model: str | None = None
    os_version: str | None = None

    # User's description (optional - they might just send app state)
    description: str | None = None


class FeedbackOut(BaseModel):
    """Feedback submission response"""
    success: bool
    message: str


# ============================================================================
# PUBLIC DASHBOARD (Coverage & Activity)
# ============================================================================


class StateCoverageOut(BaseModel):
    """Coverage status for a single state."""
    state_code: str
    state_name: str
    status: str  # "none" | "building" | "available"
    contributors_range: str  # "0" | "1-10" | "11-50" | "50+"
    threshold: int = 11


class CoverageOut(BaseModel):
    """
    Coverage status for the public dashboard map.

    Privacy protections applied:
    - Ranges instead of exact counts below threshold
    - Weekly update precision
    """
    updated_at: datetime
    update_precision: str = "weekly"
    threshold: int = 11
    states: list[StateCoverageOut]
    national: StateCoverageOut


class ActivityOut(BaseModel):
    """
    30-day rolling activity for the public dashboard.

    Privacy protections applied:
    - Contributor counts as ranges below threshold
    - Shift counts are exact (not identifying)
    """
    period_days: int = 30
    contributors_range: str  # "0" | "1-10" | "11-50" | "50+"
    shifts_confirmed: int
    states_building: int  # States with 1-10 contributors
    states_available: int  # States with 11+ contributors


# ============================================================================
# INSTITUTION CONTACT FORM
# ============================================================================


class InstitutionInquiryIn(BaseModel):
    """Contact form submission from institutions (unions, researchers, press)."""
    name: str = Field(..., min_length=1, max_length=255)
    organization: str = Field(..., min_length=1, max_length=255)
    role: str = Field(..., min_length=1, max_length=100)  # "union", "researcher", "press", "other"
    email: EmailStr
    message: str = Field(..., min_length=10, max_length=5000)

    @validator("email")
    def _lowercase_email(cls, value: str) -> str:
        return value.lower()


class InstitutionInquiryOut(BaseModel):
    """Response after submitting institution contact form."""
    success: bool
    message: str
    inquiry_id: UUID | None = None
