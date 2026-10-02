from sqlalchemy import Column, String, Text, Boolean, DateTime
from app.database.database import Base
from sqlalchemy.orm import relationship


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True)

    full_name = Column(String(100), nullable=False)

    email = Column(String(255), unique=True, nullable=False)

    phone = Column(String(20), unique=True, nullable=True)

    password_hash = Column(Text, nullable=True)

    sos_pin_hash = Column(Text, nullable=True)

    google_id = Column(String(255), unique=True, nullable=True)

    auth_provider = Column(String(20), default="email", nullable=False)

    avatar_url = Column(Text)

    is_verified = Column(Boolean, default=False)

    is_admin = Column(Boolean, default=False)

    is_active = Column(Boolean, default=True)

    location_sharing = Column(Boolean, default=True)

    last_known_lat = Column(String(50), nullable=True)

    last_known_lng = Column(String(50), nullable=True)

    last_location_accuracy = Column(String(50), nullable=True)

    last_location_updated_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, nullable=False)

    updated_at = Column(DateTime, nullable=False)

    # Beneficiary requests created by this user
    beneficiaries = relationship(
        "Beneficiary",
        foreign_keys="Beneficiary.user_id",
        backref="user",
    )

    # Beneficiary requests received by this user
    beneficiary_requests = relationship(
        "Beneficiary",
        foreign_keys="Beneficiary.registered_user_id",
        backref="registered_user",
    )

    trips = relationship(
        "Trip",
        backref="user"
    )

    vibe_pins = relationship(
        "VibePin",
        backref="user"
    )

    sos_events = relationship(
        "SOSEvent",
        backref="user"
    )