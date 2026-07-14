from __future__ import annotations

from datetime import datetime
import os
from pathlib import Path
import platform
import shutil

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func
from sqlalchemy.orm import Session


def create_system_health_router(*, get_db, app_user_model, branch_model, employee_model) -> APIRouter:
    router = APIRouter(tags=["system-health"])
    started_at = datetime.utcnow()

    @router.get("/system-health")
    def system_health(request: Request, db: Session = Depends(get_db)):
        now = datetime.utcnow()
        disk = shutil.disk_usage("/")
        backup_dir = Path(os.getenv("BACKUP_DIR", "/backups"))

        latest_backup = None
        backup_count = 0
        backup_total_bytes = 0
        try:
            files = [item for item in backup_dir.rglob("*") if item.is_file()]
            backup_count = len(files)
            backup_total_bytes = sum(item.stat().st_size for item in files)
            if files:
                newest = max(files, key=lambda item: item.stat().st_mtime)
                latest_backup = {
                    "name": newest.name,
                    "created_at": datetime.fromtimestamp(newest.stat().st_mtime).isoformat(),
                    "size_bytes": newest.stat().st_size,
                }
        except OSError:
            latest_backup = None

        try:
            database_size = int(db.execute(func.pg_database_size(func.current_database())).scalar() or 0)
        except Exception:
            database_size = 0

        forwarded_proto = request.headers.get("x-forwarded-proto", request.url.scheme)
        return {
            "status": "healthy",
            "backend": "Online",
            "database": "Online",
            "database_size_bytes": database_size,
            "disk_total_bytes": disk.total,
            "disk_used_bytes": disk.used,
            "disk_free_bytes": disk.free,
            "disk_used_percent": round((disk.used / disk.total) * 100, 1) if disk.total else 0,
            "backup_directory": str(backup_dir),
            "backup_count": backup_count,
            "backup_total_bytes": backup_total_bytes,
            "latest_backup": latest_backup,
            "active_users": db.query(app_user_model).filter(app_user_model.active.is_(True)).count(),
            "active_branches": db.query(branch_model).filter(branch_model.active.is_(True)).count(),
            "active_employees": db.query(employee_model).filter(employee_model.active.is_(True)).count(),
            "ssl": "Active" if forwarded_proto == "https" else "Not detected",
            "python_version": platform.python_version(),
            "server_time": now.isoformat(),
            "uptime_seconds": int((now - started_at).total_seconds()),
        }

    return router
