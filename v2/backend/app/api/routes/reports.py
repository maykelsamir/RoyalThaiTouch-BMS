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


def _allocated_month(amount: Decimal, year: int, month: int, start: date, end: date) -> dict[date, Decimal]:
    days = monthrange(year, month)[1]
    first, last = date(year, month, 1), date(year, month, days)
    active_start, active_end = max(start, first), min(end, last)
    if active_start > active_end or amount <= 0:
        return {}
    included = (active_end - active_start).days + 1
    target = (amount * Decimal(included) / Decimal(days)).quantize(Decimal("1"))
    daily = (amount / Decimal(days)).quantize(Decimal("1"))
    values: dict[date, Decimal] = {}
    cursor = active_start
    while cursor <= active_end:
        values[cursor] = daily
        cursor += timedelta(days=1)
    values[active_end] += target - sum(values.values(), Decimal(0))
    return values


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

    daily_rows: list[ReportDailyRow] = []
    summaries: list[ReportBranchSummary] = []
    company_revenue = Decimal(0)
    company_expenses = Decimal(0)
    for branch in branches:
        allocation: dict[date, Decimal] = {}
        for year, month in periods:
            allocation.update(_allocated_month(expense_map.get((branch.id, year, month), Decimal(0)), year, month, start, end))
        branch_revenue = Decimal(0)
        approved = 0
        missing = 0
        cursor = start
        while cursor <= end:
            entry = revenue_map.get((branch.id, cursor))
            revenue = Decimal(entry.amount or 0) if entry else Decimal(0)
            expense = allocation.get(cursor, Decimal(0))
            status = entry.status if entry else "missing"
            branch_revenue += revenue
            approved += int(bool(entry and entry.status == "approved"))
            missing += int(entry is None)
            daily_rows.append(ReportDailyRow(business_date=cursor, branch_id=branch.id, branch_name=branch.name, revenue=revenue, allocated_expense=expense, net_profit=revenue - expense, entry_status=status))
            cursor += timedelta(days=1)
        branch_expenses = sum(allocation.values(), Decimal(0))
        summaries.append(ReportBranchSummary(branch_id=branch.id, branch_name=branch.name, revenue=branch_revenue, expenses=branch_expenses, net_profit=branch_revenue - branch_expenses, approved_entries=approved, missing_days=missing))
        company_revenue += branch_revenue
        company_expenses += branch_expenses
    return FinancialReportView(date_from=start, date_to=end, generated_at=datetime.now(timezone.utc).isoformat(), company_revenue=company_revenue, company_expenses=company_expenses, company_net_profit=company_revenue - company_expenses, branches=summaries, daily_rows=daily_rows)


def _validate_selection(show_revenue: bool, show_expenses: bool, show_profit: bool) -> None:
    if not any((show_revenue, show_expenses, show_profit)):
        raise HTTPException(status_code=422, detail="Select at least one financial value")


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


@router.get("/export/excel")
def excel(
    date_from: date,
    date_to: date,
    branch_ids: list[int] | None = Query(default=None),
    include_unapproved: bool = False,
    show_revenue: bool = True,
    show_expenses: bool = True,
    show_profit: bool = True,
    show_branch_summary: bool = True,
    show_daily_details: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require(current_user, "reports.export_excel")
    _validate_selection(show_revenue, show_expenses, show_profit)
    report = _report(date_from, date_to, _branch_ids(current_user, branch_ids, db), include_unapproved, db)
    workbook = Workbook()
    summary = workbook.active
    summary.title = "Summary"
    dark = "073C46"
    summary.append(["Royal Thai Touch ERP - Financial Report"])
    summary.merge_cells("A1:F1")
    summary["A1"].font = Font(size=18, bold=True, color="FFFFFF")
    summary["A1"].fill = PatternFill("solid", fgColor=dark)
    summary["A1"].alignment = Alignment(horizontal="center")
    summary.append(["Period", str(report.date_from), "to", str(report.date_to)])

    totals = []
    if show_revenue:
        totals.extend(["Company Revenue", float(report.company_revenue)])
    if show_expenses:
        totals.extend(["Company Expenses", float(report.company_expenses)])
    if show_profit:
        totals.extend(["Net Profit", float(report.company_net_profit)])
    summary.append(totals)
    summary.append([])

    if show_branch_summary:
        headers = ["Branch"]
        if show_revenue:
            headers.append("Revenue")
        if show_expenses:
            headers.append("Allocated Expenses")
        if show_profit:
            headers.append("Net Profit")
        headers.extend(["Approved Days", "Missing Days"])
        summary.append(headers)
        header_row = summary.max_row
        for cell in summary[header_row]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor=dark)
        for item in report.branches:
            row = [item.branch_name]
            if show_revenue:
                row.append(float(item.revenue))
            if show_expenses:
                row.append(float(item.expenses))
            if show_profit:
                row.append(float(item.net_profit))
            row.extend([item.approved_entries, item.missing_days])
            summary.append(row)

    if show_daily_details:
        details = workbook.create_sheet("Daily Details")
        headers = ["Date", "Branch"]
        if show_revenue:
            headers.append("Revenue")
        if show_expenses:
            headers.append("Allocated Expense")
        if show_profit:
            headers.append("Net Profit")
        headers.append("Status")
        details.append(headers)
        for cell in details[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor=dark)
        for item in report.daily_rows:
            row = [item.business_date, item.branch_name]
            if show_revenue:
                row.append(float(item.revenue))
            if show_expenses:
                row.append(float(item.allocated_expense))
            if show_profit:
                row.append(float(item.net_profit))
            row.append(item.entry_status)
            details.append(row)
        details.freeze_panes = "A2"
        details.auto_filter.ref = details.dimensions

    for sheet in workbook.worksheets:
        for column in sheet.columns:
            sheet.column_dimensions[get_column_letter(column[0].column)].width = min(max(len(str(cell.value or "")) for cell in column) + 3, 38)
        for row in sheet.iter_rows():
            for cell in row:
                if isinstance(cell.value, (int, float)) and cell.column > 1:
                    cell.number_format = '#,##0 "IQD"'
    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="{_name(report, "xlsx")}"'})


@router.get("/export/pdf")
def pdf(
    date_from: date,
    date_to: date,
    branch_ids: list[int] | None = Query(default=None),
    include_unapproved: bool = False,
    show_revenue: bool = True,
    show_expenses: bool = True,
    show_profit: bool = True,
    show_branch_summary: bool = True,
    show_daily_details: bool = True,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require(current_user, "reports.export_pdf")
    _validate_selection(show_revenue, show_expenses, show_profit)
    report = _report(date_from, date_to, _branch_ids(current_user, branch_ids, db), include_unapproved, db)
    output = BytesIO()
    document = SimpleDocTemplate(output, pagesize=landscape(A4), rightMargin=12 * mm, leftMargin=12 * mm, topMargin=10 * mm, bottomMargin=10 * mm)
    styles = getSampleStyleSheet()
    story = [Paragraph("Royal Thai Touch ERP - Advanced Financial Report", styles["Title"]), Paragraph(f"Period: {report.date_from} to {report.date_to}", styles["Normal"]), Spacer(1, 8)]

    total_headers = []
    total_values = []
    if show_revenue:
        total_headers.append("Company Revenue"); total_values.append(f"{report.company_revenue:,.0f} IQD")
    if show_expenses:
        total_headers.append("Company Expenses"); total_values.append(f"{report.company_expenses:,.0f} IQD")
    if show_profit:
        total_headers.append("Net Profit"); total_values.append(f"{report.company_net_profit:,.0f} IQD")
    width = 240 * mm / max(len(total_headers), 1)
    totals = Table([total_headers, total_values], colWidths=[width] * len(total_headers))
    totals.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#073C46")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("GRID", (0, 0), (-1, -1), .5, colors.grey), ("PADDING", (0, 0), (-1, -1), 7)]))
    story.extend([totals, Spacer(1, 10)])

    if show_branch_summary:
        story.append(Paragraph("Branch Summary", styles["Heading2"]))
        headers = ["Branch"]
        if show_revenue:
            headers.append("Revenue")
        if show_expenses:
            headers.append("Expenses")
        if show_profit:
            headers.append("Net Profit")
        headers.extend(["Approved", "Missing"])
        rows = [headers]
        for item in report.branches:
            row = [item.branch_name]
            if show_revenue:
                row.append(f"{item.revenue:,.0f}")
            if show_expenses:
                row.append(f"{item.expenses:,.0f}")
            if show_profit:
                row.append(f"{item.net_profit:,.0f}")
            row.extend([item.approved_entries, item.missing_days])
            rows.append(row)
        summary = Table(rows, repeatRows=1)
        summary.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#073C46")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("GRID", (0, 0), (-1, -1), .4, colors.grey), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#EEF5F6")]), ("ALIGN", (1, 1), (-1, -1), "RIGHT"), ("FONTSIZE", (0, 0), (-1, -1), 8)]))
        story.extend([summary, Spacer(1, 10)])

    if show_daily_details:
        story.append(Paragraph("Daily Details", styles["Heading2"]))
        headers = ["Date", "Branch"]
        if show_revenue:
            headers.append("Revenue")
        if show_expenses:
            headers.append("Expense")
        if show_profit:
            headers.append("Net Profit")
        headers.append("Status")
        rows = [headers]
        for item in report.daily_rows:
            row = [str(item.business_date), item.branch_name]
            if show_revenue:
                row.append(f"{item.revenue:,.0f}")
            if show_expenses:
                row.append(f"{item.allocated_expense:,.0f}")
            if show_profit:
                row.append(f"{item.net_profit:,.0f}")
            row.append(item.entry_status.title())
            rows.append(row)
        details = Table(rows, repeatRows=1)
        details.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#073C46")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("GRID", (0, 0), (-1, -1), .3, colors.grey), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#EEF5F6")]), ("ALIGN", (2, 1), (-1, -1), "RIGHT"), ("FONTSIZE", (0, 0), (-1, -1), 7)]))
        story.append(details)

    document.build(story)
    output.seek(0)
    return StreamingResponse(output, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{_name(report, "pdf")}"'})
