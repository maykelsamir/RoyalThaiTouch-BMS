from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs_v2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users_v2.id", ondelete="SET NULL"), index=True, nullable=True)
    username: Mapped[str] = mapped_column(String(120), default="System", nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    branch_id: Mapped[int | None] = mapped_column(ForeignKey("branches_v2.id", ondelete="SET NULL"), index=True, nullable=True)
    action: Mapped[str] = mapped_column(String(120), index=True, nullable=False)
    module: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    entity_type: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    entity_id: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    result: Mapped[str] = mapped_column(String(20), default="success", index=True, nullable=False)
    description: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    before_data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    after_data: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    request_method: Mapped[str] = mapped_column(String(12), default="", nullable=False)
    request_path: Mapped[str] = mapped_column(String(300), default="", nullable=False)
    ip_address: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    user_agent: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True, nullable=False)
