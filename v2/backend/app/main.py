from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.auth import router as auth_router
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import engine
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


@app.on_event("startup")
def startup() -> None:
    if settings.environment == "development":
        Base.metadata.create_all(bind=engine)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy", "application": settings.app_name, "version": "2.0.0"}


@app.get("/api/health")
def api_health() -> dict[str, str]:
    return health()
