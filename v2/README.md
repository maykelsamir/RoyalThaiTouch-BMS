# Royal Thai Touch ERP v2.0

This directory contains the clean replacement for the patch-based v1 application.

## Principles

- No build-time patch files.
- FastAPI routers, services, repositories and SQLAlchemy models.
- Alembic migrations for every schema change.
- JWT authentication and backend-enforced permissions.
- React pages and reusable components.
- Existing PostgreSQL data is migrated; production data is not deleted.

## Structure

- `backend/` FastAPI API and migrations.
- `frontend/` React application.
- `migration/` tools for importing the current v1 database.
- `docker-compose.yml` isolated v2 development stack.

The production v1 system remains unchanged while v2 is developed and tested.