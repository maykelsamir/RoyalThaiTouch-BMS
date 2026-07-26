from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class DailyRevenueCreate(BaseModel):
    branch_id: int
    business_date: date
    amount: Decimal = Field(ge=0)
    customer_count: int = Field(ge=0)
    notes: str = Field(default="", max_length=1000)
    report_image: str = Field(default="", max_length=5000000)


class DailyRevenueUpdate(BaseModel):
    amount: Decimal = Field(ge=0)
    customer_count: int = Field(ge=0)
    notes: str = Field(default="", max_length=1000)
    report_image: str = Field(default="", max_length=5000000)


class DailyRevenueView(BaseModel):
    id: int
    branch_id: int
    branch_name: str
    business_date: date
    amount: Decimal
    customer_count: int
    notes: str
    report_image: str
    status: str
    created_by: int | None
    created_at: datetime
    updated_at: datetime


class BranchOption(BaseModel):
    id: int
    name: str
