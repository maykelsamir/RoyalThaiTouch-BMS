import csv
from datetime import date, datetime, time, timezone
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.audit import AuditLogView, AuditPage, AuditSummary

router = APIRouter(prefix="/audit", tags=["audit"])


def require_audit(user: User) -> None:
    if user.role.lower() != "admin" and "audit.view" not in user.permissions:
        raise HTTPException(status_code=403, detail="Audit permission required")


def build_query(*, search: str | None, username: str | None, module: str | None, action: str | None, result: str | None, date_from: date | None, date_to: date | None):
    query = select(AuditLog)
    conditions = []
    if search:
        token = f"%{search.strip()}%"
        conditions.append(or_(AuditLog.username.ilike(token), AuditLog.description.ilike(token), AuditLog.action.ilike(token), AuditLog.ip_address.ilike(token), AuditLog.entity_id.ilike(token)))
    if username:
        conditions.append(AuditLog.username == username)
    if module:
        conditions.append(AuditLog.module == module)
    if action:
        conditions.append(AuditLog.action == action)
    if result:
        conditions.append(AuditLog.result == result)
    if date_from:
        conditions.append(AuditLog.created_at >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to:
        conditions.append(AuditLog.created_at <= datetime.combine(date_to, time.max, tzinfo=timezone.utc))
    return query.where(*conditions) if conditions else query


@router.get("", response_model=AuditPage)
def list_logs(
    search: str | None = None,
    username: str | None = None,
    module: str | None = None,
    action: str | None = None,
    result: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=10, le=200),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_audit(current_user)
    base = build_query(search=search, username=username, module=module, action=action, result=result, date_from=date_from, date_to=date_to)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = list(db.scalars(base.order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)))
    today_start = datetime.combine(date.today(), time.min, tzinfo=timezone.utc)
    summary = AuditSummary(
        total_today=db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.created_at >= today_start)) or 0,
        login_events=db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action.in_(["login", "logout", "login_failed"]), AuditLog.created_at >= today_start)) or 0,
        changes=db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.request_method.in_(["POST", "PUT", "PATCH", "DELETE"]), AuditLog.created_at >= today_start)) or 0,
        approvals=db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.action.in_(["approve", "reject"]), AuditLog.created_at >= today_start)) or 0,
        failed=db.scalar(select(func.count()).select_from(AuditLog).where(AuditLog.result == "failed", AuditLog.created_at >= today_start)) or 0,
    )
    return AuditPage(items=[AuditLogView.model_validate(item) for item in rows], total=total, page=page, page_size=page_size, summary=summary)


@router.get("/options")
def options(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_audit(current_user)
    return {
        "users": list(db.scalars(select(AuditLog.username).distinct().order_by(AuditLog.username))),
        "modules": list(db.scalars(select(AuditLog.module).distinct().order_by(AuditLog.module))),
        "actions": list(db.scalars(select(AuditLog.action).distinct().order_by(AuditLog.action))),
    }


@router.get("/export/csv")
def export_csv(
    search: str | None = None,
    username: str | None = None,
    module: str | None = None,
    action: str | None = None,
    result: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_audit(current_user)
    rows = list(db.scalars(build_query(search=search, username=username, module=module, action=action, result=result, date_from=date_from, date_to=date_to).order_by(AuditLog.created_at.desc())))
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "User", "Role", "Module", "Action", "Result", "Description", "IP", "Method", "Path"])
    for item in rows:
        writer.writerow([item.created_at.isoformat(), item.username, item.role, item.module, item.action, item.result, item.description, item.ip_address, item.request_method, item.request_path])
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="audit_log.csv"'})
