from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.finance import Branch, DailyRevenue, MonthlyExpense
from app.models.user import User

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

DEFAULT_BRANCHES = ["Canyon Thai Spa", "Sheratoon Thai Spa", "Hyksos Thai Spa", "Crixus Duhok Thai Spa", "Crixus Sarsing Thai Spa"]


def seed_branches(db: Session) -> None:
    if db.scalar(select(func.count(Branch.id))) == 0:
        db.add_all([Branch(name=name) for name in DEFAULT_BRANCHES])
        db.commit()


def _share(amount: Decimal, percentage: Decimal) -> Decimal:
    return (amount * percentage / Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def _build_daily_report(db: Session, current_user: User, target_date: date) -> dict:
    branches = db.scalars(select(Branch).where(Branch.active.is_(True)).order_by(Branch.id)).all()
    revenue_rows = db.execute(
        select(DailyRevenue.branch_id, func.coalesce(func.sum(DailyRevenue.amount), 0), func.coalesce(func.sum(DailyRevenue.customer_count), 0), func.count(DailyRevenue.id))
        .where(DailyRevenue.business_date == target_date).group_by(DailyRevenue.branch_id)
    ).all()
    fixed_expense_rows = db.execute(
        select(MonthlyExpense.branch_id, MonthlyExpense.amount).where(MonthlyExpense.year == target_date.year, MonthlyExpense.month == target_date.month)
    ).all()
    revenue_by_branch = {branch_id: {"amount": Decimal(amount or 0), "customer_count": int(customers or 0), "entry_count": int(entries or 0)} for branch_id, amount, customers, entries in revenue_rows}
    expense_by_branch = {branch_id: Decimal(amount or 0) for branch_id, amount in fixed_expense_rows}
    normalized_role = str(current_user.role or "").strip().lower()
    allowed = set(current_user.allowed_branch_ids or [])
    restrict = normalized_role not in {"admin", "manager", "accountant"} and bool(allowed)
    branch_cards = []
    total_gross = total_company = total_hotel = total_expenses = Decimal(0)
    total_customers = submitted_centers = 0
    for branch in branches:
        if restrict and branch.id not in allowed:
            continue
        revenue_data = revenue_by_branch.get(branch.id, {"amount": Decimal(0), "customer_count": 0, "entry_count": 0})
        gross = revenue_data["amount"]
        company_percentage = Decimal(branch.company_revenue_percentage or 100)
        hotel_percentage = Decimal(branch.hotel_revenue_percentage or 0)
        company_share = _share(gross, company_percentage)
        hotel_share = gross - company_share
        expenses = expense_by_branch.get(branch.id, Decimal(0))
        has_entry = revenue_data["entry_count"] > 0
        submitted_centers += int(has_entry)
        total_gross += gross; total_company += company_share; total_hotel += hotel_share; total_expenses += expenses; total_customers += revenue_data["customer_count"]
        branch_cards.append({
            "branch_id": branch.id, "branch_name": branch.name, "branch_code": branch.code or "",
            "gross_revenue": int(gross), "company_revenue_percentage": float(company_percentage), "hotel_revenue_percentage": float(hotel_percentage),
            "company_revenue_share": int(company_share), "hotel_revenue_share": int(hotel_share), "revenue": int(company_share),
            "expenses": int(expenses), "net_profit": int(company_share - expenses), "customer_count": revenue_data["customer_count"],
            "entry_status": "submitted" if has_entry else "missing",
        })
    active_centers = len(branch_cards)
    return {"business_date": target_date.isoformat(), "branches": branch_cards, "company": {
        "gross_revenue": int(total_gross), "company_revenue_share": int(total_company), "hotel_revenue_share": int(total_hotel),
        "revenue": int(total_company), "expenses": int(total_expenses), "net_profit": int(total_company - total_expenses),
        "customer_count": total_customers, "active_centers": active_centers, "submitted_centers": submitted_centers, "missing_centers": active_centers - submitted_centers,
    }}


@router.get("/report")
def dashboard_report(business_date: date = Query(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    if str(current_user.role or "").strip().lower() != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can select a custom dashboard date")
    seed_branches(db)
    report = _build_daily_report(db, current_user, business_date); report["is_custom_date"] = True
    return report


@router.get("/yesterday")
def yesterday_dashboard(business_date: date | None = Query(default=None), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    seed_branches(db)
    if business_date is not None and str(current_user.role or "").strip().lower() != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can select a custom dashboard date")
    target_date = business_date or (date.today() - timedelta(days=1))
    report = _build_daily_report(db, current_user, target_date); report["is_custom_date"] = business_date is not None
    return report
