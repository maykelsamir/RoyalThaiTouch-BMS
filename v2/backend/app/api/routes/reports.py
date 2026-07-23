from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
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
    expense_rows = list(
        db.scalars(
            select(MonthlyExpense).where(
                MonthlyExpense.branch_id.in_(ids),
                tuple_(MonthlyExpense.year, MonthlyExpense.month).in_(periods),
            )
        )
    ) if ids else []
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
            daily_rows.append(
                ReportDailyRow(
                    business_date=cursor,
                    branch_id=branch.id,
                    branch_name=branch.name,
                    revenue=revenue,
                    allocated_expense=expense,
                    net_profit=revenue - expense,
                    entry_status=status,
                )
            )
            cursor += timedelta(days=1)
        branch_expenses = sum(allocation.values(), Decimal(0))
        summaries.append(
            ReportBranchSummary(
                branch_id=branch.id,
                branch_name=branch.name,
                revenue=branch_revenue,
                expenses=branch_expenses,
                net_profit=branch_revenue - branch_expenses,
                approved_entries=approved,
                missing_days=missing,
            )
        )
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
def view_report(
    date_from: date,
    date_to: date,
    branch_ids: list[int] | None = Query(default=None),
    include_unapproved: bool = False,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{_name(report, "xlsx")}"'},
    )


def _money(value: Decimal) -> str:
    return f"IQD {value:,.0f}"


def _qr_drawing(value: str, size: float = 22 * mm) -> Drawing:
    widget = qr.QrCodeWidget(value)
    bounds = widget.getBounds()
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(widget)
    return drawing


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
    ids = _branch_ids(current_user, branch_ids, db)
    report = _report(date_from, date_to, ids, include_unapproved, db)

    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=10 * mm,
        bottomMargin=12 * mm,
        title="Royal Thai Touch ERP Financial Report",
        author="Royal Thai Touch ERP",
    )
    styles = getSampleStyleSheet()
    gold = colors.HexColor("#D9A514")
    black = colors.HexColor("#111214")
    soft_gold = colors.HexColor("#F7F3E8")
    line = colors.HexColor("#C8C8C8")
    pale = colors.HexColor("#F7F7F7")

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=17,
        leading=20,
        alignment=1,
        textColor=black,
        spaceAfter=0,
    )
    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7,
        leading=9,
        alignment=1,
        textColor=gold,
    )
    meta_style = ParagraphStyle(
        "ReportMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.6,
        leading=10,
        textColor=black,
    )
    section_style = ParagraphStyle(
        "SectionTitle",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=10,
        leading=13,
        textColor=black,
        spaceBefore=4,
        spaceAfter=7,
    )

    branch_label = report.branches[0].branch_name if len(report.branches) == 1 else "All Selected Centers"
    generated = datetime.fromisoformat(report.generated_at.replace("Z", "+00:00")).astimezone(timezone.utc)
    report_type = "Full financial report"
    if show_profit and not show_revenue and not show_expenses:
        report_type = "Profit only report"
    elif show_revenue and not show_expenses and not show_profit:
        report_type = "Total revenue report"

    story = [
        Paragraph("ROYAL THAI TOUCH", title_style),
        Paragraph("ERP FINANCIAL REPORT", subtitle_style),
        Spacer(1, 8 * mm),
    ]

    meta_text = (
        f"<b>Report:</b> {report_type}<br/>"
        f"<b>Center:</b> {branch_label}<br/>"
        f"<b>Period:</b> {report.date_from} to {report.date_to}<br/>"
        f"<b>Generated:</b> {generated:%Y-%m-%d %H:%M} UTC"
    )
    qr_value = (
        f"Royal Thai Touch ERP|{report_type}|{branch_label}|"
        f"{report.date_from}:{report.date_to}|Revenue:{report.company_revenue}|"
        f"Expenses:{report.company_expenses}|Profit:{report.company_net_profit}"
    )
    header = Table(
        [[Paragraph(meta_text, meta_style), _qr_drawing(qr_value)]],
        colWidths=[document.width - 27 * mm, 27 * mm],
    )
    header.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (1, 0), (1, 0), "RIGHT"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.extend([header, Spacer(1, 7 * mm)])

    total_headers: list[str] = []
    total_values: list[str] = []
    if show_revenue:
        total_headers.append("Total Revenue")
        total_values.append(_money(report.company_revenue))
    if show_expenses:
        total_headers.append("Total Expenses")
        total_values.append(_money(report.company_expenses))
    if show_profit:
        total_headers.append("Net Profit")
        total_values.append(_money(report.company_net_profit))
    total_width = document.width / len(total_headers)
    totals = Table([total_headers, total_values], colWidths=[total_width] * len(total_headers), rowHeights=[8 * mm, 12 * mm])
    totals.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), soft_gold),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#777777")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 6.5),
                ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 1), (-1, 1), 10),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("GRID", (0, 0), (-1, -1), 0.45, line),
                ("BOX", (0, 0), (-1, -1), 0.8, gold),
            ]
        )
    )
    story.extend([totals, Spacer(1, 8 * mm)])

    if show_branch_summary and len(report.branches) > 1:
        summary_headers = ["Center"]
        if show_revenue:
            summary_headers.append("Revenue")
        if show_expenses:
            summary_headers.append("Expenses")
        if show_profit:
            summary_headers.append("Net Profit")
        summary_headers.extend(["Approved", "Missing"])
        summary_rows = [summary_headers]
        for item in report.branches:
            row: list[object] = [item.branch_name]
            if show_revenue:
                row.append(_money(item.revenue))
            if show_expenses:
                row.append(_money(item.expenses))
            if show_profit:
                row.append(_money(item.net_profit))
            row.extend([item.approved_entries, item.missing_days])
            summary_rows.append(row)
        summary_table = Table(summary_rows, repeatRows=1, colWidths=None)
        summary_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), black),
                    ("TEXTCOLOR", (0, 0), (-1, 0), gold),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 7),
                    ("GRID", (0, 0), (-1, -1), 0.35, line),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, pale]),
                    ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        story.extend([KeepTogether([Paragraph("Center Summary", section_style), summary_table]), Spacer(1, 7 * mm)])

    if show_daily_details:
        story.append(Paragraph("Daily Financial Details", section_style))
        single_branch = len(report.branches) == 1
        headers = ["Date"]
        if not single_branch:
            headers.append("Center")
        if show_revenue:
            headers.append("Revenue")
        if show_expenses:
            headers.append("Expenses")
        if show_profit:
            headers.append("Net Profit")

        rows: list[list[object]] = [headers]
        for item in report.daily_rows:
            row: list[object] = [str(item.business_date)]
            if not single_branch:
                row.append(item.branch_name)
            if show_revenue:
                row.append(_money(item.revenue))
            if show_expenses:
                row.append(_money(item.allocated_expense))
            if show_profit:
                row.append(_money(item.net_profit))
            rows.append(row)

        total_row: list[object] = ["TOTAL"]
        if not single_branch:
            total_row.append("")
        if show_revenue:
            total_row.append(_money(report.company_revenue))
        if show_expenses:
            total_row.append(_money(report.company_expenses))
        if show_profit:
            total_row.append(_money(report.company_net_profit))
        rows.append(total_row)

        column_count = len(headers)
        if single_branch:
            date_width = 37 * mm
            other_width = (document.width - date_width) / max(column_count - 1, 1)
            widths = [date_width] + [other_width] * (column_count - 1)
        else:
            date_width = 28 * mm
            branch_width = 54 * mm
            other_width = (document.width - date_width - branch_width) / max(column_count - 2, 1)
            widths = [date_width, branch_width] + [other_width] * (column_count - 2)

        details = Table(rows, repeatRows=1, colWidths=widths)
        total_index = len(rows) - 1
        numeric_start = 1 if single_branch else 2
        details.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), black),
                    ("TEXTCOLOR", (0, 0), (-1, 0), gold),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 6.5),
                    ("GRID", (0, 0), (-1, -1), 0.35, line),
                    ("ROWBACKGROUNDS", (0, 1), (-1, total_index - 1), [colors.white, pale]),
                    ("ALIGN", (numeric_start, 1), (-1, -1), "RIGHT"),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 4.3),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4.3),
                    ("BACKGROUND", (0, total_index), (-1, total_index), soft_gold),
                    ("FONTNAME", (0, total_index), (-1, total_index), "Helvetica-Bold"),
                    ("LINEABOVE", (0, total_index), (-1, total_index), 0.8, gold),
                ]
            )
        )
        story.append(details)

    document.build(story)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{_name(report, "pdf")}"'},
    )
