import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime
from app.database.connection import Base

class LegalDocument(Base):
    __tablename__ = "legal_documents"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    doc_type = Column(String(50), unique=True, nullable=False, index=True) # terms_of_service, privacy_policy
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    version = Column(String(20), default="1.0", nullable=False)
    updated_by = Column(String(255), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    def __repr__(self):
        return f"<LegalDocument {self.doc_type} v{self.version}>"
