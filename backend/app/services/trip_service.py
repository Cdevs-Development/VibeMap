# =====================================================
# IMPORTS
# =====================================================

from sqlalchemy.orm import Session

from app.database.models.trip import Trip


# =====================================================
# GET USER TRIPS
# =====================================================

def get_user_trips(
    db: Session,
    user_id: str
):

    return (
        db.query(Trip)
        .filter(Trip.user_id == user_id)
        .all()
    )


# =====================================================
# GET TRIP BY ID
# =====================================================

def get_trip_by_id(
    db: Session,
    trip_id: str
):

    return (
        db.query(Trip)
        .filter(Trip.id == trip_id)
        .first()
    )

# =====================================================
# GET TRIP BY SHARE TOKEN
# =====================================================

def get_trip_by_share_token(
    db: Session,
    share_token: str
):

    return (
        db.query(Trip)
        .filter(
            Trip.share_token == share_token
        )
        .first()
    )