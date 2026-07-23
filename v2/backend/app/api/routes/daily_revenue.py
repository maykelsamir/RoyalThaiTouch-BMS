from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.finance import Branch, DailyRevenue
from app.models.user import User
from app.schemas.daily_revenue import BranchOption, DailyRevenueCreate, DailyRevenueUpdate, DailyRevenueView

router = APIRouter(prefix="/daily-revenue", tags=["daily-revenue"])


def _can_access_branch(user: User, branch_id: int) -> bool:
    return user.role.lower() == "admin" or not user.allowed_branch_ids or branch_id in user.allowed_branch_ids


def _can_create(user: User) -> bool:
    return user.role.lower() == "admin" or "daily_entry.create" in user.permissions


def _view(item: DailyRevenue) -> DailyRevenueView:
    return DailyRevenueView(
        id=item.id,
        branch_id=item.branch_id,
        branch_name=item.branch.name,
        business_date=item.business_date,
        amount=item.amount,
        notes=item.notes,
        report_image=item.report_image or "",
        status=item.status,
        created_by=item.created_by,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


@router.get("/branches", response_model=list[BranchOption])
def branches(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[BranchOption]:
    query = select(Branch).where(Branch.active.is_(True)).order_by(Branch.name)
    items = list(db.scalars(query))
    return [BranchOption(id=item.id, name=item.name) for item in items if _can_access_branch(current_user, item.id)]


@router.get("", response_model=list[DailyRevenueView])
def list_entries(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[DailyRevenueView]:
    query = select(DailyRevenue).options(joinedload(DailyRevenue.branch)).order_by(DailyRevenue.business_date.desc(), DailyRevenue.id.desc())
    items = list(db.scalars(query))
    return [_view(item) for item in items if _can_access_branch(current_user, item.branch_id)]


@router.post("", response_model=DailyRevenueView, status_code=status.HTTP_201_CREATED)
def create_entry(body: DailyRevenueCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DailyRevenueView:
    if not _can_create(current_user):
        raise HTTPException(status_code=403, detail="You do not have permission to create daily revenue")
    if not _can_access_branch(current_user, body.branch_id):
        raise HTTPException(status_code=403, detail="Branch access denied")
    branch = db.get(Branch, body.branch_id)
    if not branch or not branch.active:
        raise HTTPException(status_code=404, detail="Branch not found")
    existing = db.scalar(select(DailyRevenue).where(DailyRevenue.branch_id == body.branch_id, DailyRevenue.business_date == body.business_date))
    if existing:
        raise HTTPException(status_code=409, detail="Revenue already exists for this branch and date")
    item = DailyRevenue(
        branch_id=body.branch_id,
        business_date=body.business_date,
        amount=body.amount,
        notes=body.notes.strip(),
        report_image=body.report_image,
        status="draft",
        created_by=current_user.id,
        approved=False,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    item.branch = branch
    return _view(item)


@router.put("/{entry_id}", response_model=DailyRevenueView)
def update_entry(entry_id: int, body: DailyRevenueUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DailyRevenueView:
    item = db.scalar(select(DailyRevenue).options(joinedload(DailyRevenue.branch)).where(DailyRevenue.id == entry_id))
    if not item:
        raise HTTPException(status_code=404, detail="Revenue entry not found")
    if not _can_access_branch(current_user, item.branch_id):
        raise HTTPException(status_code=403, detail="Branch access denied")
    if item.status != "draft" and current_user.role.lower() != "admin":
        raise HTTPException(status_code=409, detail="Only draft entries can be edited")
    item.amount = body.amount
    item.notes = body.notes.strip()
    item.report_image = body.report_image
    db.commit()
    db.refresh(item)
    return _view(item)


@router.post("/{entry_id}/submit", response_model=DailyRevenueView)
def submit_entry(entry_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> DailyRevenueView:
    item = db.scalar(select(DailyRevenue).options(joinedload(DailyRevenue.branch)).where(DailyRevenue.id == entry_id))
    if not item:
        raise HTTPException(status_code=404, detail="Revenue entry not found")
    if not _can_access_branch(current_user, item.branch_id):
        raise HTTPException(status_code=403, detail="Branch access denied")
    if item.status != "draft":
        raise HTTPException(status_code=409, detail="Entry has already been submitted")
    if item.amount <= 0:
        raise HTTPException(status_code=422, detail="Revenue amount must be greater than zero")
    item.status = "submitted"
    db.commit()
    db.refresh(item)
    return _view(item)
