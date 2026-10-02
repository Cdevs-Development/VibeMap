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

from app.database.models.trip import Trip

from app.security.auth import (
    get_current_user_id
)

from typing import List
from app.schemas.trip_schema import (
    TripCreate,
    TripResponse
)

from app.services.trip_service import (
    get_user_trips,
    get_trip_by_id,
    get_trip_by_share_token
)


# =====================================================
# ROUTER
# =====================================================

router = APIRouter(
    tags=["Trips"]
)


# =====================================================
# START TRIP
# =====================================================

@router.post("/start")
def start_trip(
    trip: TripCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):

    new_trip = Trip(

        id=str(uuid4()),

        user_id=user_id,

        origin_lat=trip.origin_lat,
        origin_lng=trip.origin_lng,

        destination_lat=trip.destination_lat,
        destination_lng=trip.destination_lng,

        destination_name=trip.destination_name,

        current_lat=trip.origin_lat,
        current_lng=trip.origin_lng,

        last_known_lat=trip.origin_lat,
        last_known_lng=trip.origin_lng,

        last_ping_at=datetime.utcnow(),

        status="active",

        started_at=datetime.utcnow(),

        ended_at=None,

        share_token=str(uuid4()).replace("-", "")
    )

    db.add(new_trip)

    db.commit()

    db.refresh(new_trip)

    return {
        "message": "Trip started successfully",
        "trip_id": new_trip.id,
        "share_token": new_trip.share_token
    }


# =====================================================
# GET MY TRIPS
# =====================================================

@router.get("/", response_model=List[TripResponse])
def get_my_trips(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):

    trips = get_user_trips(
        db,
        user_id
    )

    return trips if trips is not None else []


# =====================================================
# PUBLIC TRIP TRACKING
# =====================================================

@router.get("/public/{share_token}")
def track_trip_public(
    share_token: str,
    db: Session = Depends(get_db)
):

    trip = get_trip_by_share_token(
        db,
        share_token
    )

    if not trip:

        raise HTTPException(
            status_code=404,
            detail="Trip not found"
        )

    return {

        "destination_name":
            trip.destination_name,

        "status":
            trip.status,

        "current_lat":
            trip.current_lat,

        "current_lng":
            trip.current_lng,

        "last_ping_at":
            trip.last_ping_at,

        "started_at":
            trip.started_at
    }


# =====================================================
# GET SINGLE TRIP
# =====================================================

@router.get("/{trip_id}", response_model=TripResponse)
def get_trip(
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

    return trip


# =====================================================
# END TRIP
# =====================================================

@router.post("/{trip_id}/end")
def end_trip(
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

    trip.status = "completed"

    trip.ended_at = datetime.utcnow()

    db.commit()

    return {
        "message": "Trip completed successfully"
    }
