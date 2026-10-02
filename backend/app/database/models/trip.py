from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, DECIMAL
from app.database.database import Base


class Trip(Base):
    __tablename__ = "trips"

    id = Column(String(36), primary_key=True)

    user_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=False
    )

    origin_lat = Column(DECIMAL(9, 6), nullable=False)
    origin_lng = Column(DECIMAL(9, 6), nullable=False)

    destination_lat = Column(DECIMAL(9, 6), nullable=False)
    destination_lng = Column(DECIMAL(9, 6), nullable=False)

    destination_name = Column(String(255), nullable=False)

    current_lat = Column(DECIMAL(9, 6))
    current_lng = Column(DECIMAL(9, 6))

    last_ping_at = Column(DateTime)

    last_known_lat = Column(DECIMAL(9, 6))
    last_known_lng = Column(DECIMAL(9, 6))

    status = Column(
        Enum(
            "active",
            "completed",
            "cancelled",
            "sos_active",
            name="trip_status"
        ),
        nullable=False
    )

    started_at = Column(DateTime, nullable=False)

    ended_at = Column(DateTime)

    share_token = Column(String(64), unique=True, nullable=False)