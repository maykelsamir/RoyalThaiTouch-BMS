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
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.finance import Branch, DailyRevenue, MonthlyExpense
from app.models.user import User
from app.schemas.reports import FinancialReportView, ReportBranchOption, ReportBranchSummary, ReportDailyRow

router = APIRouter(prefix="/reports", tags=["reports"])


def _require_view(user: User) -> None:
    if user.role.lower() != "admin" and "reports.view" not in user.permissions:
        raise HTTPException(status_code=403, detail="Reports permission required")


def _require_export(user: User, permission: str) -> None:
    _require_view(user)
    if user.role.lower() != "admin" and permission not in user.permissions:
        raise HTTPException(status_code=403, detail="Export permission required")


def _allowed_branch_ids(user: User, requested: list[int] | None, db: Session) -> list[int]:
    active_ids = list(db.scalars(select(Branch.id).where(Branch.active.is_(True)).order_by(Branch.name)))
    allowed = active_ids if user.role.lower() == "admin" or not user.allowed_branch_ids else [item for item in active_ids if item in user.allowed_branch_ids]
    if requested:
        invalid = [item for item in requested if item not in allowed]
        if invalid:
            raise HTTPException(status_code=403, detail="Branch access denied")
        return requested
    return allowed


def _period_months(start: date, end: date):
    year, month = start.year, start.month
    while (year, month) <= (end.year, end.month):
        yield year, month
        if month == 12:
            year, month = year + 1, 1
        else:
            month += 1


def _expense_allocation(expense: Decimal, year: int, month: int, start: date, end: date) -> dict[date, Decimal]:
    days = monthrange(year, month)[1]
    month_start = date(year, month, 1)
    month_end = date(year, month, days)
    active_start = max(start, month_start)
    active_end = min(end, month_end)
    if active_start > active_end or expense <= 0:
        return {}
    included = (active_end - active_start).days + 1
    daily = expense / Decimal(days)
    result: dict[date, Decimal] = {}
    cursor = active_start
    allocated = Decimal(0)
    while cursor <= active_end:
        value = daily.quantize(Decimal("1"))
        result[cursor] = value
        allocated += value
        cursor += timedelta(days=1)
    target = (expense * Decimal(included) / Decimal(days)).quantize(Decimal("1"))
    if result:
        result[active_end] += target - allocated
    return result


def _build_report(start: date, end: date, branch_ids: list[int], include_unapproved: bool, db: Session) -> FinancialReportView:
    if end < start:
        raise HTTPException(status_code=422, detail="End date must be after start date")
    if (end - start).days > 730:
        raise HTTPException(status_code=422, detail="Report range cannot exceed two years")

    branches = list(db.scalars(select(Branch).where(Branch.id.in_(branch_ids)).order_by(Branch.name))) if branch_ids else []
    revenues_query = select(DailyRevenue).where(
        DailyRevenue.branch_id.in_(branch_ids),
        DailyRevenue.business_date >= start,
        DailyRevenue.business_date <= end,
    )
    if not include_unapproved:
        revenues_query = revenues_query.where(DailyRevenue.status == "approved")
    revenues = list(db.scalars(revenues_query)) if branch_ids else []
    revenue_map = {(item.branch_id, item.business_date): item for item in revenues}

    expenses = list(db.scalars(select(MonthlyExpense).where(
        MonthlyExpense.branch_id.in_(branch_ids),
        tuple_(MonthlyExpense.year, MonthlyExpense.month).in_(list(_period_months(start, end))),
    ))) if branch_ids else []
    expense_map = {(item.branch_id, item.year, item.month): Decimal(item.amount or 0) for item in expenses}

    daily_rows: list[ReportDailyRow] = []
    summaries: list[ReportBranchSummary] = []
    company_revenue = Decimal(0)
    company_expenses = Decimal(0)

    for branch in branches:
        allocated_by_date: dict[date, Decimal] = {}
        for year, month in _period_months(start, end):
            amount = expense_map.get((branch.id, year, month), Decimal(0))
            for day, value in _expense_allocation(amount, year, month, start, end).items():
                allocated_by_date[day] = value

        branch_revenue = Decimal(0)
        branch_expenses = sum(allocated_by_date.values(), Decimal(0))
        approved_entries = 0
        missing_days = 0
        cursor = start
        while cursor <= end:
            entry = revenue_map.get((branch.id, cursor))
            revenue = Decimal(entry.amount or 0) if entry else Decimal(0)
            status = entry.status if entry else "missing"
            if entry and entry.status == "approved":
                approved_entries += 1
            if not entry:
                missing_days += 1
            expense = allocated_by_date.get(cursor, Decimal(0))
            branch_revenue += revenue
            daily_rows.append(ReportDailyRow(
                business_date=cursor,
                branch_id=branch.id,
                branch_name=branch.name,
                revenue=revenue,
                allocated_expense=expense,
                net_profit=revenue - expense,
                entry_status=status,
            ))
            cursor += timedelta(days=1)

        summaries.append(ReportBranchSummary(
            branch_id=branch.id,
            branch_name=branch.name,
            revenue=branch_revenue,
            expenses=branch_expenses,
            net_profit=branch_revenue - branch_expenses,
            approved_entries=approved_entries,
            missing_days=missing_days,
        ))
        company_revenue += branch_revenue
        company_expenses += branch_expenses

    return FinancialReportView(
        date_from=start,
        date_to=end,
        generated_at=datetime.now(timezone.utc).isoformat(),
        company_revenue=company_revenue,
        company_expenses=company_expenses,
        company_net_profit=company_revenue - company_expenses,
        branches=summaries,
        daily_rows=daily_rows,
    )


@router.get("/branches", response_model=list[ReportBranchOption])
def report_branches(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_view(current_user)
    ids = _allowed_branch_ids(current_user, None, db)
    items = list(db.scalars(select(Branch).where(Branch.id.in_(ids)).order_by(Branch.name))) if ids else []
    return [ReportBranchOption(id=item.id, name=item.name) for item in items]


@router.get("", response_model=FinancialReportView)
def financial_report(
    date_from: date,
    date_to: date,
    branch_ids: list[int] | None = Query(default=None),
    include_unapproved: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_view(current_user)
    ids = _allowed_branch_ids(current_user, branch_ids, db)
    return _build_report(date_from, date_to, ids, include_unapproved, db)


def _filename(prefix: str, report: FinancialReportView, extension: str) -> str:
    return f"{prefix}_{report.date_from}_{report.date_to}.{extension}"


@router.get("/export/excel")
def export_excel(
    date_from: date,
    date_to: date,
    branch_ids: list[int] | None = Query(default=None),
    include_unapproved: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_export(current_user, "reports.export_excel")
    report = _build_report(date_from, date_to, _allowed_branch_ids(current_user, branch_ids, db), include_unapproved, db)
    workbook = Workbook()
    summary = workbook.active
    summary.title = "Summary"
    gold = "D4AF37"
    dark = "073C46"
    summary.append(["Royal Thai Touch ERP - Financial Report"])
    summary.merge_cells("A1:G1")
    summary["A1"].font = Font(size=18, bold=True, color="FFFFFF")
    summary["A1"].fill = PatternFill("solid", fgColor=dark)
    summary["A1"].alignment = Alignment(horizontal="center")
    summary.append(["Period", str(report.date_from), "to", str(report.date_to)])
    summary.append([])
    summary.append(["Company Revenue", float(report.company_revenue), "Company Expenses", float(report.company_expenses), "Net Profit", float(report.company_net_profit)])
    summary.append([])
    summary.append(["Branch", "Revenue", "Allocated Expenses", "Net Profit", "Approved Entries", "Missing Days"])
    for cell in summary[6]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=dark)
    for item in report.branches:
        summary.append([item.branch_name, float(item.revenue), float(item.expenses), float(item.net_profit), item.approved_entries, item.missing_days])
    for column in range(2, 5):
        for row in range(4, summary.max_row + 1):
            summary.cell(row, column).number_format = '#,##0 "IQD"'

    details = workbook.create_sheet("Daily Details")
    details.append(["Date", "Branch", "Revenue", "Allocated Expense", "Net Profit", "Status"])
    for cell in details[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor=dark)
    for row in report.daily_rows:
        details.append([row.business_date, row.branch_name, float(row.revenue), float(row.allocated_expense), float(row.net_profit), row.entry_status])
    for column in range(3, 6):
        for row in range(2, details.max_row + 1):
            details.cell(row, column).number_format = '#,##0 "IQD"'
    details.freeze_panes = "A2"
    details.auto_filter.ref = details.dimensions
    for sheet in workbook.worksheets:
        for column_cells in sheet.columns:
            width = min(max(len(str(cell.value or "")) for cell in column_cells) + 3, 38)
            sheet.column_dimensions[get_column_letter(column_cells[0].column)].width = width
    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="{_filename("financial_report", report, "xlsx")}"'})


@router.get("/export/pdf")
def export_pdf(
    date_from: date,
    date_to: date,
    branch_ids: list[int] | None = Query(default=None),
    include_unapproved: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_export(current_user, "reports.export_pdf")
    report = _build_report(date_from, date_to, _allowed_branch_ids(current_user, branch_ids, db), include_unapproved, db)
    output = BytesIO()
    document = SimpleDocTemplate(output, pagesize=landscape(A4), rightMargin=12 * mm, leftMargin=12 * mm, topMargin=12 * mm, bottomMargin=12 * mm)
    styles = getSampleStyleSheet()
    title = ParagraphStyle("ReportTitle", parent=styles["Title"], alignment=TA_CENTER, textColor=colors.HexColor("#073C46"))
    story = [Paragraph("Royal Thai Touch ERP", title), Paragraph("Advanced Financial Report", styles["Heading2"]), Paragraph(f"Period: {report.date_from} to {report.date_to}", styles["Normal"]), Spacer(1, 8)]
    totals = [["Company Revenue", "Company Expenses", "Net Profit"], [f"{report.company_revenue:,.0f} IQD", f"{report.company_expenses:,.0f} IQD", f"{report.company_net_profit:,.0f} IQD"]]
    totals_table = Table(totals, colWidths=[80 * mm, 80 * mm, 80 * mm])
    totals_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#073C46")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#F4E6A5")), ("ALIGN", (0, 0), (-1, -1), "CENTER"), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("GRID", (0, 0), (-1, -1), .5, colors.grey), ("BOTTOMPADDING", (0, 0), (-1, -1), 7), ("TOPPADDING", (0, 0), (-1, -1), 7)]))
    story.extend([totals_table, Spacer(1, 12)])
    summary_data = [["Branch", "Revenue", "Expenses", "Net Profit", "Approved", "Missing"]]
    for item in report.branches:
        summary_data.append([item.branch_name, f"{item.revenue:,.0f}", f"{item.expenses:,.0f}", f"{item.net_profit:,.0f}", str(item.approved_entries), str(item.missing_days)])
    table = Table(summary_data, repeatRows=1, colWidths=[65 * mm, 42 * mm, 42 * mm, 42 * mm, 27 * mm, 27 * mm])
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#073C46")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("ALIGN", (1, 1), (-1, -1), "RIGHT"), ("GRID", (0, 0), (-1, -1), .4, colors.grey), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#EEF5F6")]), ("BOTTOMPADDING", (0, 0), (-1, -1), 6), ("TOPPADDING", (0, 0), (-1, -1), 6)]))
    story.extend([Paragraph("Branch Summary", styles["Heading2"]), table, Spacer(1, 12)])
    daily_data = [["Date", "Branch", "Revenue", "Expense", "Net Profit", "Status"]]
    for item in report.daily_rows:
        daily_data.append([str(item.business_date), item.branch_name, f"{item.revenue:,.0f}", f"{item.allocated_expense:,.0f}", f"{item.net_profit:,.0f}", item.entry_status.title()])
    daily_table = Table(daily_data, repeatRows=1, colWidths=[30 * mm, 62 * mm, 38 * mm, 38 * mm, 38 * mm, 30 * mm])
    daily_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#073C46")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("ALIGN", (2, 1), (4, -1), "RIGHT"), ("GRID", (0, 0), (-1, -1), .3, colors.grey), ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#EEF5F6")]), ("FONTSIZE", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 4)]))
    story.extend([Paragraph("Daily Details", styles["Heading2"]), daily_table])
    document.build(story)
    output.seek(0)
    return StreamingResponse(output, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{_filename("financial_report", report, "pdf")}"'})
