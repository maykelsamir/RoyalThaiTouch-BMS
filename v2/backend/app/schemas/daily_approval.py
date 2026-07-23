from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class RejectionRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=1000)


class ApprovalEntryView(BaseModel):
    id: int
    branch_id: int
    branch_name: str
    business_date: date
    amount: Decimal
    notes: str
    report_image: str
    status: str
    created_by: int | None
    created_by_username: str | None
    approved_by: int | None
    approved_by_username: str | None
    approved_at: datetime | None
    rejected_by: int | None
    rejected_by_username: str | None
    rejected_at: datetime | None
    rejection_reason: str
    created_at: datetime
    updated_at: datetime
