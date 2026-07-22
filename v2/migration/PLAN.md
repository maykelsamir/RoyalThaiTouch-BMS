# v1 to v2 Data Migration Plan

1. Create a read-only backup of the current PostgreSQL database.
2. Build v2 tables with Alembic migrations in a separate database.
3. Import branches, users, employees, daily revenues, expenses, fixed expenses, pending entries, social links and audit logs.
4. Convert legacy user secrets to bcrypt hashes during a controlled password reset flow.
5. Validate row counts and financial totals by branch and month.
6. Run v1 and v2 in parallel for acceptance testing.
7. Schedule a short maintenance window, copy final changes, validate, then switch Nginx to v2.
8. Keep v1 and all backups available for rollback.

No production volume is deleted during this process.