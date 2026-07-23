from datetime import date, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.finance import Branch, DailyRevenue, Expense
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


@router.get("/yesterday")
def yesterday_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    seed_branches(db)
    target_date = date.today() - timedelta(days=1)
    branches = db.scalars(select(Branch).where(Branch.active.is_(True)).order_by(Branch.id)).all()

    revenue_rows = db.execute(
        select(DailyRevenue.branch_id, func.coalesce(func.sum(DailyRevenue.amount), 0))
        .where(DailyRevenue.business_date == target_date)
        .group_by(DailyRevenue.branch_id)
    ).all()
    expense_rows = db.execute(
        select(Expense.branch_id, func.coalesce(func.sum(Expense.amount), 0))
        .where(Expense.business_date == target_date)
        .group_by(Expense.branch_id)
    ).all()

    revenue_by_branch = {branch_id: Decimal(amount or 0) for branch_id, amount in revenue_rows}
    expense_by_branch = {branch_id: Decimal(amount or 0) for branch_id, amount in expense_rows}

    branch_cards = []
    total_revenue = Decimal(0)
    total_expenses = Decimal(0)

    allowed = set(current_user.allowed_branch_ids or [])
    restrict = current_user.role.lower() not in {"admin", "manager", "accountant"} and bool(allowed)

    for branch in branches:
        if restrict and branch.id not in allowed:
            continue
        revenue = revenue_by_branch.get(branch.id, Decimal(0))
        expenses = expense_by_branch.get(branch.id, Decimal(0))
        net_profit = revenue - expenses
        total_revenue += revenue
        total_expenses += expenses
        branch_cards.append({
            "branch_id": branch.id,
            "branch_name": branch.name,
            "revenue": int(revenue),
            "expenses": int(expenses),
            "net_profit": int(net_profit),
        })

    return {
        "business_date": target_date.isoformat(),
        "branches": branch_cards,
        "company": {
            "revenue": int(total_revenue),
            "expenses": int(total_expenses),
            "net_profit": int(total_revenue - total_expenses),
        },
    }
