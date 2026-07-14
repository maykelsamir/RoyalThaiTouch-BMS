from app.main import AppUser, Branch, Employee, app, get_db
from app.system_health import create_system_health_router


app.include_router(
    create_system_health_router(
        get_db=get_db,
        app_user_model=AppUser,
        branch_model=Branch,
        employee_model=Employee,
    )
)
