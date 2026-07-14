from pathlib import Path

p = Path('/app/app/main.py')
s = p.read_text(encoding='utf-8')

if 'import shutil' not in s:
    s = s.replace('import os\n', 'import os\nimport shutil\nimport platform\n')

if 'from fastapi import Depends, FastAPI, HTTPException, Query, Request' not in s:
    s = s.replace(
        'from fastapi import Depends, FastAPI, HTTPException, Query',
        'from fastapi import Depends, FastAPI, HTTPException, Query, Request'
    )

route = r'''

@app.get("/system-health")
def system_health(request: Request, db: Session = Depends(get_db)):
    started = getattr(app.state, "started_at", datetime.utcnow())
    now = datetime.utcnow()
    disk = shutil.disk_usage("/")
    backup_dir = os.getenv("BACKUP_DIR", "/backups")
    latest_backup = None
    backup_count = 0
    backup_total_bytes = 0
    try:
        files = [x for x in Path(backup_dir).rglob("*") if x.is_file()]
        backup_count = len(files)
        backup_total_bytes = sum(x.stat().st_size for x in files)
        if files:
            newest = max(files, key=lambda x: x.stat().st_mtime)
            latest_backup = {
                "name": newest.name,
                "created_at": datetime.fromtimestamp(newest.stat().st_mtime).isoformat(),
                "size_bytes": newest.stat().st_size,
            }
    except Exception:
        latest_backup = None

    try:
        db_size = int(db.execute(func.pg_database_size(func.current_database())).scalar() or 0)
    except Exception:
        db_size = 0

    active_users = db.query(AppUser).filter(AppUser.active == True).count()
    branch_count = db.query(Branch).filter(Branch.active == True).count()
    employee_count = db.query(Employee).filter(Employee.active == True).count()
    forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)

    return {
        "status": "healthy",
        "backend": "Online",
        "database": "Online",
        "database_size_bytes": db_size,
        "disk_total_bytes": disk.total,
        "disk_used_bytes": disk.used,
        "disk_free_bytes": disk.free,
        "disk_used_percent": round((disk.used / disk.total) * 100, 1) if disk.total else 0,
        "backup_directory": backup_dir,
        "backup_count": backup_count,
        "backup_total_bytes": backup_total_bytes,
        "latest_backup": latest_backup,
        "active_users": active_users,
        "active_branches": branch_count,
        "active_employees": employee_count,
        "ssl": "Active" if forwarded_proto == "https" else "Not detected",
        "version": app.version,
        "python_version": platform.python_version(),
        "server_time": now.isoformat(),
        "uptime_seconds": int((now - started).total_seconds()),
    }
'''

if '@app.get("/system-health")' not in s:
    s += route

if 'app.state.started_at' not in s:
    s = s.replace(
        'app = FastAPI(title="Royal Thai Touch ERP", version="1.1.0")',
        'app = FastAPI(title="Royal Thai Touch ERP", version="1.2.0")\napp.state.started_at = datetime.utcnow()'
    )

p.write_text(s, encoding='utf-8')
