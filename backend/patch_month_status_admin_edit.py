from pathlib import Path

path = Path('/app/app/main.py')
s = path.read_text(encoding='utf-8')

schema_anchor = '''class PendingEntryInput(BaseModel):
    branch_id: int
    business_date: date
    revenue: float = 0
    notes: Optional[str] = None
    expenses: List[DailyEntryExpense] = []
    submitted_by: Optional[str] = None
'''

schema = schema_anchor + '''

class AdminMonthEntryUpdate(BaseModel):
    branch_id: int
    business_date: date
    revenue: float = 0
    closed: bool = False
    notes: Optional[str] = None
    reason: str
    username: str
    secret: str
'''

if 'class AdminMonthEntryUpdate(BaseModel):' not in s:
    if schema_anchor not in s:
        raise SystemExit('PendingEntryInput schema anchor not found')
    s = s.replace(schema_anchor, schema)

route_anchor = '''@app.post("/daily-entry/close")
def close_day(branch_id: int, business_date: date, db: Session = Depends(get_db)):
'''

route = '''@app.patch("/daily-entry/admin-update")
def admin_update_daily_entry(body: AdminMonthEntryUpdate, db: Session = Depends(get_db)):
    admin = db.query(AppUser).filter(
        AppUser.username == body.username,
        AppUser.active == True,
    ).first()
    if not admin or admin.secret != body.secret or str(admin.role or "").strip().lower() != "admin":
        raise HTTPException(status_code=403, detail="Admin access is required")

    reason = str(body.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Reason for change is required")
    if body.revenue < 0:
        raise HTTPException(status_code=400, detail="Revenue must be zero or greater")

    branch = db.query(Branch).filter(Branch.id == body.branch_id, Branch.active == True).first()
    if not branch:
        raise HTTPException(status_code=404, detail="Branch not found")

    revenue = db.query(DailyRevenue).filter(
        DailyRevenue.branch_id == body.branch_id,
        DailyRevenue.business_date == body.business_date,
    ).first()

    old_amount = float(revenue.amount or 0) if revenue else 0
    old_closed = bool(revenue.closed) if revenue else False
    old_notes = revenue.notes or "" if revenue else ""

    if not revenue:
        revenue = DailyRevenue(
            branch_id=body.branch_id,
            business_date=body.business_date,
            amount=body.revenue,
            notes=body.notes,
            closed=body.closed,
        )
        db.add(revenue)
    else:
        revenue.amount = body.revenue
        revenue.closed = body.closed
        if body.notes is not None:
            revenue.notes = body.notes

    new_notes = revenue.notes or ""
    details = (
        f"admin={admin.username}; branch={branch.name}; date={body.business_date}; "
        f"revenue={old_amount}->{float(body.revenue)}; "
        f"status={'Closed' if old_closed else 'Open'}->{'Closed' if body.closed else 'Open'}; "
        f"notes_changed={old_notes != new_notes}; reason={reason}"
    )
    create_audit(db, "ADMIN_UPDATE_DAILY_ENTRY", "DailyEntry", details)
    db.commit()
    db.refresh(revenue)
    return {
        "status": "updated",
        "branch_id": revenue.branch_id,
        "business_date": str(revenue.business_date),
        "revenue": float(revenue.amount or 0),
        "closed": bool(revenue.closed),
        "notes": revenue.notes or "",
    }


'''

if '@app.patch("/daily-entry/admin-update")' not in s:
    if route_anchor not in s:
        raise SystemExit('close day route anchor not found')
    s = s.replace(route_anchor, route + route_anchor)

path.write_text(s, encoding='utf-8')
