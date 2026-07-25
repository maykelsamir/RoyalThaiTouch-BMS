from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _serialize(item: Notification) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "message": item.message,
        "kind": item.kind,
        "module": item.module,
        "entity_id": item.entity_id,
        "is_read": item.is_read,
        "created_at": item.created_at,
    }


@router.get("")
def list_notifications(
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = list(db.scalars(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(limit)
    ))
    unread = db.scalar(select(func.count()).select_from(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read.is_(False),
    )) or 0
    return {"items": [_serialize(item) for item in items], "unread": unread}


@router.post("/{notification_id}/read")
def mark_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    item = db.get(Notification, notification_id)
    if not item or item.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Notification not found")
    item.is_read = True
    db.commit()
    return {"status": "read"}


@router.post("/read-all")
def mark_all_read(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(update(Notification).where(
        Notification.user_id == current_user.id,
        Notification.is_read.is_(False),
    ).values(is_read=True))
    db.commit()
    return {"status": "all_read"}
