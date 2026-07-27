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
    company_percentage: Decimal
    hotel_percentage: Decimal
    company_share: Decimal
    hotel_share: Decimal
    customer_count: int
    revenue_per_customer: Decimal
    allocated_expense: Decimal
    net_profit: Decimal
    entry_status: str


class ReportBranchSummary(BaseModel):
    branch_id: int
    branch_name: str
    revenue: Decimal
    company_percentage: Decimal
    hotel_percentage: Decimal
    company_share: Decimal
    hotel_share: Decimal
    customer_count: int
    revenue_per_customer: Decimal
    expenses: Decimal
    net_profit: Decimal
    approved_entries: int
    missing_days: int


class FinancialReportView(BaseModel):
    date_from: date
    date_to: date
    generated_at: str
    company_revenue: Decimal
    company_share: Decimal
    hotel_share: Decimal
    company_customer_count: int
    company_revenue_per_customer: Decimal
    company_expenses: Decimal
    company_net_profit: Decimal
    branches: list[ReportBranchSummary]
    daily_rows: list[ReportDailyRow]
