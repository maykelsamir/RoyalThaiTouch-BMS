import re

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.finance import Branch
from app.models.hr import Employee
from app.models.user import User
from app.schemas.hr import EmployeeView, EmployeeWrite

router = APIRouter(prefix="/hr", tags=["hr"])


def _require(user: User, permission: str) -> None:
    if user.role.lower() != "admin" and permission not in (user.permissions or []):
        raise HTTPException(status_code=403, detail="HR permission required")


def _code(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "-", value.strip().upper()).strip("-")
    return cleaned[:30] or "EMP"


def _unique_code(db: Session, preferred: str, exclude_id: int | None = None) -> str:
    base = _code(preferred)
    value = base
    counter = 2
    while True:
        query = select(Employee).where(func.lower(Employee.employee_code) == value.lower())
        if exclude_id is not None:
            query = query.where(Employee.id != exclude_id)
        if not db.scalar(query):
            return value
        value = f"{base[:25]}-{counter}"
        counter += 1


def _view(employee: Employee, branch_name: str = "") -> EmployeeView:
    return EmployeeView(
        id=employee.id,
        employee_code=employee.employee_code,
        full_name=employee.full_name,
        gender=employee.gender,
        birth_date=employee.birth_date,
        nationality=employee.nationality,
        phone=employee.phone,
        email=employee.email,
        address=employee.address,
        branch_id=employee.branch_id,
        branch_name=branch_name,
        department=employee.department,
        job_title=employee.job_title,
        manager_name=employee.manager_name,
        hire_date=employee.hire_date,
        contract_type=employee.contract_type,
        salary=float(employee.salary or 0),
        status=employee.status,
        photo=employee.photo,
        notes=employee.notes,
        active=employee.active,
        created_at=employee.created_at,
        updated_at=employee.updated_at,
    )


@router.get("/dashboard")
def dashboard(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "hr.view")
    rows = list(db.scalars(select(Employee)))
    departments = len({item.department.strip().lower() for item in rows if item.department.strip()})
    total_salary = sum(float(item.salary or 0) for item in rows if item.active)
    return {
        "total": len(rows),
        "active": sum(1 for item in rows if item.active and item.status.lower() == "active"),
        "on_leave": sum(1 for item in rows if item.status.lower() in {"vacation", "on leave"}),
        "inactive": sum(1 for item in rows if not item.active or item.status.lower() in {"resigned", "suspended", "terminated"}),
        "departments": departments,
        "monthly_payroll": total_salary,
    }


@router.get("/employees", response_model=list[EmployeeView])
def list_employees(q: str = "", branch_id: int | None = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "hr.view")
    query = select(Employee).order_by(Employee.active.desc(), Employee.full_name)
    if branch_id:
        query = query.where(Employee.branch_id == branch_id)
    if q.strip():
        term = f"%{q.strip()}%"
        query = query.where(or_(Employee.full_name.ilike(term), Employee.employee_code.ilike(term), Employee.job_title.ilike(term), Employee.department.ilike(term)))
    branches = {item.id: item.name for item in db.scalars(select(Branch))}
    return [_view(item, branches.get(item.branch_id, "")) for item in db.scalars(query)]


@router.get("/employees/{employee_id}", response_model=EmployeeView)
def get_employee(employee_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "hr.view")
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    branch = db.get(Branch, employee.branch_id) if employee.branch_id else None
    return _view(employee, branch.name if branch else "")


@router.post("/employees", response_model=EmployeeView, status_code=status.HTTP_201_CREATED)
def create_employee(body: EmployeeWrite, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "hr.create")
    values = body.model_dump()
    values["full_name"] = body.full_name.strip()
    values["employee_code"] = _unique_code(db, body.employee_code or body.full_name)
    employee = Employee(**values)
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return get_employee(employee.id, current_user, db)


@router.put("/employees/{employee_id}", response_model=EmployeeView)
def update_employee(employee_id: int, body: EmployeeWrite, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "hr.edit")
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    values = body.model_dump()
    values["full_name"] = body.full_name.strip()
    values["employee_code"] = _unique_code(db, body.employee_code or body.full_name, employee_id)
    for field, value in values.items():
        setattr(employee, field, value)
    db.commit()
    db.refresh(employee)
    return get_employee(employee.id, current_user, db)


@router.patch("/employees/{employee_id}/status", response_model=EmployeeView)
def toggle_employee(employee_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "hr.edit")
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    employee.active = not employee.active
    if not employee.active and employee.status == "Active":
        employee.status = "Suspended"
    elif employee.active and employee.status == "Suspended":
        employee.status = "Active"
    db.commit()
    db.refresh(employee)
    return get_employee(employee.id, current_user, db)


@router.delete("/employees/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_employee(employee_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _require(current_user, "hr.delete")
    employee = db.get(Employee, employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    db.delete(employee)
    db.commit()
