from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class MonthlyExpenseSave(BaseModel):
    branch_id: int
    year: int = Field(ge=2020, le=2100)
    month: int = Field(ge=1, le=12)
    amount: Decimal = Field(ge=0)
    notes: str = Field(default="", max_length=1000)


class MonthlyExpenseView(BaseModel):
    id: int | None = None
    branch_id: int
    branch_name: str
    year: int
    month: int
    amount: Decimal
    notes: str
    inherited: bool = False
    source_year: int | None = None
    source_month: int | None = None
    updated_by: int | None = None
    updated_at: datetime | None = None
