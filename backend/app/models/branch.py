from sqlalchemy import Boolean, Column, Integer, String
from sqlalchemy.orm import relationship

from app.database import Base


class Branch(Base):
    __tablename__ = 'branches'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), unique=True, nullable=False)
    address = Column(String(255), nullable=True)
    active = Column(Boolean, default=True, nullable=False)

    users = relationship('User', back_populates='branch')
