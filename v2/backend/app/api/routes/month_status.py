from calendar import monthrange
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.finance import Branch, DailyRevenue
from app.models.user import User

router = APIRouter(prefix="/month-status", tags=["month-status"])


def _can_access_branch(user: User, branch_id: int) -> bool:
    return user.role.lower() == "admin" or not user.allowed_branch_ids or branch_id in user.allowed_branch_ids


@router.get("")
def month_status(
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
    branch_id: int | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    first_day = date(year, month, 1)
    last_day = date(year, month, monthrange(year, month)[1])
    today = date.today()

    branch_query = select(Branch).where(Branch.active.is_(True)).order_by(Branch.name)
    branches = [branch for branch in db.scalars(branch_query) if _can_access_branch(current_user, branch.id)]

    if branch_id is not None:
        if not _can_access_branch(current_user, branch_id):
            raise HTTPException(status_code=403, detail="Branch access denied")
        branches = [branch for branch in branches if branch.id == branch_id]
        if not branches:
            raise HTTPException(status_code=404, detail="Branch not found")

    allowed_ids = [branch.id for branch in branches]
    entries_by_key: dict[tuple[int, date], DailyRevenue] = {}
    if allowed_ids:
        query = select(DailyRevenue).where(
            DailyRevenue.branch_id.in_(allowed_ids),
            DailyRevenue.business_date >= first_day,
            DailyRevenue.business_date <= last_day,
        )
        entries_by_key = {(item.branch_id, item.business_date): item for item in db.scalars(query)}

    branch_results = []
    company_summary = {"complete": 0, "pending": 0, "draft": 0, "rejected": 0, "missing": 0, "upcoming": 0}

    for branch in branches:
        days = []
        summary = {"complete": 0, "pending": 0, "draft": 0, "rejected": 0, "missing": 0, "upcoming": 0}

        for day_number in range(1, last_day.day + 1):
            business_date = date(year, month, day_number)
            item = entries_by_key.get((branch.id, business_date))

            if business_date > today:
                state = "upcoming"
            elif item is None:
                state = "missing"
            elif item.status == "approved" or item.approved:
                state = "complete"
            elif item.status == "submitted":
                state = "pending"
            elif item.status == "rejected":
                state = "rejected"
            else:
                state = "draft"

            summary[state] += 1
            company_summary[state] += 1
            days.append({
                "date": business_date.isoformat(),
                "day": day_number,
                "state": state,
                "entry_id": item.id if item else None,
                "amount": int(item.amount) if item else 0,
                "status": item.status if item else None,
            })

        elapsed_days = summary["complete"] + summary["pending"] + summary["draft"] + summary["rejected"] + summary["missing"]
        completion_rate = round((summary["complete"] / elapsed_days) * 100, 1) if elapsed_days else 0
        branch_results.append({
            "branch_id": branch.id,
            "branch_name": branch.name,
            "summary": summary,
            "completion_rate": completion_rate,
            "days": days,
        })

    elapsed_company_days = sum(company_summary[key] for key in ("complete", "pending", "draft", "rejected", "missing"))
    company_rate = round((company_summary["complete"] / elapsed_company_days) * 100, 1) if elapsed_company_days else 0

    return {
        "year": year,
        "month": month,
        "month_label": first_day.strftime("%B %Y"),
        "today": today.isoformat(),
        "company_summary": company_summary,
        "company_completion_rate": company_rate,
        "branches": branch_results,
    }
