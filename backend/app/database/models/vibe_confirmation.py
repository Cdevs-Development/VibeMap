from sqlalchemy import Column, String, DateTime, ForeignKey, UniqueConstraint
from app.database.database import Base


class VibeConfirmation(Base):
    __tablename__ = "vibe_confirmations"

    id = Column(String(36), primary_key=True)

    vibe_pin_id = Column(
        String(36),
        ForeignKey("vibe_pins.id", ondelete="CASCADE"),
        nullable=False
    )

    user_id = Column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False
    )

    created_at = Column(DateTime, nullable=False)

    __table_args__ = (
        UniqueConstraint("vibe_pin_id", "user_id", name="uq_vibe_pin_user_confirmation"),
    )
