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
    code: str = Field(..., min_length=8, max_length=128)


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
