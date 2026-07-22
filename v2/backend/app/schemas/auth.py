from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=4, max_length=128)


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserView(BaseModel):
    id: int
    username: str
    role: str
    permissions: list[str]
    allowed_branch_ids: list[int]
    active: bool

    model_config = {"from_attributes": True}
