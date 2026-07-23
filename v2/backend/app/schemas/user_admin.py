from datetime import datetime

from pydantic import BaseModel, Field


class BranchOption(BaseModel):
    id: int
    name: str


class UserAdminView(BaseModel):
    id: int
    username: str
    full_name: str
    email: str
    phone: str
    role: str
    permissions: list[str]
    allowed_branch_ids: list[int]
    active: bool
    last_login_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=120, pattern=r"^[A-Za-z0-9_.-]+$")
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(default="", max_length=160)
    email: str = Field(default="", max_length=180)
    phone: str = Field(default="", max_length=60)
    role: str = Field(min_length=2, max_length=80)
    allowed_branch_ids: list[int] = []
    active: bool = True


class UserUpdate(BaseModel):
    full_name: str = Field(default="", max_length=160)
    email: str = Field(default="", max_length=180)
    phone: str = Field(default="", max_length=60)
    role: str = Field(min_length=2, max_length=80)
    allowed_branch_ids: list[int] = []
    active: bool = True


class PasswordReset(BaseModel):
    password: str = Field(min_length=8, max_length=128)


class RoleView(BaseModel):
    id: int
    name: str
    permissions: list[str]
    protected: bool

    model_config = {"from_attributes": True}


class RoleWrite(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    permissions: list[str] = []
