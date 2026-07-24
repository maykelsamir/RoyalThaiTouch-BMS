from datetime import date, datetime, timezone
from decimal import Decimal
from io import BytesIO

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.routes.reports import _branch_ids, _money, _name, _qr_drawing, _report, _require, _validate_selection
from app.db.session import get_db
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/export/pdf")
def styled_pdf(
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
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=10 * mm,
        bottomMargin=12 * mm,
        title="Royal Thai Touch ERP Financial Report",
        author="Royal Thai Touch ERP",
    )

    styles = getSampleStyleSheet()
    navy = colors.HexColor("#10233F")
    blue = colors.HexColor("#1479D1")
    zero_red = colors.HexColor("#D62828")
    gold = colors.HexColor("#D9A514")
    soft_gold = colors.HexColor("#F7F3E8")
    pale_blue = colors.HexColor("#EEF4FA")
    line = colors.HexColor("#C7D1DD")
    white = colors.white

    title_style = ParagraphStyle(
        "StyledReportTitle",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=21,
        alignment=1,
        textColor=navy,
        spaceAfter=1,
    )
    subtitle_style = ParagraphStyle(
        "StyledReportSubtitle",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        alignment=1,
        textColor=gold,
    )
    meta_style = ParagraphStyle(
        "StyledReportMeta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.8,
        leading=11,
        textColor=navy,
    )
    section_style = ParagraphStyle(
        "StyledSectionTitle",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=10.5,
        leading=13,
        textColor=navy,
        spaceBefore=5,
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
        Spacer(1, 7 * mm),
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
    header = Table([[Paragraph(meta_text, meta_style), _qr_drawing(qr_value)]], colWidths=[document.width - 28 * mm, 28 * mm])
    header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), pale_blue),
        ("BOX", (0, 0), (-1, -1), 0.8, line),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story.extend([header, Spacer(1, 6 * mm)])

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
    totals.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), navy),
        ("TEXTCOLOR", (0, 0), (-1, 0), gold),
        ("BACKGROUND", (0, 1), (-1, 1), soft_gold),
        ("TEXTCOLOR", (0, 1), (-1, 1), navy),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 7),
        ("FONTSIZE", (0, 1), (-1, 1), 10),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("GRID", (0, 0), (-1, -1), 0.5, line),
        ("BOX", (0, 0), (-1, -1), 0.9, navy),
    ]))
    story.extend([totals, Spacer(1, 7 * mm)])

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
        summary_table = Table(summary_rows, repeatRows=1)
        summary_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), navy),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("GRID", (0, 0), (-1, -1), 0.4, line),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [white, pale_blue]),
            ("ALIGN", (1, 1), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.extend([KeepTogether([Paragraph("Center Summary", section_style), summary_table]), Spacer(1, 7 * mm)])

    if show_daily_details:
        story.append(Paragraph("Daily Financial Details", section_style))
        single_branch = len(report.branches) == 1
        headers = ["Date"]
        if not single_branch:
            headers.append("Center")
        revenue_column = None
        if show_revenue:
            revenue_column = len(headers)
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
            date_width = 34 * mm
            other_width = (document.width - date_width) / max(column_count - 1, 1)
            widths = [date_width] + [other_width] * (column_count - 1)
        else:
            date_width = 25 * mm
            branch_width = 50 * mm
            other_width = (document.width - date_width - branch_width) / max(column_count - 2, 1)
            widths = [date_width, branch_width] + [other_width] * (column_count - 2)

        details = Table(rows, repeatRows=1, colWidths=widths)
        total_index = len(rows) - 1
        numeric_start = 1 if single_branch else 2
        commands = [
            ("BACKGROUND", (0, 0), (-1, 0), navy),
            ("TEXTCOLOR", (0, 0), (-1, 0), white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 6.7),
            ("GRID", (0, 0), (-1, -1), 0.4, line),
            ("ROWBACKGROUNDS", (0, 1), (-1, total_index - 1), [white, pale_blue]),
            ("ALIGN", (numeric_start, 1), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4.5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4.5),
            ("BACKGROUND", (0, total_index), (-1, total_index), soft_gold),
            ("FONTNAME", (0, total_index), (-1, total_index), "Helvetica-Bold"),
            ("LINEABOVE", (0, total_index), (-1, total_index), 0.9, gold),
        ]

        if revenue_column is not None:
            for row_index, item in enumerate(report.daily_rows, start=1):
                value = Decimal(item.revenue or 0)
                if value == 0:
                    commands.extend([
                        ("BACKGROUND", (revenue_column, row_index), (revenue_column, row_index), zero_red),
                        ("TEXTCOLOR", (revenue_column, row_index), (revenue_column, row_index), white),
                        ("FONTNAME", (revenue_column, row_index), (revenue_column, row_index), "Helvetica-Bold"),
                    ])
                elif value >= Decimal("1000000"):
                    commands.extend([
                        ("BACKGROUND", (revenue_column, row_index), (revenue_column, row_index), blue),
                        ("TEXTCOLOR", (revenue_column, row_index), (revenue_column, row_index), white),
                        ("FONTNAME", (revenue_column, row_index), (revenue_column, row_index), "Helvetica-Bold"),
                    ])

        details.setStyle(TableStyle(commands))
        story.append(details)

    document.build(story)
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{_name(report, "pdf")}"'},
    )
