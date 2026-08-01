from decimal import Decimal

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.finance import MonthlyExpense


def effective_expenses(
    db: Session,
    branch_ids: list[int],
    periods: list[tuple[int, int]],
) -> dict[tuple[int, int, int], MonthlyExpense | None]:
    """Return the latest saved expense effective for every branch and month.

    A saved rate remains effective in later months until an administrator saves a
    newer rate. No database rows are copied automatically, so historical records
    remain unchanged and the inherited source is always traceable.
    """
    if not branch_ids or not periods:
        return {}

    ordered_periods = sorted(set(periods))
    max_year, max_month = ordered_periods[-1]
    rows = list(
        db.scalars(
            select(MonthlyExpense)
            .where(
                MonthlyExpense.branch_id.in_(branch_ids),
                or_(
                    MonthlyExpense.year < max_year,
                    (MonthlyExpense.year == max_year) & (MonthlyExpense.month <= max_month),
                ),
            )
            .order_by(MonthlyExpense.branch_id, MonthlyExpense.year, MonthlyExpense.month)
        )
    )

    rows_by_branch: dict[int, list[MonthlyExpense]] = {branch_id: [] for branch_id in branch_ids}
    for row in rows:
        rows_by_branch.setdefault(row.branch_id, []).append(row)

    result: dict[tuple[int, int, int], MonthlyExpense | None] = {}
    for branch_id in branch_ids:
        branch_rows = rows_by_branch.get(branch_id, [])
        row_index = 0
        current: MonthlyExpense | None = None
        for year, month in ordered_periods:
            while row_index < len(branch_rows) and (branch_rows[row_index].year, branch_rows[row_index].month) <= (year, month):
                current = branch_rows[row_index]
                row_index += 1
            result[(branch_id, year, month)] = current
    return result


def effective_amounts(
    db: Session,
    branch_ids: list[int],
    periods: list[tuple[int, int]],
) -> dict[tuple[int, int, int], Decimal]:
    return {
        key: Decimal(item.amount or 0) if item is not None else Decimal(0)
        for key, item in effective_expenses(db, branch_ids, periods).items()
    }
