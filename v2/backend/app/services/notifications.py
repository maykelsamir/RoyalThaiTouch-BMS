from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.notification import Notification
from app.models.user import User


def ensure_notifications_table(db: Session) -> None:
    Notification.__table__.create(bind=db.get_bind(), checkfirst=True)


def notify_user(db: Session, user_id: int | None, title: str, message: str, *, kind: str = "info", module: str = "system", entity_id: str = "") -> None:
    if not user_id:
        return
    ensure_notifications_table(db)
    db.add(Notification(user_id=user_id, title=title, message=message, kind=kind, module=module, entity_id=entity_id))


def notify_admins(db: Session, title: str, message: str, *, kind: str = "info", module: str = "system", entity_id: str = "", exclude_user_id: int | None = None) -> None:
    ensure_notifications_table(db)
    admins = list(db.scalars(select(User).where(func.lower(User.role) == "admin", User.active.is_(True))))
    for admin in admins:
        if exclude_user_id and admin.id == exclude_user_id:
            continue
        db.add(Notification(user_id=admin.id, title=title, message=message, kind=kind, module=module, entity_id=entity_id))
