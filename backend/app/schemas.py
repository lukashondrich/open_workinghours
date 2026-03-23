from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, validator

from .models import StaffGroup
from .taxonomy import (
    ALL_DEPARTMENT_GROUPS,
    ALL_SENIORITY_VALUES,
    ALL_STATE_CODES,
    ALL_SPECIALIZATION_CODES,
    SENIORITY_BY_PROFESSION,
    Profession,
    validate_seniority,
)


class VerificationRequestIn(BaseModel):
    email: EmailStr

    @validator("email")
    def _lowercase_email(cls, value: str) -> str:
        return value.lower()


class VerificationRequestOut(BaseModel):
    message: str


class VerificationConfirmIn(BaseModel):
    email: EmailStr | None = None  # Optional for backwards compat with old app versions
    code: str = Field(..., min_length=6, max_length=128)

    @validator("email", pre=True)
    def _lowercase_email(cls, value: str | None) -> str | None:
        return value.lower() if value else None


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


class FinalizedUserWeekIn(BaseModel):
    week_start: date

    @validator("week_start")
    def _week_start_must_be_monday(cls, week_start: date) -> date:
        if week_start.weekday() != 0:
            raise ValueError("week_start must be a Monday")
        return week_start


class FinalizedUserWeekOut(BaseModel):
    finalized_week_id: UUID
    week_start: date
    week_end: date
    planned_hours: float
    actual_hours: float
    hospital_id: str
    specialty: str
    role_level: str
    state_code: str | None
    country_code: str
    finalized_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# USER AUTHENTICATION (NEW - Privacy Architecture)
# ============================================================================


class UserRegisterIn(BaseModel):
    """
    User registration request.

    Accepts both v1 (free-text) and v2 (taxonomy) payloads.
    v1 fields are still required for backward compatibility with old app versions.
    When v2 fields are present, they take precedence and are validated.
    """
    email: EmailStr
    # v1 fields (required for backward compat)
    hospital_id: str = Field(..., min_length=1, max_length=255)
    specialty: str = Field(..., min_length=1, max_length=100)
    role_level: str = Field(..., min_length=1, max_length=50)
    state_code: str | None = Field(default=None, max_length=10)
    # v2 taxonomy fields (optional — present when using new app)
    profession: str | None = Field(default=None, max_length=20)
    seniority: str | None = Field(default=None, max_length=30)
    department_group: str | None = Field(default=None, max_length=50)
    specialization_code: str | None = Field(default=None, max_length=10)
    hospital_ref_id: int | None = None
    # GDPR consent (optional for backward compatibility, required for new registrations)
    terms_version: str | None = Field(default=None, max_length=20)
    privacy_version: str | None = Field(default=None, max_length=20)

    @validator("email")
    def _lowercase_email(cls, value: str) -> str:
        return value.lower()

    @validator("profession")
    def _validate_profession(cls, value: str | None) -> str | None:
        if value is not None and value not in [p.value for p in Profession]:
            raise ValueError(f"Invalid profession: {value}. Must be one of: {[p.value for p in Profession]}")
        return value

    @validator("seniority")
    def _validate_seniority(cls, value: str | None, values: dict) -> str | None:
        if value is None:
            return value
        if value not in ALL_SENIORITY_VALUES:
            raise ValueError(f"Invalid seniority: {value}")
        profession = values.get("profession")
        if profession is not None and not validate_seniority(profession, value):
            valid = SENIORITY_BY_PROFESSION.get(Profession(profession), [])
            raise ValueError(f"Seniority '{value}' is not valid for profession '{profession}'. Valid: {valid}")
        return value

    @validator("department_group")
    def _validate_department_group(cls, value: str | None) -> str | None:
        if value is not None and value not in ALL_DEPARTMENT_GROUPS:
            raise ValueError(f"Invalid department_group: {value}")
        return value

    @validator("specialization_code")
    def _validate_specialization_code(cls, value: str | None) -> str | None:
        if value is not None and value not in ALL_SPECIALIZATION_CODES:
            raise ValueError(f"Invalid specialization_code: {value}")
        return value

    @validator("state_code")
    def _validate_state_code(cls, value: str | None) -> str | None:
        if value is not None and len(value) == 2:
            value = value.upper()
            if value not in ALL_STATE_CODES:
                raise ValueError(f"Invalid state_code: {value}. Must be a valid German federal state code.")
        return value


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
    # v2 taxonomy fields (optional for backward compat)
    profession: str | None = None
    seniority: str | None = None
    department_group: str | None = None
    specialization_code: str | None = None
    hospital_ref_id: int | None = None
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


class UserProfileUpdateIn(BaseModel):
    """
    Profile update request (GDPR Art. 16 — right to rectification).

    All fields optional — only provided fields are updated.
    """
    profession: str | None = None
    seniority: str | None = None
    department_group: str | None = None
    specialization_code: str | None = None
    hospital_ref_id: int | None = None
    state_code: str | None = None
    # Legacy fields (allow update for backward compat)
    hospital_id: str | None = Field(default=None, max_length=255)
    specialty: str | None = Field(default=None, max_length=100)
    role_level: str | None = Field(default=None, max_length=50)

    @validator("profession")
    def _validate_profession(cls, value: str | None) -> str | None:
        if value is not None and value not in [p.value for p in Profession]:
            raise ValueError(f"Invalid profession: {value}")
        return value

    @validator("seniority")
    def _validate_seniority(cls, value: str | None, values: dict) -> str | None:
        if value is None:
            return value
        if value not in ALL_SENIORITY_VALUES:
            raise ValueError(f"Invalid seniority: {value}")
        profession = values.get("profession")
        if profession is not None and not validate_seniority(profession, value):
            valid = SENIORITY_BY_PROFESSION.get(Profession(profession), [])
            raise ValueError(f"Seniority '{value}' is not valid for profession '{profession}'. Valid: {valid}")
        return value

    @validator("department_group")
    def _validate_department_group(cls, value: str | None) -> str | None:
        if value is not None and value not in ALL_DEPARTMENT_GROUPS:
            raise ValueError(f"Invalid department_group: {value}")
        return value

    @validator("specialization_code")
    def _validate_specialization_code(cls, value: str | None) -> str | None:
        if value is not None and value not in ALL_SPECIALIZATION_CODES:
            raise ValueError(f"Invalid specialization_code: {value}")
        return value

    @validator("state_code")
    def _validate_state_code(cls, value: str | None) -> str | None:
        if value is not None and len(value) == 2:
            value = value.upper()
            if value not in ALL_STATE_CODES:
                raise ValueError(f"Invalid state_code: {value}")
        return value


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
    Public state x specialty statistics response.

    Counts and internal privacy-tuning details are intentionally hidden.
    Suppressed cells are returned with null numeric values and generic status only.
    """
    stat_id: UUID
    country_code: str
    state_code: str
    specialty: str
    period_start: date
    period_end: date
    planned_mean_hours: float | None
    overtime_mean_hours: float | None
    planned_ci_half: float | None = None
    actual_ci_half: float | None = None
    overtime_ci_half: float | None = None
    n_display: int | None = None
    status: str
    computed_at: datetime


class PrivacyBudgetOut(BaseModel):
    """Per-user privacy budget summary (GDPR Art. 15)."""
    year: int
    total_spent: float
    n_entries: int
    cells: list[str]
    earliest_period: str | None = None
    latest_period: str | None = None


class StateSpecialtyReleaseCellIn(BaseModel):
    """Admin input for configured state x specialty release cells."""
    country_code: str = Field(default="DEU", min_length=3, max_length=3)
    state_code: str = Field(..., min_length=1, max_length=10)
    specialty: str = Field(..., min_length=1, max_length=100)
    is_enabled: bool = True

    @validator("country_code")
    def _normalize_country_code(cls, value: str) -> str:
        return value.strip().upper()

    @validator("state_code")
    def _normalize_state_code(cls, value: str) -> str:
        return value.strip().upper()

    @validator("specialty")
    def _normalize_specialty(cls, value: str) -> str:
        return value.strip()


class StateSpecialtyReleaseCellOut(BaseModel):
    """Configured state x specialty release cell."""
    cell_id: UUID
    country_code: str
    state_code: str
    specialty: str
    is_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


class StateSpecialtyReleaseCellBulkUpsertIn(BaseModel):
    """Bulk upsert payload for configured release cells."""
    cells: list[StateSpecialtyReleaseCellIn] = Field(default_factory=list)

    @validator("cells")
    def _validate_non_empty_cells(cls, value: list[StateSpecialtyReleaseCellIn]) -> list[StateSpecialtyReleaseCellIn]:
        if not value:
            raise ValueError("cells must not be empty")
        return value


class StateSpecialtyReleaseCellBulkUpsertOut(BaseModel):
    """Bulk upsert response for configured release cells."""
    upserted: int
    cells: list[StateSpecialtyReleaseCellOut]


# Feedback / Bug Reports

class GpsTelemetryEvent(BaseModel):
    """Single GPS telemetry event from geofencing"""
    timestamp: str
    event_type: str  # "enter" | "exit"
    accuracy_meters: float | None = None
    accuracy_source: str | None = None  # "event" | "active_fetch" | null
    ignored: bool = False
    ignore_reason: str | None = None
    location_name: str = "Unknown"


class GpsAccuracyStats(BaseModel):
    """GPS accuracy statistics"""
    min: float = 0
    max: float = 0
    avg: float = 0
    count: int = 0


class GpsTelemetry(BaseModel):
    """GPS telemetry data for parameter tuning"""
    recent_events: list[GpsTelemetryEvent] = Field(default_factory=list)
    accuracy_stats: GpsAccuracyStats = Field(default_factory=GpsAccuracyStats)
    ignored_events_count: int = 0
    signal_degradation_count: int = 0
    debounced_events_count: int = 0


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

    # GPS telemetry for parameter tuning (geofence debugging)
    gps_telemetry: GpsTelemetry | None = None

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
