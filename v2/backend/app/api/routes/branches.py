import re
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.audit import AuditLog
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
    base = _slug(preferred); code = base; counter = 2
    while True:
        query = select(Branch).where(func.lower(Branch.code) == code.lower())
        if exclude_id is not None:
            query = query.where(Branch.id != exclude_id)
        if not db.scalar(query):
            return code
        code = f"{base[:25]}-{counter}"; counter += 1


def _user_count(branch_id: int, users: list[User]) -> int:
    return sum(1 for user in users if branch_id in (user.allowed_branch_ids or []))


def _view(branch: Branch, users: list[User], revenue_count: int, expense_count: int) -> BranchView:
    return BranchView(
        id=branch.id, name=branch.name, code=branch.code or "", country=branch.country or "Iraq", city=branch.city or "",
        address=branch.address or "", phone=branch.phone or "", email=branch.email or "", whatsapp=branch.whatsapp or "",
        website=branch.website or "", facebook=branch.facebook or "", instagram=branch.instagram or "", tiktok=branch.tiktok or "",
        youtube=branch.youtube or "", telegram=branch.telegram or "", snapchat=branch.snapchat or "", google_maps=branch.google_maps or "",
        manager_name=branch.manager_name or "", opening_date=branch.opening_date,
        company_revenue_percentage=branch.company_revenue_percentage or 100,
        hotel_revenue_percentage=branch.hotel_revenue_percentage or 0,
        logo=branch.logo or "", cover_image=branch.cover_image or "", notes=branch.notes or "", active=branch.active,
        user_count=_user_count(branch.id, users), revenue_count=revenue_count, expense_count=expense_count,
        created_at=branch.created_at, updated_at=branch.updated_at,
    )


def _month_key(year: int, month: int) -> str:
    return f"{year:04d}-{month:02d}"


def _previous_months(count: int = 12) -> list[tuple[int, int]]:
    today = date.today(); year, month = today.year, today.month; rows = []
    for _ in range(count):
        rows.append((year, month)); month -= 1
        if month == 0: month = 12; year -= 1
    return list(reversed(rows))


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
    _require(current_user, "branches.view"); rows = list(db.scalars(select(Branch)))
    return BranchStats(total=len(rows), active=sum(1 for item in rows if item.active), inactive=sum(1 for item in rows if not item.active), managers=len({item.manager_name.strip().lower() for item in rows if item.manager_name.strip()}))


@router.get("/{branch_id}/profile")
def branch_profile(branch_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "branches.view")
    branch = db.get(Branch, branch_id)
    if not branch: raise HTTPException(status_code=404, detail="Branch not found")
    users = [user for user in db.scalars(select(User).order_by(User.full_name, User.username)) if branch_id in (user.allowed_branch_ids or [])]
    revenues = list(db.scalars(select(DailyRevenue).where(DailyRevenue.branch_id == branch_id).order_by(DailyRevenue.business_date)))
    monthly_expenses = list(db.scalars(select(MonthlyExpense).where(MonthlyExpense.branch_id == branch_id)))
    legacy_expenses = list(db.scalars(select(Expense).where(Expense.branch_id == branch_id)))
    company_pct = int(branch.company_revenue_percentage or 100)
    total_gross = sum(int(item.amount or 0) for item in revenues)
    total_company = round(total_gross * company_pct / 100)
    total_hotel = total_gross - total_company
    total_expenses = sum(int(item.amount or 0) for item in monthly_expenses) + sum(int(item.amount or 0) for item in legacy_expenses)
    pending = sum(1 for item in revenues if item.status in {"submitted", "pending"})
    months = _previous_months()
    performance = {_month_key(y,m): {"month": _month_key(y,m), "gross_revenue":0, "revenue":0, "hotel_share":0, "expenses":0, "net_profit":0} for y,m in months}
    for item in revenues:
        key = _month_key(item.business_date.year, item.business_date.month)
        if key in performance:
            gross = int(item.amount or 0); company = round(gross * company_pct / 100)
            performance[key]["gross_revenue"] += gross; performance[key]["revenue"] += company; performance[key]["hotel_share"] += gross-company
    for item in monthly_expenses:
        key = _month_key(item.year, item.month)
        if key in performance: performance[key]["expenses"] += int(item.amount or 0)
    for item in legacy_expenses:
        key = _month_key(item.business_date.year, item.business_date.month)
        if key in performance: performance[key]["expenses"] += int(item.amount or 0)
    for row in performance.values(): row["net_profit"] = row["revenue"] - row["expenses"]
    audits = list(db.scalars(select(AuditLog).where(or_(AuditLog.branch_id == branch_id, (AuditLog.module == "branches") & (AuditLog.entity_id == str(branch_id)))).order_by(AuditLog.created_at.desc()).limit(50)))
    return {
        "branch": _view(branch, users, len(revenues), len(monthly_expenses)+len(legacy_expenses)).model_dump(mode="json"),
        "summary": {"gross_revenue":total_gross, "company_revenue_share":total_company, "hotel_revenue_share":total_hotel, "total_revenue":total_company, "total_expenses":total_expenses, "net_profit":total_company-total_expenses, "users":len(users), "pending_approvals":pending, "approved_entries":sum(1 for item in revenues if item.status == "approved" or item.approved)},
        "users": [{"id":u.id,"username":u.username,"full_name":u.full_name,"role":u.role,"email":u.email,"phone":u.phone,"active":u.active,"last_login_at":u.last_login_at} for u in users],
        "performance": list(performance.values()),
        "audit_history": [{"id":a.id,"created_at":a.created_at,"username":a.username,"role":a.role,"action":a.action,"module":a.module,"result":a.result,"description":a.description,"ip_address":a.ip_address} for a in audits],
    }


@router.get("/{branch_id}", response_model=BranchView)
def get_branch(branch_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "branches.view"); branch = db.get(Branch, branch_id)
    if not branch: raise HTTPException(status_code=404, detail="Branch not found")
    users = list(db.scalars(select(User)))
    revenue_count = db.scalar(select(func.count()).select_from(DailyRevenue).where(DailyRevenue.branch_id == branch_id)) or 0
    expense_count = (db.scalar(select(func.count()).select_from(MonthlyExpense).where(MonthlyExpense.branch_id == branch_id)) or 0) + (db.scalar(select(func.count()).select_from(Expense).where(Expense.branch_id == branch_id)) or 0)
    return _view(branch, users, revenue_count, expense_count)


@router.post("", response_model=BranchView, status_code=status.HTTP_201_CREATED)
def create_branch(body: BranchWrite, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "branches.create"); name = body.name.strip()
    if db.scalar(select(Branch).where(func.lower(Branch.name) == name.lower())): raise HTTPException(status_code=409, detail="Branch name already exists")
    values = body.model_dump(); values["name"] = name; values["code"] = _unique_code(db, body.code or name)
    branch = Branch(**values); db.add(branch); db.commit(); db.refresh(branch)
    return _view(branch, list(db.scalars(select(User))), 0, 0)


@router.put("/{branch_id}", response_model=BranchView)
def update_branch(branch_id: int, body: BranchWrite, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "branches.edit"); branch = db.get(Branch, branch_id)
    if not branch: raise HTTPException(status_code=404, detail="Branch not found")
    name = body.name.strip(); duplicate = db.scalar(select(Branch).where(func.lower(Branch.name) == name.lower(), Branch.id != branch_id))
    if duplicate: raise HTTPException(status_code=409, detail="Branch name already exists")
    values = body.model_dump(); values["name"] = name; values["code"] = _unique_code(db, body.code or name, branch_id)
    for field, value in values.items(): setattr(branch, field, value)
    db.commit(); db.refresh(branch); return get_branch(branch_id, current_user, db)


@router.patch("/{branch_id}/status", response_model=BranchView)
def toggle_status(branch_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "branches.edit"); branch = db.get(Branch, branch_id)
    if not branch: raise HTTPException(status_code=404, detail="Branch not found")
    branch.active = not branch.active; db.commit(); db.refresh(branch); return get_branch(branch_id, current_user, db)


@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_branch(branch_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "branches.delete"); branch = db.get(Branch, branch_id)
    if not branch: raise HTTPException(status_code=404, detail="Branch not found")
    financial = sum([db.scalar(select(func.count()).select_from(DailyRevenue).where(DailyRevenue.branch_id == branch_id)) or 0, db.scalar(select(func.count()).select_from(MonthlyExpense).where(MonthlyExpense.branch_id == branch_id)) or 0, db.scalar(select(func.count()).select_from(Expense).where(Expense.branch_id == branch_id)) or 0])
    users = list(db.scalars(select(User)))
    if financial or _user_count(branch_id, users): raise HTTPException(status_code=409, detail="Branch has financial records or assigned users and cannot be deleted")
    db.delete(branch); db.commit()
