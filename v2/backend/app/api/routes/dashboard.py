from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.finance import Branch, DailyRevenue, MonthlyExpense
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

DEFAULT_BRANCHES = [
    "Canyon Thai Spa",
    "Sheratoon Thai Spa",
    "Hyksos Thai Spa",
    "Crixus Duhok Thai Spa",
    "Crixus Sarsing Thai Spa",
]


def seed_branches(db: Session) -> None:
    if db.scalar(select(func.count(Branch.id))) == 0:
        db.add_all([Branch(name=name) for name in DEFAULT_BRANCHES])
        db.commit()


def _build_daily_report(db: Session, current_user: User, target_date: date) -> dict:
    branches = db.scalars(select(Branch).where(Branch.active.is_(True)).order_by(Branch.id)).all()

    revenue_rows = db.execute(
        select(
            DailyRevenue.branch_id,
            func.coalesce(func.sum(DailyRevenue.amount), 0),
            func.coalesce(func.sum(DailyRevenue.customer_count), 0),
            func.count(DailyRevenue.id),
        )
        .where(DailyRevenue.business_date == target_date)
        .group_by(DailyRevenue.branch_id)
    ).all()
    fixed_expense_rows = db.execute(
        select(MonthlyExpense.branch_id, MonthlyExpense.amount).where(
            MonthlyExpense.year == target_date.year,
            MonthlyExpense.month == target_date.month,
        )
    ).all()

    revenue_by_branch = {
        branch_id: {
            "amount": Decimal(amount or 0),
            "customer_count": int(customer_count or 0),
            "entry_count": int(entry_count or 0),
        }
        for branch_id, amount, customer_count, entry_count in revenue_rows
    }
    # MonthlyExpense is retained as the storage table name for compatibility,
    # but its amount now represents the branch's fixed expense PER DAY.
    expense_by_branch = {branch_id: Decimal(amount or 0) for branch_id, amount in fixed_expense_rows}

    normalized_role = str(current_user.role or "").strip().lower()
    allowed = set(current_user.allowed_branch_ids or [])
    restrict = normalized_role not in {"admin", "manager", "accountant"} and bool(allowed)

    branch_cards = []
    total_revenue = Decimal(0)
    total_expenses = Decimal(0)
    total_customers = 0
    submitted_centers = 0

    for branch in branches:
        if restrict and branch.id not in allowed:
            continue
        revenue_data = revenue_by_branch.get(branch.id, {"amount": Decimal(0), "customer_count": 0, "entry_count": 0})
        revenue = revenue_data["amount"]
        expenses = expense_by_branch.get(branch.id, Decimal(0))
        net_profit = revenue - expenses
        has_entry = revenue_data["entry_count"] > 0
        if has_entry:
            submitted_centers += 1
        total_revenue += revenue
        total_expenses += expenses
        total_customers += revenue_data["customer_count"]
        branch_cards.append({
            "branch_id": branch.id,
            "branch_name": branch.name,
            "branch_code": branch.code or "",
            "revenue": int(revenue),
            "expenses": int(expenses),
            "net_profit": int(net_profit),
            "customer_count": revenue_data["customer_count"],
            "entry_status": "submitted" if has_entry else "missing",
        })

    active_centers = len(branch_cards)
    return {
        "business_date": target_date.isoformat(),
        "branches": branch_cards,
        "company": {
            "revenue": int(total_revenue),
            "expenses": int(total_expenses),
            "net_profit": int(total_revenue - total_expenses),
            "customer_count": total_customers,
            "active_centers": active_centers,
            "submitted_centers": submitted_centers,
            "missing_centers": active_centers - submitted_centers,
        },
    }


@router.get("/report")
def dashboard_report(
    business_date: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if str(current_user.role or "").strip().lower() != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can select a custom dashboard date")
    seed_branches(db)
    report = _build_daily_report(db, current_user, business_date)
    report["is_custom_date"] = True
    return report


@router.get("/yesterday")
def yesterday_dashboard(
    business_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    seed_branches(db)
    normalized_role = str(current_user.role or "").strip().lower()
    if business_date is not None and normalized_role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can select a custom dashboard date")
    target_date = business_date or (date.today() - timedelta(days=1))
    report = _build_daily_report(db, current_user, target_date)
    report["is_custom_date"] = business_date is not None
    return report
