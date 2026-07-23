from datetime import datetime

from pydantic import BaseModel


class AuditLogView(BaseModel):
    id: int
    user_id: int | None
    username: str
    role: str
    branch_id: int | None
    action: str
    module: str
    entity_type: str
    entity_id: str
    result: str
    description: str
    before_data: dict
    after_data: dict
    request_method: str
    request_path: str
    ip_address: str
    user_agent: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AuditSummary(BaseModel):
    total_today: int
    login_events: int
    changes: int
    approvals: int
    failed: int


class AuditPage(BaseModel):
    items: list[AuditLogView]
    total: int
    page: int
    page_size: int
    summary: AuditSummary
