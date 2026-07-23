from __future__ import annotations

import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import MetaData, Table, create_engine, inspect, select, text
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.db.base import Base
from app.db.session import engine as target_engine
from app.models.finance import Branch, DailyRevenue, Expense
from app.models.user import User


LEGACY_DATABASE_URL = os.getenv("LEGACY_DATABASE_URL", "").strip()


def as_list(value) -> list:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    if isinstance(value, str):
        try:
            decoded = json.loads(value)
            return decoded if isinstance(decoded, list) else []
        except json.JSONDecodeError:
            return [item.strip() for item in value.split(",") if item.strip()]
    return []


def clean_text(value) -> str:
    return "" if value is None else str(value)


def normalize_amount(value) -> Decimal:
    if value is None:
        return Decimal("0")
    return Decimal(str(value)).quantize(Decimal("1"))


def ensure_migration_table() -> None:
    with target_engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS legacy_migration_map (
                    entity VARCHAR(80) NOT NULL,
                    legacy_id INTEGER NOT NULL,
                    target_id INTEGER,
                    migrated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (entity, legacy_id)
                )
                """
            )
        )


def was_migrated(session: Session, entity: str, legacy_id: int) -> bool:
    return bool(
        session.execute(
            text(
                "SELECT 1 FROM legacy_migration_map "
                "WHERE entity = :entity AND legacy_id = :legacy_id"
            ),
            {"entity": entity, "legacy_id": legacy_id},
        ).first()
    )


def mark_migrated(session: Session, entity: str, legacy_id: int, target_id: int | None) -> None:
    session.execute(
        text(
            """
            INSERT INTO legacy_migration_map(entity, legacy_id, target_id)
            VALUES (:entity, :legacy_id, :target_id)
            ON CONFLICT (entity, legacy_id)
            DO UPDATE SET target_id = EXCLUDED.target_id, migrated_at = NOW()
            """
        ),
        {"entity": entity, "legacy_id": legacy_id, "target_id": target_id},
    )


def migrate() -> None:
    if not LEGACY_DATABASE_URL:
        raise SystemExit("LEGACY_DATABASE_URL is required")

    legacy_engine = create_engine(LEGACY_DATABASE_URL, pool_pre_ping=True)
    legacy_inspector = inspect(legacy_engine)
    required = {"branches", "app_users", "daily_revenues", "expenses"}
    missing = required.difference(legacy_inspector.get_table_names())
    if missing:
        raise SystemExit(f"Legacy database is missing tables: {', '.join(sorted(missing))}")

    # Development currently uses create_all; Alembic will replace this before production cutover.
    Base.metadata.create_all(bind=target_engine)
    ensure_migration_table()

    metadata = MetaData()
    legacy_branches = Table("branches", metadata, autoload_with=legacy_engine)
    legacy_users = Table("app_users", metadata, autoload_with=legacy_engine)
    legacy_revenues = Table("daily_revenues", metadata, autoload_with=legacy_engine)
    legacy_expenses = Table("expenses", metadata, autoload_with=legacy_engine)

    report = defaultdict(int)

    with legacy_engine.connect() as source, Session(target_engine) as target:
        try:
            branch_id_map: dict[int, int] = {}
            branch_name_map: dict[str, int] = {}

            for row in source.execute(select(legacy_branches).order_by(legacy_branches.c.id)).mappings():
                branch = target.scalar(select(Branch).where(Branch.name == row["name"]))
                if branch is None:
                    branch = Branch(
                        name=row["name"],
                        active=bool(row.get("active", True)),
                    )
                    target.add(branch)
                    target.flush()
                    report["branches_created"] += 1
                else:
                    branch.active = bool(row.get("active", True))
                    report["branches_updated"] += 1

                branch_id_map[int(row["id"])] = branch.id
                branch_name_map[branch.name.strip().lower()] = branch.id
                mark_migrated(target, "branch", int(row["id"]), branch.id)

            target.flush()

            for row in source.execute(select(legacy_users).order_by(legacy_users.c.id)).mappings():
                username = clean_text(row.get("username")).strip()
                if not username:
                    report["users_skipped"] += 1
                    continue

                raw_allowed = as_list(row.get("allowed_branches"))
                allowed_ids: list[int] = []
                for item in raw_allowed:
                    item_text = str(item).strip()
                    if item_text.isdigit() and int(item_text) in branch_id_map:
                        allowed_ids.append(branch_id_map[int(item_text)])
                    else:
                        mapped = branch_name_map.get(item_text.lower())
                        if mapped:
                            allowed_ids.append(mapped)
                allowed_ids = sorted(set(allowed_ids))

                permissions = [str(item) for item in as_list(row.get("permissions"))]
                user = target.scalar(select(User).where(User.username == username))
                if user is None:
                    legacy_secret = clean_text(row.get("secret"))
                    if not legacy_secret:
                        report["users_skipped"] += 1
                        continue
                    user = User(
                        username=username,
                        password_hash=hash_password(legacy_secret),
                        role=clean_text(row.get("role")) or "Staff",
                        permissions=permissions,
                        allowed_branch_ids=allowed_ids,
                        active=bool(row.get("active", True)),
                    )
                    target.add(user)
                    target.flush()
                    report["users_created"] += 1
                else:
                    # Preserve the v2 password (especially the first Admin account), but import roles and access.
                    user.role = clean_text(row.get("role")) or user.role
                    user.permissions = permissions
                    user.allowed_branch_ids = allowed_ids
                    user.active = bool(row.get("active", True))
                    report["users_updated"] += 1

                mark_migrated(target, "user", int(row["id"]), user.id)

            for row in source.execute(select(legacy_revenues).order_by(legacy_revenues.c.id)).mappings():
                target_branch_id = branch_id_map.get(int(row["branch_id"]))
                if not target_branch_id:
                    report["revenues_skipped"] += 1
                    continue

                revenue = target.scalar(
                    select(DailyRevenue).where(
                        DailyRevenue.branch_id == target_branch_id,
                        DailyRevenue.business_date == row["business_date"],
                    )
                )
                if revenue is None:
                    revenue = DailyRevenue(
                        branch_id=target_branch_id,
                        business_date=row["business_date"],
                        amount=normalize_amount(row.get("amount")),
                        notes=clean_text(row.get("notes")),
                        approved=bool(row.get("closed", False)),
                    )
                    target.add(revenue)
                    target.flush()
                    report["revenues_created"] += 1
                else:
                    revenue.amount = normalize_amount(row.get("amount"))
                    revenue.notes = clean_text(row.get("notes"))
                    revenue.approved = bool(row.get("closed", False))
                    report["revenues_updated"] += 1

                mark_migrated(target, "daily_revenue", int(row["id"]), revenue.id)

            for row in source.execute(select(legacy_expenses).order_by(legacy_expenses.c.id)).mappings():
                legacy_id = int(row["id"])
                if was_migrated(target, "expense", legacy_id):
                    report["expenses_existing"] += 1
                    continue

                target_branch_id = branch_id_map.get(int(row["branch_id"]))
                if not target_branch_id:
                    report["expenses_skipped"] += 1
                    continue

                expense = Expense(
                    branch_id=target_branch_id,
                    business_date=row["business_date"],
                    category=clean_text(row.get("category")) or "Other Expenses",
                    amount=normalize_amount(row.get("amount")),
                    notes=clean_text(row.get("notes")),
                )
                target.add(expense)
                target.flush()
                mark_migrated(target, "expense", legacy_id, expense.id)
                report["expenses_created"] += 1

            target.commit()
        except Exception:
            target.rollback()
            raise

    completed_at = datetime.now(timezone.utc).isoformat()
    print(json.dumps({"status": "completed", "completed_at": completed_at, **report}, indent=2))


if __name__ == "__main__":
    migrate()
