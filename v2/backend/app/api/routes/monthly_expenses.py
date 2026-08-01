from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.finance import Branch, MonthlyExpense
from app.models.user import User
from app.schemas.monthly_expense import MonthlyExpenseSave, MonthlyExpenseView
from app.services.effective_expenses import effective_expenses

router = APIRouter(prefix="/monthly-expenses", tags=["monthly-expenses"])


def _can_access_branch(user: User, branch_id: int) -> bool:
    return user.role.lower() == "admin" or not user.allowed_branch_ids or branch_id in user.allowed_branch_ids


def _view(branch: Branch, source: MonthlyExpense | None, year: int, month: int) -> MonthlyExpenseView:
    is_current = bool(source and source.year == year and source.month == month)
    return MonthlyExpenseView(
        id=source.id if is_current else None,
        branch_id=branch.id,
        branch_name=branch.name,
        year=year,
        month=month,
        amount=source.amount if source else 0,
        notes=source.notes if source else "",
        inherited=bool(source and not is_current),
        source_year=source.year if source else None,
        source_month=source.month if source else None,
        updated_by=source.updated_by if source else None,
        updated_at=source.updated_at if source else None,
    )


@router.get("", response_model=list[MonthlyExpenseView])
def list_monthly_expenses(
    year: int,
    month: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MonthlyExpenseView]:
    if year < 2020 or year > 2100 or month < 1 or month > 12:
        raise HTTPException(status_code=422, detail="Invalid year or month")

    branches = list(db.scalars(select(Branch).where(Branch.active.is_(True)).order_by(Branch.name)))
    branches = [branch for branch in branches if _can_access_branch(current_user, branch.id)]
    effective = effective_expenses(db, [branch.id for branch in branches], [(year, month)])
    return [_view(branch, effective.get((branch.id, year, month)), year, month) for branch in branches]


@router.put("", response_model=MonthlyExpenseView)
def save_monthly_expense(
    body: MonthlyExpenseSave,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MonthlyExpenseView:
    if current_user.role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can change monthly expenses")

    branch = db.get(Branch, body.branch_id)
    if not branch or not branch.active:
        raise HTTPException(status_code=404, detail="Branch not found")

    item = db.scalar(
        select(MonthlyExpense).where(
            MonthlyExpense.branch_id == body.branch_id,
            MonthlyExpense.year == body.year,
            MonthlyExpense.month == body.month,
        )
    )
    if item is None:
        item = MonthlyExpense(
            branch_id=body.branch_id,
            year=body.year,
            month=body.month,
            amount=body.amount,
            notes=body.notes.strip(),
            updated_by=current_user.id,
        )
        db.add(item)
    else:
        item.amount = body.amount
        item.notes = body.notes.strip()
        item.updated_by = current_user.id

    db.commit()
    db.refresh(item)
    return _view(branch, item, body.year, body.month)
