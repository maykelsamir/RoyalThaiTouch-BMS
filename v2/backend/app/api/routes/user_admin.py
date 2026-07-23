from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import hash_password
from app.db.session import get_db
from app.models.finance import Branch
from app.models.user import RoleProfile, User
from app.schemas.user_admin import BranchOption, PasswordReset, RoleView, RoleWrite, UserAdminView, UserCreate, UserUpdate

router = APIRouter(prefix="/admin", tags=["administration"])

PERMISSION_CATALOG = [
    {"group": "Dashboard", "items": ["dashboard.view"]},
    {"group": "Revenue", "items": ["daily_entry.view", "daily_entry.create", "daily_entry.edit", "daily_entry.delete", "daily_entry.approve"]},
    {"group": "Expenses", "items": ["expenses.view", "expenses.manage"]},
    {"group": "Reports", "items": ["reports.view", "reports.export_excel", "reports.export_pdf"]},
    {"group": "Branches", "items": ["branches.view", "branches.manage"]},
    {"group": "Users", "items": ["users.view", "users.manage", "users.reset_password"]},
    {"group": "Roles", "items": ["roles.view", "roles.manage"]},
    {"group": "Backup", "items": ["backup.view", "backup.create", "backup.restore"]},
    {"group": "Audit", "items": ["audit.view"]},
]
ALL_PERMISSIONS = [item for group in PERMISSION_CATALOG for item in group["items"]]


def require_admin(user: User) -> None:
    if user.role.lower() != "admin" and "users.manage" not in user.permissions:
        raise HTTPException(status_code=403, detail="Administrator permission required")


def seed_roles(db: Session) -> None:
    if (db.scalar(select(func.count()).select_from(RoleProfile)) or 0) > 0:
        return
    defaults = [
        RoleProfile(name="Admin", permissions=ALL_PERMISSIONS, protected=True),
        RoleProfile(name="Manager", permissions=["dashboard.view", "daily_entry.view", "daily_entry.create", "daily_entry.edit", "daily_entry.approve", "expenses.view", "reports.view"], protected=False),
        RoleProfile(name="Accountant", permissions=["dashboard.view", "daily_entry.view", "expenses.view", "expenses.manage", "reports.view", "reports.export_excel", "reports.export_pdf"], protected=False),
        RoleProfile(name="Reception", permissions=["dashboard.view", "daily_entry.view", "daily_entry.create", "daily_entry.edit"], protected=False),
        RoleProfile(name="Viewer", permissions=["dashboard.view", "daily_entry.view", "expenses.view", "reports.view"], protected=False),
    ]
    db.add_all(defaults)
    db.commit()


@router.get("/permission-catalog")
def permission_catalog(current_user: User = Depends(get_current_user)) -> list[dict]:
    require_admin(current_user)
    return PERMISSION_CATALOG


@router.get("/branches", response_model=list[BranchOption])
def branches(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[BranchOption]:
    require_admin(current_user)
    return [BranchOption(id=b.id, name=b.name) for b in db.scalars(select(Branch).order_by(Branch.name))]


@router.get("/roles", response_model=list[RoleView])
def roles(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[RoleProfile]:
    require_admin(current_user)
    seed_roles(db)
    return list(db.scalars(select(RoleProfile).order_by(RoleProfile.name)))


@router.post("/roles", response_model=RoleView, status_code=status.HTTP_201_CREATED)
def create_role(body: RoleWrite, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> RoleProfile:
    require_admin(current_user)
    name = body.name.strip()
    if db.scalar(select(RoleProfile).where(func.lower(RoleProfile.name) == name.lower())):
        raise HTTPException(status_code=409, detail="Role already exists")
    item = RoleProfile(name=name, permissions=sorted(set(body.permissions)), protected=False)
    db.add(item); db.commit(); db.refresh(item)
    return item


@router.put("/roles/{role_id}", response_model=RoleView)
def update_role(role_id: int, body: RoleWrite, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> RoleProfile:
    require_admin(current_user)
    item = db.get(RoleProfile, role_id)
    if not item:
        raise HTTPException(status_code=404, detail="Role not found")
    if item.protected and item.name.lower() == "admin":
        item.permissions = ALL_PERMISSIONS
    else:
        old_name = item.name
        item.name = body.name.strip()
        item.permissions = sorted(set(body.permissions))
        for user in db.scalars(select(User).where(User.role == old_name)):
            user.role = item.name
            user.permissions = item.permissions
            user.token_version += 1
    db.commit(); db.refresh(item)
    return item


@router.delete("/roles/{role_id}")
def delete_role(role_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, str]:
    require_admin(current_user)
    item = db.get(RoleProfile, role_id)
    if not item:
        raise HTTPException(status_code=404, detail="Role not found")
    if item.protected:
        raise HTTPException(status_code=409, detail="Protected role cannot be deleted")
    if db.scalar(select(func.count()).select_from(User).where(User.role == item.name)):
        raise HTTPException(status_code=409, detail="Role is assigned to users")
    db.delete(item); db.commit()
    return {"status": "deleted"}


@router.get("/users", response_model=list[UserAdminView])
def users(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[User]:
    require_admin(current_user)
    return list(db.scalars(select(User).order_by(User.created_at.desc())))


def role_permissions(db: Session, role_name: str) -> list[str]:
    seed_roles(db)
    role = db.scalar(select(RoleProfile).where(func.lower(RoleProfile.name) == role_name.lower()))
    if not role:
        raise HTTPException(status_code=422, detail="Selected role does not exist")
    return role.permissions


@router.post("/users", response_model=UserAdminView, status_code=status.HTTP_201_CREATED)
def create_user(body: UserCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    require_admin(current_user)
    username = body.username.strip().lower()
    if db.scalar(select(User).where(func.lower(User.username) == username)):
        raise HTTPException(status_code=409, detail="Username already exists")
    item = User(username=username, password_hash=hash_password(body.password), full_name=body.full_name.strip(), email=body.email.strip(), phone=body.phone.strip(), role=body.role, permissions=role_permissions(db, body.role), allowed_branch_ids=body.allowed_branch_ids, active=body.active)
    db.add(item); db.commit(); db.refresh(item)
    return item


@router.put("/users/{user_id}", response_model=UserAdminView)
def update_user(user_id: int, body: UserUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    require_admin(current_user)
    item = db.get(User, user_id)
    if not item:
        raise HTTPException(status_code=404, detail="User not found")
    if item.id == current_user.id and not body.active:
        raise HTTPException(status_code=409, detail="You cannot disable your own account")
    item.full_name = body.full_name.strip(); item.email = body.email.strip(); item.phone = body.phone.strip()
    item.role = body.role; item.permissions = role_permissions(db, body.role); item.allowed_branch_ids = body.allowed_branch_ids; item.active = body.active
    item.token_version += 1
    db.commit(); db.refresh(item)
    return item


@router.post("/users/{user_id}/reset-password")
def reset_password(user_id: int, body: PasswordReset, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, str]:
    require_admin(current_user)
    item = db.get(User, user_id)
    if not item:
        raise HTTPException(status_code=404, detail="User not found")
    item.password_hash = hash_password(body.password); item.token_version += 1
    db.commit()
    return {"status": "password_reset"}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict[str, str]:
    require_admin(current_user)
    item = db.get(User, user_id)
    if not item:
        raise HTTPException(status_code=404, detail="User not found")
    if item.id == current_user.id:
        raise HTTPException(status_code=409, detail="You cannot delete your own account")
    db.delete(item); db.commit()
    return {"status": "deleted"}
