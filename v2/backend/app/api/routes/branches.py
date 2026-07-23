import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.finance import Branch, DailyRevenue, Expense, MonthlyExpense
from app.models.user import User
from app.schemas.branches import BranchStats, BranchView, BranchWrite

router = APIRouter(prefix="/branches", tags=["branches"])


def _require(user: User, permission: str) -> None:
    if user.role.lower() != "admin" and permission not in user.permissions:
        raise HTTPException(status_code=403, detail="Branch permission required")


def _slug(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "-", value.strip().upper()).strip("-")
    return cleaned[:30] or "BRANCH"


def _unique_code(db: Session, preferred: str, exclude_id: int | None = None) -> str:
    base = _slug(preferred)
    code = base
    counter = 2
    while True:
        query = select(Branch).where(func.lower(Branch.code) == code.lower())
        if exclude_id is not None:
            query = query.where(Branch.id != exclude_id)
        if not db.scalar(query):
            return code
        code = f"{base[:25]}-{counter}"
        counter += 1


def _user_count(branch_id: int, users: list[User]) -> int:
    return sum(1 for user in users if branch_id in (user.allowed_branch_ids or []))


def _view(branch: Branch, users: list[User], revenue_count: int, expense_count: int) -> BranchView:
    return BranchView(
        id=branch.id,
        name=branch.name,
        code=branch.code,
        country=branch.country,
        city=branch.city,
        address=branch.address,
        phone=branch.phone,
        email=branch.email,
        whatsapp=branch.whatsapp,
        manager_name=branch.manager_name,
        opening_date=branch.opening_date,
        logo=branch.logo,
        cover_image=branch.cover_image,
        notes=branch.notes,
        active=branch.active,
        user_count=_user_count(branch.id, users),
        revenue_count=revenue_count,
        expense_count=expense_count,
        created_at=branch.created_at,
        updated_at=branch.updated_at,
    )


@router.get("", response_model=list[BranchView])
def list_branches(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "branches.view")
    branches = list(db.scalars(select(Branch).order_by(Branch.active.desc(), Branch.name)))
    users = list(db.scalars(select(User)))
    revenues = dict(db.execute(select(DailyRevenue.branch_id, func.count()).group_by(DailyRevenue.branch_id)).all())
    monthly = dict(db.execute(select(MonthlyExpense.branch_id, func.count()).group_by(MonthlyExpense.branch_id)).all())
    legacy = dict(db.execute(select(Expense.branch_id, func.count()).group_by(Expense.branch_id)).all())
    return [_view(item, users, revenues.get(item.id, 0), monthly.get(item.id, 0) + legacy.get(item.id, 0)) for item in branches]


@router.get("/stats", response_model=BranchStats)
def stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "branches.view")
    rows = list(db.scalars(select(Branch)))
    return BranchStats(
        total=len(rows),
        active=sum(1 for item in rows if item.active),
        inactive=sum(1 for item in rows if not item.active),
        managers=len({item.manager_name.strip().lower() for item in rows if item.manager_name.strip()}),
    )


@router.get("/{branch_id}", response_model=BranchView)
def get_branch(branch_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "branches.view")
    branch = db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    users = list(db.scalars(select(User)))
    revenue_count = db.scalar(select(func.count()).select_from(DailyRevenue).where(DailyRevenue.branch_id == branch_id)) or 0
    expense_count = (db.scalar(select(func.count()).select_from(MonthlyExpense).where(MonthlyExpense.branch_id == branch_id)) or 0) + (db.scalar(select(func.count()).select_from(Expense).where(Expense.branch_id == branch_id)) or 0)
    return _view(branch, users, revenue_count, expense_count)


@router.post("", response_model=BranchView, status_code=status.HTTP_201_CREATED)
def create_branch(body: BranchWrite, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "branches.create")
    name = body.name.strip()
    if db.scalar(select(Branch).where(func.lower(Branch.name) == name.lower())):
        raise HTTPException(status_code=409, detail="Branch name already exists")
    values = body.model_dump()
    values["name"] = name
    values["code"] = _unique_code(db, body.code or name)
    branch = Branch(**values)
    db.add(branch)
    db.commit()
    db.refresh(branch)
    return _view(branch, list(db.scalars(select(User))), 0, 0)


@router.put("/{branch_id}", response_model=BranchView)
def update_branch(branch_id: int, body: BranchWrite, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "branches.edit")
    branch = db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    name = body.name.strip()
    duplicate = db.scalar(select(Branch).where(func.lower(Branch.name) == name.lower(), Branch.id != branch_id))
    if duplicate:
        raise HTTPException(status_code=409, detail="Branch name already exists")
    values = body.model_dump()
    values["name"] = name
    values["code"] = _unique_code(db, body.code or name, branch_id)
    for field, value in values.items():
        setattr(branch, field, value)
    db.commit()
    db.refresh(branch)
    return get_branch(branch_id, current_user, db)


@router.patch("/{branch_id}/status", response_model=BranchView)
def toggle_status(branch_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "branches.edit")
    branch = db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    branch.active = not branch.active
    db.commit()
    db.refresh(branch)
    return get_branch(branch_id, current_user, db)


@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_branch(branch_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "branches.delete")
    branch = db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")
    financial = sum([
        db.scalar(select(func.count()).select_from(DailyRevenue).where(DailyRevenue.branch_id == branch_id)) or 0,
        db.scalar(select(func.count()).select_from(MonthlyExpense).where(MonthlyExpense.branch_id == branch_id)) or 0,
        db.scalar(select(func.count()).select_from(Expense).where(Expense.branch_id == branch_id)) or 0,
    ])
    users = list(db.scalars(select(User)))
    if financial or _user_count(branch_id, users):
        raise HTTPException(status_code=409, detail="Branch has financial records or assigned users and cannot be deleted")
    db.delete(branch)
    db.commit()
