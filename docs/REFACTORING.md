# Royal Thai Touch ERP Refactoring

## Goal
Stop adding new features through build-time patch files. New features must be implemented directly in maintained frontend and backend modules.

## Phase 1 — Started
- Direct backend router for System Health.
- Backend composition entrypoint: `app.bootstrap:app`.
- Shared frontend API client: `src/core/api.js`.
- Shared frontend session service: `src/core/session.js`.
- No new feature may introduce another `patch-*.cjs` or `patch_*.py` file.

## Phase 2
Split the frontend monolith into:

- `src/app/App.jsx`
- `src/components/`
- `src/features/auth/`
- `src/features/dashboard/`
- `src/features/daily-entry/`
- `src/features/month-status/`
- `src/features/reports/`
- `src/features/employees/`
- `src/features/users/`
- `src/features/system-health/`

## Phase 3
Move backend features into routers and services:

- `app/routers/`
- `app/services/`
- `app/models/`
- `app/schemas/`
- `app/security/`

## Phase 4
Remove all remaining patch execution lines from Dockerfiles after each corresponding feature has been migrated and tested.

## Rule
A patch may be removed only after its generated behavior exists directly in source code and production verification succeeds.
