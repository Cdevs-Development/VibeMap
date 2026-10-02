# =====================================================
# IMPORTS
# =====================================================

from datetime import datetime, timedelta, timezone
from math import (
    atan2,
    cos,
    radians,
    sin,
    sqrt
)

from sqlalchemy.orm import Session

from app.database.models.vibe_pin import (
    VibePin
)


# =====================================================
# CONSTANTS
# =====================================================

EARTH_RADIUS_METERS = 6_371_000

DUPLICATE_RADIUS_METERS = 50

CATEGORY_EXPIRY_HOURS = {
    "traffic": 2,
    "unsafe": 24,
    "construction": 12,
    "market": 24,
    "party": 12,
    "wedding": 48
}


# =====================================================
# CURRENT UTC TIME
# =====================================================

def utc_now() -> datetime:

    return datetime.now(
        timezone.utc
    ).replace(
        tzinfo=None
    )


# =====================================================
# CATEGORY EXPIRY
# =====================================================

def get_pin_expiry(
    category: str
) -> datetime:

    expiry_hours = CATEGORY_EXPIRY_HOURS.get(
        category,
        24
    )

    return utc_now() + timedelta(
        hours=expiry_hours
    )


# =====================================================
# DISTANCE BETWEEN TWO COORDINATES
# =====================================================

def calculate_distance_meters(
    lat_1: float,
    lng_1: float,
    lat_2: float,
    lng_2: float
) -> float:

    latitude_1 = radians(lat_1)
    latitude_2 = radians(lat_2)

    latitude_difference = radians(
        lat_2 - lat_1
    )

    longitude_difference = radians(
        lng_2 - lng_1
    )

    haversine_value = (
        sin(latitude_difference / 2) ** 2
        + cos(latitude_1)
        * cos(latitude_2)
        * sin(longitude_difference / 2) ** 2
    )

    angular_distance = 2 * atan2(
        sqrt(haversine_value),
        sqrt(1 - haversine_value)
    )

    return (
        EARTH_RADIUS_METERS
        * angular_distance
    )


# =====================================================
# FIND NEARBY DUPLICATE PIN
# =====================================================

def find_nearby_duplicate_pin(
    db: Session,
    category: str,
    latitude: float,
    longitude: float
):

    active_category_pins = (
        db.query(VibePin)
        .filter(
            VibePin.category == category,
            VibePin.is_active == True,
            VibePin.expires_at > utc_now()
        )
        .all()
    )

    for existing_pin in active_category_pins:

        distance = calculate_distance_meters(
            latitude,
            longitude,
            float(existing_pin.lat),
            float(existing_pin.lng)
        )

        if distance <= DUPLICATE_RADIUS_METERS:

            return existing_pin

    return None


# =====================================================
# REFRESH PIN EXPIRATION
# =====================================================

def refresh_pin_expiration(
    pin: VibePin
) -> None:

    pin.expires_at = get_pin_expiry(
        pin.category
    )


# =====================================================
# GET ACTIVE PUBLIC VIBE PINS
# =====================================================

def get_active_vibe_pins(
    db: Session
):

    return (
        db.query(VibePin)
        .filter(
            VibePin.is_active == True,
            VibePin.expires_at > utc_now()
        )
        .order_by(
            VibePin.created_at.desc()
        )
        .all()
    )


# =====================================================
# GET VIBE PIN
# =====================================================

def get_vibe_pin(
    db: Session,
    pin_id: str
):

    return (
        db.query(VibePin)
        .filter(
            VibePin.id == pin_id
        )
        .first()
    )