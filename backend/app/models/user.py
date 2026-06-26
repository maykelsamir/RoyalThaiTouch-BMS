from sqlalchemy import Boolean, Column, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(150), nullable=True)
    password_hash = Column(String, nullable=False)
    role = Column(String(30), nullable=False, default='BRANCH_MANAGER')
    branch_id = Column(Integer, ForeignKey('branches.id'), nullable=True)
    active = Column(Boolean, default=True, nullable=False)

    branch = relationship('Branch', back_populates='users')
