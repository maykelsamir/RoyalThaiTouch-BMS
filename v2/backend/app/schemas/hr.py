from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class EmployeeWrite(BaseModel):
    employee_code: str = Field(default="", max_length=40)
    full_name: str = Field(min_length=2, max_length=180)
    gender: str = Field(default="", max_length=20)
    birth_date: date | None = None
    nationality: str = Field(default="", max_length=80)
    phone: str = Field(default="", max_length=60)
    email: str = Field(default="", max_length=180)
    address: str = Field(default="", max_length=500)
    branch_id: int | None = None
    department: str = Field(default="", max_length=100)
    job_title: str = Field(default="", max_length=120)
    manager_name: str = Field(default="", max_length=160)
    hire_date: date | None = None
    contract_type: str = Field(default="Full Time", max_length=60)
    salary: float = Field(default=0, ge=0)
    salary_currency: Literal["IQD", "USD"] = "IQD"
    status: str = Field(default="Active", max_length=30)
    photo: str = ""
    id_card_front: str = ""
    id_card_back: str = ""
    passport_photo: str = ""
    notes: str = Field(default="", max_length=2000)
    active: bool = True


class EmployeeView(EmployeeWrite):
    id: int
    branch_name: str = ""
    created_at: datetime
    updated_at: datetime