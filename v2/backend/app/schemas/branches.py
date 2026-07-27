from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, model_validator


class BranchWrite(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    code: str = Field(default="", max_length=40)
    country: str = Field(default="Iraq", max_length=100)
    city: str = Field(default="", max_length=120)
    address: str = Field(default="", max_length=500)
    phone: str = Field(default="", max_length=60)
    email: str = Field(default="", max_length=180)
    whatsapp: str = Field(default="", max_length=300)
    website: str = Field(default="", max_length=500)
    facebook: str = Field(default="", max_length=500)
    instagram: str = Field(default="", max_length=500)
    tiktok: str = Field(default="", max_length=500)
    youtube: str = Field(default="", max_length=500)
    telegram: str = Field(default="", max_length=500)
    snapchat: str = Field(default="", max_length=500)
    google_maps: str = Field(default="", max_length=1000)
    manager_name: str = Field(default="", max_length=160)
    opening_date: date | None = None
    company_revenue_percentage: Decimal = Field(default=Decimal("100"), ge=0, le=100)
    hotel_revenue_percentage: Decimal = Field(default=Decimal("0"), ge=0, le=100)
    logo: str = ""
    cover_image: str = ""
    notes: str = Field(default="", max_length=2000)
    active: bool = True

    @model_validator(mode="after")
    def validate_revenue_share(self):
        total = self.company_revenue_percentage + self.hotel_revenue_percentage
        if total != Decimal("100"):
            raise ValueError("Company and hotel revenue percentages must total 100%")
        return self


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
