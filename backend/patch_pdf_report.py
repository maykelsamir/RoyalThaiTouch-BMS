from pathlib import Path

path = Path('app/main.py')
s = path.read_text(encoding='utf-8')
start = s.index('@app.get("/reports/pdf")')
end = s.index('@app.get("/audit-logs")', start)
new = '''@app.get("/reports/pdf")
def export_pdf(date_from: date, date_to: date, branch_id: Optional[int] = None, include_expenses: Optional[bool] = None, report_mode: str = "full", db: Session = Depends(get_db)):
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.graphics.barcode.qr import QrCodeWidget
    from reportlab.graphics.shapes import Drawing
    from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

    mode = normalize_report_mode(report_mode, include_expenses)
    data = report_data(db, date_from, date_to, branch_id, mode)
    output = io.BytesIO()
    gold = colors.HexColor('#D4AF37')
    black = colors.HexColor('#101114')
    soft = colors.HexColor('#F4F1E8')
    muted = colors.HexColor('#6B7280')

    doc = SimpleDocTemplate(output, pagesize=A4, rightMargin=16*mm, leftMargin=16*mm, topMargin=28*mm, bottomMargin=23*mm)
    styles = getSampleStyleSheet()
    title = ParagraphStyle('RTTTitle', parent=styles['Title'], fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=black, alignment=TA_CENTER, spaceAfter=4)
    subtitle = ParagraphStyle('RTTSubtitle', parent=styles['Normal'], fontSize=9, leading=13, textColor=muted, alignment=TA_CENTER)
    section = ParagraphStyle('RTTSection', parent=styles['Heading2'], fontName='Helvetica-Bold', fontSize=12, textColor=black, spaceBefore=10, spaceAfter=7)
    small = ParagraphStyle('RTTSmall', parent=styles['Normal'], fontSize=8, leading=11, textColor=muted)

    def money(value):
        return f"IQD {float(value or 0):,.0f}"

    qr_value = f"Royal Thai Touch ERP|{data['branch_name']}|{date_from}|{date_to}|{data['total_revenue']:.0f}|{data['net_profit']:.0f}"
    qr = QrCodeWidget(qr_value)
    bounds = qr.getBounds(); size = 24*mm
    drawing = Drawing(size, size, transform=[size/(bounds[2]-bounds[0]), 0, 0, size/(bounds[3]-bounds[1]), 0, 0])
    drawing.add(qr)

    summary_data = [
        [Paragraph('<b>Total Revenue</b>', small), Paragraph('<b>Total Expenses</b>', small), Paragraph('<b>Net Profit</b>', small)],
        [money(data['total_revenue']), money(data['total_expenses']) if mode == 'full' else 'Hidden', money(data['net_profit']) if mode != 'revenue_only' else 'Hidden']
    ]
    summary_table = Table(summary_data, colWidths=[58*mm, 58*mm, 58*mm], rowHeights=[8*mm, 12*mm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),soft), ('TEXTCOLOR',(0,0),(-1,0),muted),
        ('FONTNAME',(0,1),(-1,1),'Helvetica-Bold'), ('FONTSIZE',(0,1),(-1,1),12),
        ('TEXTCOLOR',(0,1),(-1,1),black), ('ALIGN',(0,0),(-1,-1),'CENTER'),
        ('VALIGN',(0,0),(-1,-1),'MIDDLE'), ('BOX',(0,0),(-1,-1),0.7,gold),
        ('INNERGRID',(0,0),(-1,-1),0.35,colors.HexColor('#D8D8D8'))
    ]))

    story = [
        Paragraph('ROYAL THAI TOUCH', title),
        Paragraph('ERP FINANCIAL REPORT', ParagraphStyle('GoldSub', parent=subtitle, textColor=gold, fontName='Helvetica-Bold', letterSpacing=1.2)),
        Spacer(1, 5*mm),
        Table([[Paragraph(f"<b>Report:</b> {report_mode_label(mode)}<br/><b>Center:</b> {data['branch_name']}<br/><b>Period:</b> {date_from} to {date_to}<br/><b>Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']), drawing]], colWidths=[145*mm, 28*mm], style=[('VALIGN',(0,0),(-1,-1),'TOP'),('ALIGN',(1,0),(1,0),'RIGHT')]),
        Spacer(1, 4*mm), summary_table, Spacer(1, 6*mm),
        Paragraph('Daily Financial Details', section)
    ]

    headers = report_columns(mode)
    table_data = [headers]
    for row in data['daily_rows']:
        values = [row['date'], money(row['revenue'])]
        if mode == 'full': values.append(money(row['expenses']))
        if mode != 'revenue_only': values.append(money(row['net_profit']))
        table_data.append(values)
    total_row = ['TOTAL', money(data['total_revenue'])]
    if mode == 'full': total_row.append(money(data['total_expenses']))
    if mode != 'revenue_only': total_row.append(money(data['net_profit']))
    table_data.append(total_row)
    widths = [38*mm] + [((174-38)/max(1,len(headers)-1))*mm]*(len(headers)-1)
    detail = Table(table_data, colWidths=widths, repeatRows=1)
    detail.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),black), ('TEXTCOLOR',(0,0),(-1,0),gold),
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'), ('FONTSIZE',(0,0),(-1,0),9),
        ('ROWBACKGROUNDS',(0,1),(-1,-2),[colors.white, colors.HexColor('#F8F8F8')]),
        ('GRID',(0,0),(-1,-1),0.35,colors.HexColor('#C8C8C8')), ('ALIGN',(1,1),(-1,-1),'RIGHT'),
        ('ALIGN',(0,0),(0,-1),'LEFT'), ('FONTSIZE',(0,1),(-1,-1),8.5), ('LEADING',(0,1),(-1,-1),11),
        ('BACKGROUND',(0,-1),(-1,-1),soft), ('FONTNAME',(0,-1),(-1,-1),'Helvetica-Bold'),
        ('LINEABOVE',(0,-1),(-1,-1),1,gold), ('TOPPADDING',(0,0),(-1,-1),6), ('BOTTOMPADDING',(0,0),(-1,-1),6)
    ]))
    story += [detail, Spacer(1, 9*mm), KeepTogether(Table([
        [Paragraph('<b>Prepared by</b><br/><br/>________________________', styles['Normal']), Paragraph('<b>Manager Approval</b><br/><br/>________________________', styles['Normal'])]
    ], colWidths=[87*mm,87*mm], style=[('ALIGN',(0,0),(-1,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'TOP')]))]

    def page_decor(canvas, doc_obj):
        canvas.saveState(); w,h=A4
        canvas.setFillColor(black); canvas.rect(0,h-17*mm,w,17*mm,fill=1,stroke=0)
        canvas.setStrokeColor(gold); canvas.setLineWidth(1.4); canvas.line(16*mm,h-19*mm,w-16*mm,h-19*mm)
        canvas.setFillColor(gold); canvas.setFont('Helvetica-Bold',13); canvas.drawString(16*mm,h-11*mm,'RTT')
        canvas.setFillColor(colors.white); canvas.setFont('Helvetica',8); canvas.drawRightString(w-16*mm,h-11*mm,'ROYAL THAI TOUCH ERP')
        canvas.setStrokeColor(gold); canvas.setLineWidth(.6); canvas.line(16*mm,16*mm,w-16*mm,16*mm)
        canvas.setFillColor(muted); canvas.setFont('Helvetica',7.5)
        canvas.drawString(16*mm,10*mm,'Confidential financial document')
        canvas.drawRightString(w-16*mm,10*mm,f'Page {doc_obj.page}')
        canvas.restoreState()

    doc.build(story, onFirstPage=page_decor, onLaterPages=page_decor)
    output.seek(0)
    filename = f"royal-thai-touch-{data['branch_name'].replace(' ', '-')}-{date_from}-to-{date_to}-{mode}.pdf"
    return StreamingResponse(output, media_type='application/pdf', headers={'Content-Disposition': f'attachment; filename={filename}'})

'''
path.write_text(s[:start] + new + s[end:], encoding='utf-8')
