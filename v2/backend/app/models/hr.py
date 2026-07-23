from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Employee(Base):
    __tablename__ = "employees_v2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    employee_code: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(180), index=True, nullable=False)
    gender: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    nationality: Mapped[str] = mapped_column(String(80), default="", nullable=False)
    phone: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    email: Mapped[str] = mapped_column(String(180), default="", nullable=False)
    address: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    branch_id: Mapped[int | None] = mapped_column(ForeignKey("branches_v2.id", ondelete="SET NULL"), index=True, nullable=True)
    department: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    job_title: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    manager_name: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    hire_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    contract_type: Mapped[str] = mapped_column(String(60), default="Full Time", nullable=False)
    salary: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    salary_currency: Mapped[str] = mapped_column(String(3), default="IQD", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="Active", index=True, nullable=False)
    photo: Mapped[str] = mapped_column(Text, default="", nullable=False)
    id_card_front: Mapped[str] = mapped_column(Text, default="", nullable=False)
    id_card_back: Mapped[str] = mapped_column(Text, default="", nullable=False)
    passport_photo: Mapped[str] = mapped_column(Text, default="", nullable=False)
    notes: Mapped[str] = mapped_column(String(2000), default="", nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)