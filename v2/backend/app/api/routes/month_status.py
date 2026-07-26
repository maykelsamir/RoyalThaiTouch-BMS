from calendar import monthrange
from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.finance import Branch, DailyRevenue
from app.models.user import User

router = APIRouter(prefix="/month-status", tags=["month-status"])


class MonthStatusOverride(BaseModel):
    branch_id: int
    business_date: date
    state: str


class MonthAmountOverride(BaseModel):
    branch_id: int
    business_date: date
    amount: Decimal = Field(ge=0)


class MonthEntryEdit(BaseModel):
    branch_id: int
    business_date: date
    amount: Decimal = Field(ge=0)
    customer_count: int = Field(default=0, ge=0)
    state: str
    notes: str = ""
    reason: str = Field(min_length=3, max_length=1000)


def _can_access_branch(user: User, branch_id: int) -> bool:
    return user.role.lower() == "admin" or not user.allowed_branch_ids or branch_id in user.allowed_branch_ids


def _entry_state(item: DailyRevenue | None, business_date: date, today: date) -> str:
    if business_date > today and item is None:
        return "upcoming"
    if item is None:
        return "missing"
    if item.status == "approved" or item.approved:
        return "complete"
    if item.status == "submitted":
        return "pending"
    if item.status == "rejected":
        return "rejected"
    return "draft"


def _apply_state(item: DailyRevenue, state: str) -> None:
    if state == "complete":
        item.status = "approved"
        item.approved = True
    elif state == "pending":
        item.status = "submitted"
        item.approved = False
    elif state == "rejected":
        item.status = "rejected"
        item.approved = False
    else:
        item.status = "draft"
        item.approved = False


@router.put("/edit")
def edit_month_entry(body: MonthEntryEdit, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if current_user.role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can edit month entries")
    allowed_states = {"missing", "draft", "pending", "complete", "rejected"}
    if body.state not in allowed_states:
        raise HTTPException(status_code=422, detail="Invalid status")
    reason = body.reason.strip()
    if len(reason) < 3:
        raise HTTPException(status_code=422, detail="Reason for change is required")
    branch = db.get(Branch, body.branch_id)
    if not branch or not branch.active:
        raise HTTPException(status_code=404, detail="Branch not found")

    item = db.scalar(select(DailyRevenue).where(DailyRevenue.branch_id == body.branch_id, DailyRevenue.business_date == body.business_date))
    old_state = _entry_state(item, body.business_date, date.today())
    old_data = {
        "state": old_state,
        "status": item.status if item else None,
        "approved": bool(item.approved) if item else False,
        "amount": float(item.amount) if item else 0,
        "customer_count": int(item.customer_count) if item else 0,
        "notes": item.notes if item else "",
    }

    if body.state == "missing":
        entity_id = str(item.id) if item else ""
        if item:
            db.delete(item)
        result = {
            "entry_id": None,
            "state": "missing",
            "status": None,
            "approved": False,
            "amount": 0,
            "customer_count": 0,
            "notes": "",
        }
    else:
        if item is None:
            item = DailyRevenue(
                branch_id=body.branch_id,
                business_date=body.business_date,
                amount=body.amount,
                customer_count=body.customer_count,
                notes=body.notes.strip(),
                report_image="",
                status="draft",
                created_by=current_user.id,
                approved=False,
            )
            db.add(item)
            db.flush()
        else:
            item.amount = body.amount
            item.customer_count = body.customer_count
            item.notes = body.notes.strip()
        _apply_state(item, body.state)
        entity_id = str(item.id)
        result = {
            "entry_id": item.id,
            "state": body.state,
            "status": item.status,
            "approved": bool(item.approved),
            "amount": float(item.amount),
            "customer_count": int(item.customer_count),
            "notes": item.notes or "",
        }

    after_data = {**result, "reason": reason}
    db.add(AuditLog(
        user_id=current_user.id,
        username=current_user.username,
        role=current_user.role,
        branch_id=body.branch_id,
        action="month_status.admin_edit",
        module="month_status",
        entity_type="daily_revenue",
        entity_id=entity_id,
        result="success",
        description=f"Admin changed {branch.name} entry for {body.business_date.isoformat()} from {old_state} to {body.state}. Reason: {reason}",
        before_data=old_data,
        after_data=after_data,
        request_method=request.method,
        request_path=str(request.url.path),
        ip_address=request.client.host if request.client else "",
        user_agent=request.headers.get("user-agent", ""),
    ))
    db.commit()
    return {"ok": True, "branch_id": body.branch_id, "business_date": body.business_date.isoformat(), **result}


@router.put("/amount")
def override_month_amount(body: MonthAmountOverride, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if current_user.role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can change daily revenue amounts")
    branch = db.get(Branch, body.branch_id)
    if not branch or not branch.active:
        raise HTTPException(status_code=404, detail="Branch not found")
    item = db.scalar(select(DailyRevenue).where(DailyRevenue.branch_id == body.branch_id, DailyRevenue.business_date == body.business_date))
    old_amount = Decimal(item.amount) if item else Decimal("0")
    created = item is None
    if item is None:
        item = DailyRevenue(branch_id=body.branch_id, business_date=body.business_date, amount=body.amount, customer_count=0, notes="Created by administrator from Month Entry Status", report_image="", status="draft", created_by=current_user.id, approved=False)
        db.add(item); db.flush()
    else:
        item.amount = body.amount
    db.add(AuditLog(user_id=current_user.id, username=current_user.username, role=current_user.role, branch_id=body.branch_id, action="month_status.amount_override", module="month_status", entity_type="daily_revenue", entity_id=str(item.id), result="success", description=f"Changed {branch.name} daily revenue for {body.business_date.isoformat()} from {old_amount} to {body.amount}", before_data={"amount": float(old_amount), "entry_existed": not created}, after_data={"amount": float(body.amount), "entry_created": created}, request_method=request.method, request_path=str(request.url.path), ip_address=request.client.host if request.client else "", user_agent=request.headers.get("user-agent", "")))
    db.commit()
    return {"ok": True, "entry_id": item.id, "amount": float(item.amount), "branch_id": body.branch_id, "business_date": body.business_date.isoformat()}


@router.put("/override")
def override_month_status(body: MonthStatusOverride, request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    if current_user.role.lower() != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can change month entry status")
    allowed_states = {"missing", "draft", "pending", "complete", "rejected"}
    if body.state not in allowed_states:
        raise HTTPException(status_code=422, detail="Invalid status")
    branch = db.get(Branch, body.branch_id)
    if not branch or not branch.active:
        raise HTTPException(status_code=404, detail="Branch not found")
    item = db.scalar(select(DailyRevenue).where(DailyRevenue.branch_id == body.branch_id, DailyRevenue.business_date == body.business_date))
    old_state = _entry_state(item, body.business_date, date.today())
    old_data = {"state": old_state, "status": item.status if item else None, "approved": bool(item.approved) if item else False, "amount": int(item.amount) if item else 0, "customer_count": int(item.customer_count) if item else 0}
    if body.state == "missing":
        entity_id = str(item.id) if item else ""
        if item:
            db.delete(item)
    else:
        if item is None:
            item = DailyRevenue(branch_id=body.branch_id, business_date=body.business_date, amount=0, customer_count=0, notes="Created by administrator from Month Entry Status", report_image="", status="draft", created_by=current_user.id, approved=False)
            db.add(item); db.flush()
        _apply_state(item, body.state)
        entity_id = str(item.id)
    db.add(AuditLog(user_id=current_user.id, username=current_user.username, role=current_user.role, branch_id=body.branch_id, action="month_status.override", module="month_status", entity_type="daily_revenue", entity_id=entity_id, result="success", description=f"Changed {branch.name} entry for {body.business_date.isoformat()} from {old_state} to {body.state}", before_data=old_data, after_data={"state": body.state}, request_method=request.method, request_path=str(request.url.path), ip_address=request.client.host if request.client else "", user_agent=request.headers.get("user-agent", "")))
    db.commit()
    return {"ok": True, "state": body.state, "branch_id": body.branch_id, "business_date": body.business_date.isoformat()}


@router.get("")
def month_status(year: int = Query(..., ge=2020, le=2100), month: int = Query(..., ge=1, le=12), branch_id: int | None = Query(default=None), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    first_day = date(year, month, 1)
    last_day = date(year, month, monthrange(year, month)[1])
    today = date.today()
    branches = [branch for branch in db.scalars(select(Branch).where(Branch.active.is_(True)).order_by(Branch.name)) if _can_access_branch(current_user, branch.id)]
    if branch_id is not None:
        if not _can_access_branch(current_user, branch_id):
            raise HTTPException(status_code=403, detail="Branch access denied")
        branches = [branch for branch in branches if branch.id == branch_id]
        if not branches:
            raise HTTPException(status_code=404, detail="Branch not found")
    allowed_ids = [branch.id for branch in branches]
    entries_by_key = {}
    if allowed_ids:
        query = select(DailyRevenue).where(DailyRevenue.branch_id.in_(allowed_ids), DailyRevenue.business_date >= first_day, DailyRevenue.business_date <= last_day)
        entries_by_key = {(item.branch_id, item.business_date): item for item in db.scalars(query)}
    branch_results = []
    company_summary = {"complete": 0, "pending": 0, "draft": 0, "rejected": 0, "missing": 0, "upcoming": 0}
    company_customers = 0
    for branch in branches:
        days = []
        summary = {"complete": 0, "pending": 0, "draft": 0, "rejected": 0, "missing": 0, "upcoming": 0}
        total_customers = 0
        for day_number in range(1, last_day.day + 1):
            business_date = date(year, month, day_number)
            item = entries_by_key.get((branch.id, business_date))
            state = _entry_state(item, business_date, today)
            customers = int(item.customer_count) if item else 0
            total_customers += customers
            company_customers += customers
            summary[state] += 1; company_summary[state] += 1
            days.append({"date": business_date.isoformat(), "day": day_number, "state": state, "entry_id": item.id if item else None, "amount": float(item.amount) if item else 0, "customer_count": customers, "status": item.status if item else None, "notes": item.notes if item else ""})
        elapsed_days = sum(summary[key] for key in ("complete", "pending", "draft", "rejected", "missing"))
        branch_results.append({"branch_id": branch.id, "branch_name": branch.name, "summary": summary, "completion_rate": round((summary["complete"] / elapsed_days) * 100, 1) if elapsed_days else 0, "total_customers": total_customers, "days": days})
    elapsed_company_days = sum(company_summary[key] for key in ("complete", "pending", "draft", "rejected", "missing"))
    return {"year": year, "month": month, "month_label": first_day.strftime("%B %Y"), "today": today.isoformat(), "company_summary": company_summary, "company_completion_rate": round((company_summary["complete"] / elapsed_company_days) * 100, 1) if elapsed_company_days else 0, "company_total_customers": company_customers, "branches": branch_results}