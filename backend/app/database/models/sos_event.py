from sqlalchemy import (
    Column,
    String,
    DateTime,
    ForeignKey,
    Enum,
    DECIMAL,
    Text,
    Index,
)
from app.database.database import Base


class SOSEvent(Base):
    __tablename__ = "sos_events"


    __table_args__ = (
        Index(
            "ix_sos_events_user_status",
            "user_id",
            "status",
        ),
    )

    id = Column(String(36), primary_key=True)

    user_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=False
    )

    trip_id = Column(
        String(36),
        ForeignKey("trips.id"),
        nullable=True
    )

    triggered_lat = Column(DECIMAL(9, 6), nullable=False)

    triggered_lng = Column(DECIMAL(9, 6), nullable=False)

    status = Column(
        Enum(
            "active",
            "resolved",
            "cancelled",
            name="sos_status"
        ),
        nullable=False
    )

    triggered_at = Column(DateTime, nullable=False)

    acknowledged_at = Column(DateTime, nullable=True)

    acknowledging_beneficiary_name = Column(String(255), nullable=True)

    resolved_at = Column(DateTime)

    resolution_note = Column(Text)