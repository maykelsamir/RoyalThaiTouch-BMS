from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, text

from app.api.routes.audit import router as audit_router
from app.api.routes.auth import router as auth_router
from app.api.routes.branches import router as branches_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.daily_approval import router as daily_approval_router
from app.api.routes.daily_revenue import router as daily_revenue_router
from app.api.routes.hr import router as hr_router
from app.api.routes.month_status import router as month_status_router
from app.api.routes.monthly_expenses import router as monthly_expenses_router
from app.api.routes.reports import router as reports_router
from app.api.routes.reports_pdf_styled import router as reports_pdf_styled_router
from app.api.routes.user_admin import router as user_admin_router
from app.core.config import get_settings
from app.core.security import decode_token
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.audit import AuditLog  # noqa: F401
from app.models.finance import Branch, DailyRevenue, Expense, MonthlyExpense  # noqa: F401
from app.models.hr import Employee  # noqa: F401
from app.models.user import RoleProfile, User  # noqa: F401

settings = get_settings()
app = FastAPI(title=settings.app_name, version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:15173", "http://127.0.0.1:15173"],
    allow_origin_regex=r"https?://.*:15173",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _audit_identity(request: Request, db):
    authorization = request.headers.get("authorization", "")
    if not authorization.lower().startswith("bearer "):
        return None
    try:
        payload = decode_token(authorization.split(" ", 1)[1])
        if payload.get("type") != "access":
            return None
        return db.scalar(select(User).where(User.id == int(payload.get("sub", 0))))
    except Exception:
        return None


def _request_action(method: str, path: str) -> str:
    last = path.rstrip("/").split("/")[-1].replace("-", "_")
    if last in {"approve", "reject", "logout", "login", "setup", "excel", "pdf", "csv", "reset_password", "status"}:
        return last
    return {"POST": "create", "PUT": "update", "PATCH": "update", "DELETE": "delete"}.get(method, "view")


@app.middleware("http")
async def audit_mutations(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    should_log = path.startswith("/api/") and not path.startswith("/api/audit") and (
        request.method in {"POST", "PUT", "PATCH", "DELETE"} or path.startswith("/api/reports/export/")
    )
    if should_log:
        try:
            with SessionLocal() as db:
                user = _audit_identity(request, db)
                parts = path.removeprefix("/api/").split("/")
                module = parts[0] if parts else "system"
                action = _request_action(request.method, path)
                result = "success" if response.status_code < 400 else "failed"
                entity_id = next((part for part in reversed(parts) if part.isdigit()), "")
                forwarded = request.headers.get("x-forwarded-for", "")
                ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "")
                db.add(AuditLog(
                    user_id=user.id if user else None,
                    username=user.username if user else "Anonymous",
                    role=user.role if user else "",
                    action=action,
                    module=module,
                    entity_type=module,
                    entity_id=entity_id,
                    result=result,
                    description=f"{request.method} {path}",
                    request_method=request.method,
                    request_path=path,
                    ip_address=ip,
                    user_agent=request.headers.get("user-agent", "")[:1000],
                ))
                db.commit()
        except Exception:
            pass
    return response


app.include_router(auth_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(daily_revenue_router, prefix="/api")
app.include_router(month_status_router, prefix="/api")
app.include_router(daily_approval_router, prefix="/api")
app.include_router(monthly_expenses_router, prefix="/api")
app.include_router(reports_pdf_styled_router, prefix="/api")
app.include_router(reports_router, prefix="/api")
app.include_router(user_admin_router, prefix="/api")
app.include_router(audit_router, prefix="/api")
app.include_router(branches_router, prefix="/api")
app.include_router(hr_router, prefix="/api")


@app.on_event("startup")
def startup() -> None:
    if settings.environment == "development":
        Base.metadata.create_all(bind=engine)
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE daily_revenues_v2 ADD COLUMN IF NOT EXISTS report_image TEXT NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE daily_revenues_v2 ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'draft'"))
            connection.execute(text("ALTER TABLE daily_revenues_v2 ADD COLUMN IF NOT EXISTS created_by INTEGER NULL REFERENCES users_v2(id) ON DELETE SET NULL"))
            connection.execute(text("ALTER TABLE daily_revenues_v2 ADD COLUMN IF NOT EXISTS approved_by INTEGER NULL REFERENCES users_v2(id) ON DELETE SET NULL"))
            connection.execute(text("ALTER TABLE daily_revenues_v2 ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL"))
            connection.execute(text("ALTER TABLE daily_revenues_v2 ADD COLUMN IF NOT EXISTS rejected_by INTEGER NULL REFERENCES users_v2(id) ON DELETE SET NULL"))
            connection.execute(text("ALTER TABLE daily_revenues_v2 ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ NULL"))
            connection.execute(text("ALTER TABLE daily_revenues_v2 ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(1000) NOT NULL DEFAULT ''"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_daily_revenues_v2_status ON daily_revenues_v2 (status)"))
            connection.execute(text("""
                DO $$
                DECLARE constraint_record RECORD;
                BEGIN
                    FOR constraint_record IN
                        SELECT conname
                        FROM pg_constraint
                        WHERE conrelid = 'daily_revenues_v2'::regclass
                          AND contype = 'c'
                          AND pg_get_constraintdef(oid) ILIKE '%amount%'
                    LOOP
                        EXECUTE format('ALTER TABLE daily_revenues_v2 DROP CONSTRAINT %I', constraint_record.conname);
                    END LOOP;
                END $$;
            """))
            connection.execute(text("ALTER TABLE daily_revenues_v2 ADD CONSTRAINT ck_daily_revenues_v2_amount_nonnegative CHECK (amount >= 0) NOT VALID"))
            connection.execute(text("ALTER TABLE daily_revenues_v2 VALIDATE CONSTRAINT ck_daily_revenues_v2_amount_nonnegative"))
            connection.execute(text("ALTER TABLE users_v2 ADD COLUMN IF NOT EXISTS full_name VARCHAR(160) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE users_v2 ADD COLUMN IF NOT EXISTS email VARCHAR(180) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE users_v2 ADD COLUMN IF NOT EXISTS phone VARCHAR(60) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE users_v2 ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS code VARCHAR(40) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS country VARCHAR(100) NOT NULL DEFAULT 'Iraq'"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS city VARCHAR(120) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS address VARCHAR(500) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS phone VARCHAR(60) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS email VARCHAR(180) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(60) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS manager_name VARCHAR(160) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS opening_date DATE NULL"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS logo TEXT NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS cover_image TEXT NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS notes VARCHAR(2000) NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE branches_v2 ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"))
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS ux_branches_v2_code_nonempty ON branches_v2 (LOWER(code)) WHERE code <> ''"))
            connection.execute(text("ALTER TABLE employees_v2 ADD COLUMN IF NOT EXISTS id_card_front TEXT NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE employees_v2 ADD COLUMN IF NOT EXISTS id_card_back TEXT NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE employees_v2 ADD COLUMN IF NOT EXISTS passport_photo TEXT NOT NULL DEFAULT ''"))
            connection.execute(text("ALTER TABLE employees_v2 ADD COLUMN IF NOT EXISTS salary_currency VARCHAR(3) NOT NULL DEFAULT 'IQD'"))
            connection.execute(text("UPDATE employees_v2 SET salary_currency = 'IQD' WHERE salary_currency NOT IN ('IQD', 'USD') OR salary_currency IS NULL"))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy", "application": settings.app_name, "version": "2.0.0"}


@app.get("/api/health")
def api_health() -> dict[str, str]:
    return health()
