from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Branch(Base):
    __tablename__ = "branches_v2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(160), unique=True, index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(40), unique=True, index=True, default="", nullable=False)
    country: Mapped[str] = mapped_column(String(100), default="Iraq", nullable=False)
    city: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    address: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    phone: Mapped[str] = mapped_column(String(60), default="", nullable=False)
    email: Mapped[str] = mapped_column(String(180), default="", nullable=False)
    whatsapp: Mapped[str] = mapped_column(String(300), default="", nullable=False)
    website: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    facebook: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    instagram: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    tiktok: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    youtube: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    telegram: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    snapchat: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    google_maps: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    manager_name: Mapped[str] = mapped_column(String(160), default="", nullable=False)
    opening_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    logo: Mapped[str] = mapped_column(Text, default="", nullable=False)
    cover_image: Mapped[str] = mapped_column(Text, default="", nullable=False)
    notes: Mapped[str] = mapped_column(String(2000), default="", nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class DailyRevenue(Base):
    __tablename__ = "daily_revenues_v2"
    __table_args__ = (UniqueConstraint("branch_id", "business_date", name="uq_v2_revenue_branch_date"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches_v2.id", ondelete="CASCADE"), index=True, nullable=False)
    business_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 0), default=0, nullable=False)
    customer_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    report_image: Mapped[str] = mapped_column(Text, default="", nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="draft", nullable=False, index=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users_v2.id", ondelete="SET NULL"), nullable=True)
    approved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users_v2.id", ondelete="SET NULL"), nullable=True)
    approved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejected_by: Mapped[int | None] = mapped_column(ForeignKey("users_v2.id", ondelete="SET NULL"), nullable=True)
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    branch: Mapped[Branch] = relationship()


class MonthlyExpense(Base):
    __tablename__ = "monthly_expenses_v2"
    __table_args__ = (UniqueConstraint("branch_id", "year", "month", name="uq_v2_monthly_expense_branch_period"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches_v2.id", ondelete="CASCADE"), index=True, nullable=False)
    year: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    month: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 0), default=0, nullable=False)
    notes: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users_v2.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    branch: Mapped[Branch] = relationship()


class Expense(Base):
    __tablename__ = "expenses_v2"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches_v2.id", ondelete="CASCADE"), index=True, nullable=False)
    business_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(160), default="Other Expenses", nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(18, 0), default=0, nullable=False)
    notes: Mapped[str] = mapped_column(String(1000), default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    branch: Mapped[Branch] = relationship()
