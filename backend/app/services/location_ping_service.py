# =====================================================
# IMPORTS
# =====================================================

from sqlalchemy.orm import Session

from app.database.models.location_ping import (
    LocationPing
)


# =====================================================
# GET PINGS FOR TRIP
# =====================================================

def get_trip_pings(
    db: Session,
    trip_id: str
):

    return (
        db.query(LocationPing)
        .filter(
            LocationPing.trip_id == trip_id
        )
        .all()
    )