from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, DECIMAL, Integer
from app.database.database import Base


class LocationPing(Base):
    __tablename__ = "location_pings"

    id = Column(String(36), primary_key=True)

    trip_id = Column(
        String(36),
        ForeignKey("trips.id"),
        nullable=False
    )

    raw_lat = Column(DECIMAL(9, 6), nullable=False)
    raw_lng = Column(DECIMAL(9, 6), nullable=False)

    smoothed_lat = Column(DECIMAL(9, 6), nullable=False)
    smoothed_lng = Column(DECIMAL(9, 6), nullable=False)

    accuracy_meters = Column(Integer, nullable=False)

    signal_source = Column(
        Enum(
            "gps",
            "network",
            "wifi",
            "unknown",
            name="signal_source"
        )
    )

    speed_ms = Column(DECIMAL(6, 2))

    heading = Column(DECIMAL(6, 2))

    recorded_at = Column(DateTime, nullable=False)