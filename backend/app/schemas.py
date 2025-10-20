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
