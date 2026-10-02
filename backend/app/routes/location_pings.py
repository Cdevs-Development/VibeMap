# =====================================================
# IMPORTS
# =====================================================

from uuid import uuid4
from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session

from app.database.connection import get_db

from app.database.models.location_ping import (
    LocationPing
)

from app.security.auth import (
    get_current_user_id
)

from typing import List
from app.schemas.location_ping_schema import (
    LocationPingCreate,
    LocationPingResponse
)

from app.services.trip_service import (
    get_trip_by_id
)

from app.services.location_ping_service import (
    get_trip_pings
)

from app.websockets.connection_manager import (
    manager
)

# =====================================================
# ROUTER
# =====================================================

router = APIRouter(
    tags=["Location Pings"]
)


# =====================================================
# CREATE LOCATION PING
# =====================================================

@router.post("/")
async def create_location_ping(
    ping: LocationPingCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):

    trip = get_trip_by_id(
        db,
        ping.trip_id
    )

    if not trip:

        raise HTTPException(
            status_code=404,
            detail="Trip not found"
        )

    if trip.user_id != user_id:

        raise HTTPException(
            status_code=403,
            detail="Not allowed"
        )

    new_ping = LocationPing(
        id=str(uuid4()),
        trip_id=ping.trip_id,
        raw_lat=ping.raw_lat,
        raw_lng=ping.raw_lng,
        smoothed_lat=ping.smoothed_lat,
        smoothed_lng=ping.smoothed_lng,
        accuracy_meters=ping.accuracy_meters,
        signal_source=ping.signal_source,
        speed_ms=ping.speed_ms,
        heading=ping.heading,
        recorded_at=datetime.utcnow()
    )

    db.add(new_ping)

    trip.current_lat = ping.smoothed_lat
    trip.current_lng = ping.smoothed_lng

    trip.last_known_lat = ping.smoothed_lat
    trip.last_known_lng = ping.smoothed_lng

    trip.last_ping_at = datetime.utcnow()

    db.commit()

    await manager.broadcast(
        trip.share_token,
        {
            "trip_id": trip.id,
            "share_token": trip.share_token,
            "lat": float(ping.smoothed_lat),
            "lng": float(ping.smoothed_lng),
            "timestamp": datetime.utcnow().isoformat()
        }
    )

    return {
        "message": "Location ping recorded"
    }


# =====================================================
# GET TRIP LOCATION HISTORY
# =====================================================

@router.get("/{trip_id}", response_model=List[LocationPingResponse])
def get_location_history(
    trip_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):

    trip = get_trip_by_id(
        db,
        trip_id
    )

    if not trip:

        raise HTTPException(
            status_code=404,
            detail="Trip not found"
        )

    if trip.user_id != user_id:

        raise HTTPException(
            status_code=403,
            detail="Not allowed"
        )

    return get_trip_pings(
        db,
        trip_id
    )