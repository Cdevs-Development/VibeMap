from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
)

from app.database.database import Base


class Beneficiary(Base):
    __tablename__ = "beneficiaries"

    __table_args__ = (
        Index(
            "ix_beneficiaries_owner_status_confirmed",
            "user_id",
            "status",
            "is_confirmed",
        ),
        Index(
            "ix_beneficiaries_registered_status_confirmed",
            "registered_user_id",
            "status",
            "is_confirmed",
        ),
    )
    id = Column(
        String(36),
        primary_key=True,
    )

    # The user who created/sent the beneficiary request
    user_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=False,
    )

    # The registered VibeMap user receiving the request
    # Nullable because the phone number may not belong to an account yet
    registered_user_id = Column(
        String(36),
        ForeignKey("users.id"),
        nullable=True,
    )

    name = Column(
        String(100),
        nullable=False,
    )

    phone = Column(
        String(20),
        nullable=False,
    )

    # pending, accepted or declined
    status = Column(
        String(20),
        nullable=False,
        default="pending",
    )

    is_confirmed = Column(
        Boolean,
        nullable=False,
        default=False,
    )

    confirmation_token = Column(
        String(255),
        nullable=True,
    )

    confirmed_at = Column(
        DateTime,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        nullable=False,
    )