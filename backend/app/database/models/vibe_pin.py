from sqlalchemy import Column, String, DateTime, ForeignKey, Enum, DECIMAL, Integer, Boolean, Text
from app.database.database import Base


class VibePin(Base):
    __tablename__ = "vibe_pins"

    id = Column(String(36), primary_key=True)

    user_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=False
    )

    category = Column(
        Enum(
            "party",
            "wedding",
            "construction",
            "unsafe",
            "market",
            "traffic",
            name="vibe_category"
        ),
        nullable=False
    )

    lat = Column(DECIMAL(9, 6), nullable=False)
    lng = Column(DECIMAL(9, 6), nullable=False)

    note = Column(Text)

    confirmation_count = Column(Integer, default=1)

    expires_at = Column(DateTime, nullable=False)

    is_active = Column(Boolean, default=True)

    source = Column(
        Enum(
            "user",
            "instagram",
            "twitter",
            "organiser",
            name="vibe_source"
        ),
        nullable=False
    )

    created_at = Column(DateTime, nullable=False)