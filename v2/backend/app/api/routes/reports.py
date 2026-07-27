from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select, tuple_
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.finance import Branch, DailyRevenue, MonthlyExpense
from app.models.user import User
from app.schemas.reports import FinancialReportView, ReportBranchOption, ReportBranchSummary, ReportDailyRow

router = APIRouter(prefix="/reports", tags=["reports"])


def _require(user: User, permission: str = "reports.view") -> None:
    if user.role.lower() != "admin" and permission not in user.permissions:
        raise HTTPException(status_code=403, detail="Reports permission required")


def _branch_ids(user: User, requested: list[int] | None, db: Session) -> list[int]:
    active = list(db.scalars(select(Branch.id).where(Branch.active.is_(True))))
    allowed = active if user.role.lower() == "admin" or not user.allowed_branch_ids else [item for item in active if item in user.allowed_branch_ids]
    if requested:
        if any(item not in allowed for item in requested):
            raise HTTPException(status_code=403, detail="Branch access denied")
        return list(dict.fromkeys(requested))
    return allowed


def _months(start: date, end: date):
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        yield year, month
        year, month = (year + 1, 1) if month == 12 else (year, month + 1)


def _allocated_month(daily_amount: Decimal, year: int, month: int, start: date, end: date) -> dict[date, Decimal]:
    days = monthrange(year, month)[1]
    first, last = date(year, month, 1), date(year, month, days)
    active_start, active_end = max(start, first), min(end, last)
    if active_start > active_end or daily_amount <= 0:
        return {}
    values: dict[date, Decimal] = {}
    cursor = active_start
    while cursor <= active_end:
        values[cursor] = daily_amount
        cursor += timedelta(days=1)
    return values


def _per_customer(revenue: Decimal, customers: int) -> Decimal:
    return (revenue / Decimal(customers)).quantize(Decimal("1")) if customers > 0 else Decimal(0)


def _report(start: date, end: date, ids: list[int], include_unapproved: bool, db: Session) -> FinancialReportView:
    if end < start:
        raise HTTPException(status_code=422, detail="End date must be after start date")
    if (end - start).days > 730:
        raise HTTPException(status_code=422, detail="Report range cannot exceed two years")

    branches = list(db.scalars(select(Branch).where(Branch.id.in_(ids)).order_by(Branch.name))) if ids else []
    revenue_query = select(DailyRevenue).where(DailyRevenue.branch_id.in_(ids), DailyRevenue.business_date.between(start, end))
    if not include_unapproved:
        revenue_query = revenue_query.where(DailyRevenue.status == "approved")
    revenues = list(db.scalars(revenue_query)) if ids else []
    revenue_map = {(item.branch_id, item.business_date): item for item in revenues}

    periods = list(_months(start, end))
    expense_rows = list(db.scalars(select(MonthlyExpense).where(MonthlyExpense.branch_id.in_(ids), tuple_(MonthlyExpense.year, MonthlyExpense.month).in_(periods)))) if ids else []
    expense_map = {(item.branch_id, item.year, item.month): Decimal(item.amount or 0) for item in expense_rows}

    daily_rows = []
    summaries = []
    company_revenue = Decimal(0)
    company_expenses = Decimal(0)
    company_customers = 0

    for branch in branches:
        allocation: dict[date, Decimal] = {}
        for year, month in periods:
            allocation.update(_allocated_month(expense_map.get((branch.id, year, month), Decimal(0)), year, month, start, end))

        branch_revenue = Decimal(0)
        branch_customers = 0
        approved = 0
        missing = 0
        cursor = start
        while cursor <= end:
            entry = revenue_map.get((branch.id, cursor))
            revenue = Decimal(entry.amount or 0) if entry else Decimal(0)
            customers = int(entry.customer_count or 0) if entry else 0
            expense = allocation.get(cursor, Decimal(0))
            status = entry.status if entry else "missing"
            branch_revenue += revenue
            branch_customers += customers
            approved += int(bool(entry and entry.status == "approved"))
            missing += int(entry is None)
            daily_rows.append(ReportDailyRow(
                business_date=cursor,
                branch_id=branch.id,
                branch_name=branch.name,
                revenue=revenue,
                customer_count=customers,
                revenue_per_customer=_per_customer(revenue, customers),
                allocated_expense=expense,
                net_profit=revenue - expense,
                entry_status=status,
            ))
            cursor += timedelta(days=1)

        branch_expenses = sum(allocation.values(), Decimal(0))
        summaries.append(ReportBranchSummary(
            branch_id=branch.id,
            branch_name=branch.name,
            revenue=branch_revenue,
            customer_count=branch_customers,
            revenue_per_customer=_per_customer(branch_revenue, branch_customers),
            expenses=branch_expenses,
            net_profit=branch_revenue - branch_expenses,
            approved_entries=approved,
            missing_days=missing,
        ))
        company_revenue += branch_revenue
        company_expenses += branch_expenses
        company_customers += branch_customers

    return FinancialReportView(
        date_from=start,
        date_to=end,
        generated_at=datetime.now(timezone.utc).isoformat(),
        company_revenue=company_revenue,
        company_customer_count=company_customers,
        company_revenue_per_customer=_per_customer(company_revenue, company_customers),
        company_expenses=company_expenses,
        company_net_profit=company_revenue - company_expenses,
        branches=summaries,
        daily_rows=daily_rows,
    )


@router.get("/branches", response_model=list[ReportBranchOption])
def branches(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user)
    ids = _branch_ids(current_user, None, db)
    rows = list(db.scalars(select(Branch).where(Branch.id.in_(ids)).order_by(Branch.name))) if ids else []
    return [ReportBranchOption(id=item.id, name=item.name) for item in rows]


@router.get("", response_model=FinancialReportView)
def view_report(date_from: date, date_to: date, branch_ids: list[int] | None = Query(default=None), include_unapproved: bool = False, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user)
    return _report(date_from, date_to, _branch_ids(current_user, branch_ids, db), include_unapproved, db)


def _name(report: FinancialReportView, extension: str) -> str:
    return f"financial_report_{report.date_from}_{report.date_to}.{extension}"


def _money(value: Decimal) -> str:
    return f"{value:,.0f} IQD"


@router.get("/export/excel")
def excel(date_from: date, date_to: date, branch_ids: list[int] | None = Query(default=None), include_unapproved: bool = False, show_revenue: bool = True, show_expenses: bool = True, show_profit: bool = True, show_branch_summary: bool = True, show_daily_details: bool = True, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "reports.export_excel")
    report = _report(date_from, date_to, _branch_ids(current_user, branch_ids, db), include_unapproved, db)
    workbook = Workbook()
    summary = workbook.active
    summary.title = "Summary"
    dark = "073C46"
    red = "D62828"
    summary.append(["Royal Thai Touch ERP - Financial Report"])
    summary.merge_cells("A1:H1")
    summary["A1"].font = Font(size=18, bold=True, color="FFFFFF")
    summary["A1"].fill = PatternFill("solid", fgColor=dark)
    summary["A1"].alignment = Alignment(horizontal="center")
    summary.append(["Period", str(report.date_from), "to", str(report.date_to)])
    summary.append(["Company Revenue", float(report.company_revenue), "Customers", report.company_customer_count, "Revenue / Customer", float(report.company_revenue_per_customer), "Fixed Daily Expenses", float(report.company_expenses), "Net Profit", float(report.company_net_profit)])
    summary.append([])
    if show_branch_summary:
        summary.append(["Branch", "Revenue", "Customers", "Revenue / Customer", "Fixed Daily Expenses (Period Total)", "Net Profit", "Approved Days", "Missing Days"])
        for cell in summary[summary.max_row]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor=dark)
        for item in report.branches:
            summary.append([item.branch_name, float(item.revenue), item.customer_count, float(item.revenue_per_customer), float(item.expenses), float(item.net_profit), item.approved_entries, item.missing_days])
            if item.net_profit < 0:
                cell = summary.cell(summary.max_row, 6)
                cell.fill = PatternFill("solid", fgColor=red)
                cell.font = Font(bold=True, color="FFFFFF")
    if show_daily_details:
        details = workbook.create_sheet("Daily Details")
        details.append(["Date", "Branch", "Revenue", "Customers", "Revenue / Customer", "Fixed Daily Expense", "Net Profit", "Status"])
        for cell in details[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor=dark)
        for item in report.daily_rows:
            details.append([item.business_date, item.branch_name, float(item.revenue), item.customer_count, float(item.revenue_per_customer), float(item.allocated_expense), float(item.net_profit), item.entry_status])
            if item.net_profit < 0:
                cell = details.cell(details.max_row, 7)
                cell.fill = PatternFill("solid", fgColor=red)
                cell.font = Font(bold=True, color="FFFFFF")
        details.freeze_panes = "A2"
        details.auto_filter.ref = details.dimensions
    for sheet in workbook.worksheets:
        for column in sheet.columns:
            sheet.column_dimensions[get_column_letter(column[0].column)].width = min(max(len(str(cell.value or "")) for cell in column) + 3, 38)
        for row in sheet.iter_rows():
            for cell in row:
                if isinstance(cell.value, (int, float)) and cell.column in {2, 4, 5, 6, 7}:
                    cell.number_format = '#,##0'
    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="{_name(report, "xlsx")}"'})


@router.get("/export/pdf")
def pdf(date_from: date, date_to: date, branch_ids: list[int] | None = Query(default=None), include_unapproved: bool = False, show_revenue: bool = True, show_expenses: bool = True, show_profit: bool = True, show_branch_summary: bool = True, show_daily_details: bool = True, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "reports.export_pdf")
    report = _report(date_from, date_to, _branch_ids(current_user, branch_ids, db), include_unapproved, db)
    output = BytesIO()
    document = SimpleDocTemplate(output, pagesize=landscape(A4), rightMargin=10 * mm, leftMargin=10 * mm, topMargin=10 * mm, bottomMargin=10 * mm)
    styles = getSampleStyleSheet()
    dark = colors.HexColor("#073C46")
    negative_red = colors.HexColor("#D62828")
    story = [Paragraph("Royal Thai Touch ERP - Financial Report", styles["Title"]), Paragraph(f"Period: {report.date_from} to {report.date_to}", styles["Normal"]), Spacer(1, 6 * mm)]

    totals = [["Revenue", "Customers", "Revenue / Customer", "Fixed Daily Expenses", "Net Profit"], [_money(report.company_revenue), f"{report.company_customer_count:,}", _money(report.company_revenue_per_customer), _money(report.company_expenses), _money(report.company_net_profit)]]
    totals_table = Table(totals, repeatRows=1)
    totals_commands = [("BACKGROUND", (0, 0), (-1, 0), dark), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("GRID", (0, 0), (-1, -1), 0.5, colors.grey), ("ALIGN", (1, 0), (-1, -1), "RIGHT")]
    if report.company_net_profit < 0:
        totals_commands.extend([("BACKGROUND", (4, 1), (4, 1), negative_red), ("TEXTCOLOR", (4, 1), (4, 1), colors.white), ("FONTNAME", (4, 1), (4, 1), "Helvetica-Bold")])
    totals_table.setStyle(TableStyle(totals_commands))
    story.extend([totals_table, Spacer(1, 6 * mm)])

    if show_branch_summary:
        rows = [["Branch", "Revenue", "Customers", "Revenue / Customer", "Period Expenses", "Net Profit", "Approved", "Missing"]]
        rows.extend([[item.branch_name, _money(item.revenue), f"{item.customer_count:,}", _money(item.revenue_per_customer), _money(item.expenses), _money(item.net_profit), item.approved_entries, item.missing_days] for item in report.branches])
        table = Table(rows, repeatRows=1)
        commands = [("BACKGROUND", (0, 0), (-1, 0), dark), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("GRID", (0, 0), (-1, -1), 0.35, colors.grey), ("FONTSIZE", (0, 0), (-1, -1), 8), ("ALIGN", (1, 1), (-1, -1), "RIGHT")]
        for row_index, item in enumerate(report.branches, start=1):
            if item.net_profit < 0:
                commands.extend([("BACKGROUND", (5, row_index), (5, row_index), negative_red), ("TEXTCOLOR", (5, row_index), (5, row_index), colors.white), ("FONTNAME", (5, row_index), (5, row_index), "Helvetica-Bold")])
        table.setStyle(TableStyle(commands))
        story.extend([Paragraph("Branch Summary", styles["Heading2"]), table, Spacer(1, 6 * mm)])

    if show_daily_details:
        rows = [["Date", "Branch", "Revenue", "Customers", "Revenue / Customer", "Fixed Daily Expense", "Net Profit", "Status"]]
        rows.extend([[str(item.business_date), item.branch_name, _money(item.revenue), f"{item.customer_count:,}", _money(item.revenue_per_customer), _money(item.allocated_expense), _money(item.net_profit), item.entry_status] for item in report.daily_rows])
        table = Table(rows, repeatRows=1)
        commands = [("BACKGROUND", (0, 0), (-1, 0), dark), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("GRID", (0, 0), (-1, -1), 0.25, colors.grey), ("FONTSIZE", (0, 0), (-1, -1), 7), ("ALIGN", (2, 1), (-2, -1), "RIGHT")]
        for row_index, item in enumerate(report.daily_rows, start=1):
            if item.net_profit < 0:
                commands.extend([("BACKGROUND", (6, row_index), (6, row_index), negative_red), ("TEXTCOLOR", (6, row_index), (6, row_index), colors.white), ("FONTNAME", (6, row_index), (6, row_index), "Helvetica-Bold")])
        table.setStyle(TableStyle(commands))
        story.extend([Paragraph("Daily Details", styles["Heading2"]), table])

    document.build(story)
    output.seek(0)
    return StreamingResponse(output, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{_name(report, "pdf")}"'})
