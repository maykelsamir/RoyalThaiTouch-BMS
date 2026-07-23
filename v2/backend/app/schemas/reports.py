from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class ReportBranchOption(BaseModel):
    id: int
    name: str


class ReportDailyRow(BaseModel):
    business_date: date
    branch_id: int
    branch_name: str
    revenue: Decimal
    allocated_expense: Decimal
    net_profit: Decimal
    entry_status: str


class ReportBranchSummary(BaseModel):
    branch_id: int
    branch_name: str
    revenue: Decimal
    expenses: Decimal
    net_profit: Decimal
    approved_entries: int
    missing_days: int


class FinancialReportView(BaseModel):
    date_from: date
    date_to: date
    generated_at: str
    company_revenue: Decimal
    company_expenses: Decimal
    company_net_profit: Decimal
    branches: list[ReportBranchSummary]
    daily_rows: list[ReportDailyRow]
