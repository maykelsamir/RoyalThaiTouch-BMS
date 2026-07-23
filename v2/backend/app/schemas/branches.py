from datetime import date, datetime

from pydantic import BaseModel, Field


class BranchWrite(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    code: str = Field(default="", max_length=40)
    country: str = Field(default="Iraq", max_length=100)
    city: str = Field(default="", max_length=120)
    address: str = Field(default="", max_length=500)
    phone: str = Field(default="", max_length=60)
    email: str = Field(default="", max_length=180)
    whatsapp: str = Field(default="", max_length=60)
    manager_name: str = Field(default="", max_length=160)
    opening_date: date | None = None
    logo: str = ""
    cover_image: str = ""
    notes: str = Field(default="", max_length=2000)
    active: bool = True


class BranchView(BranchWrite):
    id: int
    user_count: int = 0
    revenue_count: int = 0
    expense_count: int = 0
    created_at: datetime
    updated_at: datetime


class BranchStats(BaseModel):
    total: int
    active: int
    inactive: int
    managers: int
