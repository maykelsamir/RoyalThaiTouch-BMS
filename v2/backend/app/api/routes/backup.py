from __future__ import annotations

import os
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import unquote, urlparse

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.models.user import User

router = APIRouter(prefix="/backup", tags=["backup"])
settings = get_settings()
BACKUP_DIR = Path(os.getenv("BACKUP_DIR", "/app/backups"))
SAFE_NAME = re.compile(r"^RoyalThaiTouch_\d{8}_\d{6}\.dump$")


class RestoreRequest(BaseModel):
    filename: str
    confirmation: str


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if str(current_user.role or "").strip().lower() != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator access required")
    return current_user


def _database_args() -> tuple[list[str], dict[str, str]]:
    parsed = urlparse(settings.database_url.replace("postgresql+psycopg2://", "postgresql://", 1))
    if parsed.scheme not in {"postgresql", "postgres"}:
        raise HTTPException(status_code=500, detail="Unsupported database connection")
    args = [
        "--host", parsed.hostname or "db",
        "--port", str(parsed.port or 5432),
        "--username", unquote(parsed.username or ""),
        "--dbname", unquote((parsed.path or "").lstrip("/")),
    ]
    env = os.environ.copy()
    env["PGPASSWORD"] = unquote(parsed.password or "")
    return args, env


def _path(filename: str) -> Path:
    if not SAFE_NAME.fullmatch(filename):
        raise HTTPException(status_code=400, detail="Invalid backup filename")
    path = BACKUP_DIR / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Backup not found")
    return path


def _run(command: list[str], env: dict[str, str]) -> None:
    try:
        result = subprocess.run(command, env=env, capture_output=True, text=True, timeout=900, check=False)
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise HTTPException(status_code=500, detail=f"Backup command failed: {exc}") from exc
    if result.returncode != 0:
        message = (result.stderr or result.stdout or "Database command failed").strip()
        raise HTTPException(status_code=500, detail=message[-1200:])


@router.get("")
def list_backups(_: User = Depends(require_admin)) -> list[dict]:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    items = []
    for path in sorted(BACKUP_DIR.glob("RoyalThaiTouch_*.dump"), key=lambda item: item.stat().st_mtime, reverse=True):
        if not SAFE_NAME.fullmatch(path.name):
            continue
        stat = path.stat()
        items.append({
            "filename": path.name,
            "size": stat.st_size,
            "created_at": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
        })
    return items


@router.post("", status_code=201)
def create_backup(current_user: User = Depends(require_admin)) -> dict:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"RoyalThaiTouch_{datetime.now(timezone.utc):%Y%m%d_%H%M%S}.dump"
    destination = BACKUP_DIR / filename
    db_args, env = _database_args()
    _run(["pg_dump", *db_args, "--format=custom", "--no-owner", "--no-privileges", "--file", str(destination)], env)
    if not destination.is_file() or destination.stat().st_size == 0:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Backup file was not created")
    return {
        "filename": filename,
        "size": destination.stat().st_size,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": current_user.username,
    }


@router.get("/{filename}/download")
def download_backup(filename: str, _: User = Depends(require_admin)) -> FileResponse:
    path = _path(filename)
    return FileResponse(path, media_type="application/octet-stream", filename=path.name)


@router.post("/restore")
def restore_backup(payload: RestoreRequest, _: User = Depends(require_admin)) -> dict:
    if payload.confirmation != "RESTORE":
        raise HTTPException(status_code=400, detail="Type RESTORE to confirm")
    path = _path(payload.filename)
    db_args, env = _database_args()
    _run([
        "pg_restore", *db_args, "--clean", "--if-exists", "--no-owner", "--no-privileges",
        "--exit-on-error", str(path),
    ], env)
    return {"message": "Database restored successfully", "filename": path.name}


@router.delete("/{filename}")
def delete_backup(filename: str, _: User = Depends(require_admin)) -> dict:
    path = _path(filename)
    path.unlink()
    return {"message": "Backup deleted", "filename": filename}
