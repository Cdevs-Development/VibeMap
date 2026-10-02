from sqlalchemy import (
    Column,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey
)

from app.database.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(
        String(36),
        primary_key=True
    )

    user_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=False
    )

    notification_type = Column(
        String(50),
        nullable=False
    )

    title = Column(
        String(255),
        nullable=False
    )

    message = Column(
        Text,
        nullable=False
    )

    related_entity_id = Column(
        String(36),
        nullable=True
    )

    is_read = Column(
        Boolean,
        default=False,
        nullable=False
    )

    created_at = Column(
        DateTime,
        nullable=False
    )