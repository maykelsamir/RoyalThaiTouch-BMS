from pathlib import Path

path = Path('/app/app/main.py')
s = path.read_text()

s = s.replace(
    'from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint, create_engine, func',
    'from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, JSON, Numeric, String, Text, UniqueConstraint, create_engine, func, text as sql_text'
)

s = s.replace(
    '    status = Column(String(60), default="Pending Approval")',
    '    status = Column(String(60), default="Pending Approval")\n    report_image = Column(Text, nullable=True)'
)

s = s.replace(
    '    submitted_by: Optional[str] = None\n\n\ndef wait_for_database',
    '    submitted_by: Optional[str] = None\n    report_image: Optional[str] = None\n\n\ndef wait_for_database'
)

s = s.replace(
    '    wait_for_database()\n    db = SessionLocal()',
    '    wait_for_database()\n    with engine.begin() as connection:\n        connection.execute(sql_text("ALTER TABLE pending_daily_entries ADD COLUMN IF NOT EXISTS report_image TEXT"))\n    db = SessionLocal()'
)

s = s.replace(
    '"status": p.status} for p in db.query(PendingDailyEntry)',
    '"status": p.status, "report_image": p.report_image or ""} for p in db.query(PendingDailyEntry)'
)

s = s.replace(
    'expenses=[x.dict() for x in body.expenses], submitted_by=body.submitted_by)',
    'expenses=[x.dict() for x in body.expenses], submitted_by=body.submitted_by, report_image=body.report_image)'
)

path.write_text(s)
