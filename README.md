# Royal Thai Touch ERP

Royal Thai Touch ERP is a multi-branch financial management system for:

- Canyon Thai Spa
- Sheratoon Thai Spa
- Hyksos Thai Spa
- Crixus Thai Spa

## Version

v0.7.0

## Features included

- Executive dashboard
- Daily revenue entry
- Multiple expenses per branch per day
- Automatic net profit calculation
- Branch status tracking
- Date range reports
- Excel export
- Audit log foundation
- Docker Compose stack
- PostgreSQL persistence
- React + FastAPI implementation

## Tech Stack

- Frontend: React + Vite
- Backend: FastAPI
- Database: PostgreSQL
- Reports: OpenPyXL
- Deployment: Docker Compose

## Run locally

Make sure Docker Desktop is running, then run:

```bash
docker compose up --build
```

Open:

```text
http://localhost:5173
```

Backend API:

```text
http://localhost:8000
```

API Docs:

```text
http://localhost:8000/docs
```

## Notes

This version has no login screen. It opens directly to the ERP dashboard for fast internal use.
