from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    FirstAdminRequest,
    LoginRequest,
    RefreshRequest,
    SetupStatus,
    TokenPair,
    UserView,
)

router = APIRouter(prefix="/auth", tags=["auth"])

ADMIN_PERMISSIONS = [
    "dashboard.view", "daily_entry.view", "daily_entry.create", "daily_entry.edit", "daily_entry.delete", "daily_entry.approve",
    "expenses.view", "expenses.manage", "reports.view", "reports.export_excel", "reports.export_pdf",
    "branches.view", "branches.manage", "users.view", "users.manage", "users.reset_password",
    "roles.view", "roles.manage", "backup.view", "backup.create", "backup.restore", "audit.view", "system_health.view",
]


@router.get("/setup-status", response_model=SetupStatus)
def setup_status(db: Session = Depends(get_db)) -> SetupStatus:
    user_count = db.scalar(select(func.count()).select_from(User)) or 0
    return SetupStatus(initialized=user_count > 0)


@router.post("/setup", response_model=UserView, status_code=status.HTTP_201_CREATED)
def create_first_admin(body: FirstAdminRequest, db: Session = Depends(get_db)) -> User:
    user_count = db.scalar(select(func.count()).select_from(User)) or 0
    if user_count > 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="System is already initialized")
    username = body.username.strip().lower()
    admin = User(username=username, password_hash=hash_password(body.password), full_name="Administrator", role="Admin", permissions=ADMIN_PERMISSIONS, allowed_branch_ids=[], active=True)
    db.add(admin); db.commit(); db.refresh(admin)
    return admin


@router.post("/login", response_model=TokenPair)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenPair:
    username = body.username.strip().lower()
    user = db.scalar(select(User).where(func.lower(User.username) == username))
    if not user or not user.active or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return TokenPair(access_token=create_access_token(str(user.id), user.token_version), refresh_token=create_refresh_token(str(user.id), user.token_version))


@router.post("/refresh", response_model=TokenPair)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)) -> TokenPair:
    try:
        payload = decode_token(body.refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token required")
    user = db.scalar(select(User).where(User.id == int(payload.get("sub", 0))))
    if not user or not user.active or user.token_version != int(payload.get("ver", 0)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is no longer valid")
    return TokenPair(access_token=create_access_token(str(user.id), user.token_version), refresh_token=create_refresh_token(str(user.id), user.token_version))


@router.get("/me", response_model=UserView)
def me(current_user: User = Depends(get_current_user)) -> User:
    return current_user


@router.post("/logout")
def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, str]:
    current_user.token_version += 1
    db.commit()
    return {"status": "logged_out"}
