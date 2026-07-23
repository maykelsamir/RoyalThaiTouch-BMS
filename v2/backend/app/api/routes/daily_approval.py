from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased, joinedload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.finance import DailyRevenue
from app.models.user import User
from app.schemas.daily_approval import ApprovalEntryView, RejectionRequest

router = APIRouter(prefix="/daily-approval", tags=["daily-approval"])


def _can_approve(user: User) -> bool:
    return user.role.lower() == "admin" or "daily_entry.approve" in user.permissions


def _can_access_branch(user: User, branch_id: int) -> bool:
    return user.role.lower() == "admin" or not user.allowed_branch_ids or branch_id in user.allowed_branch_ids


def _require_approval_permission(user: User) -> None:
    if not _can_approve(user):
        raise HTTPException(status_code=403, detail="You do not have permission to approve daily entries")


def _serialize(item: DailyRevenue, usernames: dict[int, str]) -> ApprovalEntryView:
    return ApprovalEntryView(
        id=item.id,
        branch_id=item.branch_id,
        branch_name=item.branch.name,
        business_date=item.business_date,
        amount=item.amount,
        notes=item.notes,
        report_image=item.report_image or "",
        status=item.status,
        created_by=item.created_by,
        created_by_username=usernames.get(item.created_by) if item.created_by else None,
        approved_by=item.approved_by,
        approved_by_username=usernames.get(item.approved_by) if item.approved_by else None,
        approved_at=item.approved_at,
        rejected_by=item.rejected_by,
        rejected_by_username=usernames.get(item.rejected_by) if item.rejected_by else None,
        rejected_at=item.rejected_at,
        rejection_reason=item.rejection_reason or "",
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


def _load_usernames(db: Session, items: list[DailyRevenue]) -> dict[int, str]:
    user_ids = {
        user_id
        for item in items
        for user_id in (item.created_by, item.approved_by, item.rejected_by)
        if user_id is not None
    }
    if not user_ids:
        return {}
    users = db.scalars(select(User).where(User.id.in_(user_ids))).all()
    return {user.id: user.username for user in users}


@router.get("", response_model=list[ApprovalEntryView])
def list_entries(
    entry_status: str = Query("submitted", alias="status"),
    branch_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ApprovalEntryView]:
    _require_approval_permission(current_user)
    query = select(DailyRevenue).options(joinedload(DailyRevenue.branch))
    if entry_status and entry_status != "all":
        query = query.where(DailyRevenue.status == entry_status)
    if branch_id is not None:
        if not _can_access_branch(current_user, branch_id):
            raise HTTPException(status_code=403, detail="Branch access denied")
        query = query.where(DailyRevenue.branch_id == branch_id)
    if date_from is not None:
        query = query.where(DailyRevenue.business_date >= date_from)
    if date_to is not None:
        query = query.where(DailyRevenue.business_date <= date_to)
    query = query.order_by(DailyRevenue.business_date.desc(), DailyRevenue.id.desc())
    items = [item for item in db.scalars(query).all() if _can_access_branch(current_user, item.branch_id)]
    usernames = _load_usernames(db, items)
    return [_serialize(item, usernames) for item in items]


@router.post("/{entry_id}/approve", response_model=ApprovalEntryView)
def approve_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApprovalEntryView:
    _require_approval_permission(current_user)
    item = db.scalar(select(DailyRevenue).options(joinedload(DailyRevenue.branch)).where(DailyRevenue.id == entry_id))
    if not item:
        raise HTTPException(status_code=404, detail="Revenue entry not found")
    if not _can_access_branch(current_user, item.branch_id):
        raise HTTPException(status_code=403, detail="Branch access denied")
    if item.status != "submitted":
        raise HTTPException(status_code=409, detail="Only submitted entries can be approved")

    now = datetime.now(timezone.utc)
    item.status = "approved"
    item.approved = True
    item.approved_by = current_user.id
    item.approved_at = now
    item.rejected_by = None
    item.rejected_at = None
    item.rejection_reason = ""
    db.commit()
    db.refresh(item)
    return _serialize(item, _load_usernames(db, [item]))


@router.post("/{entry_id}/reject", response_model=ApprovalEntryView)
def reject_entry(
    entry_id: int,
    body: RejectionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ApprovalEntryView:
    _require_approval_permission(current_user)
    item = db.scalar(select(DailyRevenue).options(joinedload(DailyRevenue.branch)).where(DailyRevenue.id == entry_id))
    if not item:
        raise HTTPException(status_code=404, detail="Revenue entry not found")
    if not _can_access_branch(current_user, item.branch_id):
        raise HTTPException(status_code=403, detail="Branch access denied")
    if item.status != "submitted":
        raise HTTPException(status_code=409, detail="Only submitted entries can be rejected")

    now = datetime.now(timezone.utc)
    item.status = "rejected"
    item.approved = False
    item.approved_by = None
    item.approved_at = None
    item.rejected_by = current_user.id
    item.rejected_at = now
    item.rejection_reason = body.reason.strip()
    db.commit()
    db.refresh(item)
    return _serialize(item, _load_usernames(db, [item]))
