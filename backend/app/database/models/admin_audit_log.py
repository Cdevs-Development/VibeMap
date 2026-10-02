import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime
from app.database.connection import Base

class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    admin_id = Column(String(36), nullable=False, index=True)
    admin_email = Column(String(255), nullable=False)
    admin_name = Column(String(100), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    target_id = Column(String(36), nullable=True, index=True)
    target_type = Column(String(50), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    def __repr__(self):
        return f"<AdminAuditLog {self.action} by {self.admin_email} at {self.created_at}>"
