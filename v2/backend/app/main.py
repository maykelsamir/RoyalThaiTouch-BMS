from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.routes.auth import router as auth_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.daily_approval import router as daily_approval_router
from app.api.routes.daily_revenue import router as daily_revenue_router
from app.api.routes.month_status import router as month_status_router
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine
from app.models.finance import Branch, DailyRevenue, Expense  # noqa: F401
from app.models.user import User  # noqa: F401

settings = get_settings()
app = FastAPI(title=settings.app_name, version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:15173",
        "http://127.0.0.1:15173",
    ],
    allow_origin_regex=r"https?://.*:15173",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(daily_revenue_router, prefix="/api")
app.include_router(month_status_router, prefix="/api")
app.include_router(daily_approval_router, prefix="/api")


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


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy", "application": settings.app_name, "version": "2.0.0"}


@app.get("/api/health")
def api_health() -> dict[str, str]:
    return health()
