# =====================================================
# IMPORTS
# =====================================================

from uuid import uuid4
from datetime import datetime
from typing import List

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request
)

from sqlalchemy.orm import Session

from app.database.connection import get_db

from app.database.models.sos_event import (
    SOSEvent
)

from app.security.auth import (
    get_current_user_id
)

from app.security.rate_limiter import (
    limiter
)

from app.schemas.sos_event_schema import (
    SOSCreate,
    SOSResolve,
    SOSEventResponse
)

from app.services.sos_event_service import (
    get_user_sos_events,
    get_sos_event
)

from app.services.trip_service import (
    get_trip_by_id
)

from app.services.sos_service import (
    notify_beneficiaries
)

from app.services.user_service import (
    get_user_by_id
)

from app.security.hashing import (
    verify_password
)



# =====================================================
# ROUTER
# =====================================================

router = APIRouter(
    tags=["SOS"]
)


# =====================================================
# TRIGGER SOS
# =====================================================

@router.post("/")
@limiter.limit("60/minute")
def trigger_sos(
    request: Request,
    sos_request: SOSCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):

    trip = None

    triggered_lat = 0
    triggered_lng = 0

    if sos_request.trip_id:

        trip = get_trip_by_id(
            db,
            sos_request.trip_id
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

        triggered_lat = trip.last_known_lat or 0
        triggered_lng = trip.last_known_lng or 0

        trip.status = "sos_active"

    else:

        triggered_lat = sos_request.triggered_lat or 0
        triggered_lng = sos_request.triggered_lng or 0

    active_sos = get_user_sos_events(db, user_id)
    if active_sos and len(active_sos) > 0:
        raise HTTPException(
            status_code=409,
            detail='An active SOS event already exists for this user'
        )

    new_sos = SOSEvent(

        id=str(uuid4()),

        user_id=user_id,

        trip_id=sos_request.trip_id,

        triggered_lat=triggered_lat,

        triggered_lng=triggered_lng,

        status="active",

        triggered_at=datetime.utcnow(),

        resolved_at=None,

        resolution_note=None
    )

    db.add(new_sos)

    db.commit()

    db.refresh(new_sos)

    try:

        notification_results = notify_beneficiaries(
            db=db,
            user_id=user_id,
            latitude=float(triggered_lat),
            longitude=float(triggered_lng)
        )

    except Exception as e:

        notification_results = [
            {
                "success": False,
                "message": str(e)
            }
        ]

    return {
        "message": "SOS triggered",
        "sos_id": new_sos.id,
        "beneficiaries_notified": len(notification_results),
        "notification_results": notification_results
    }


# =====================================================
# GET MY SOS EVENTS
# =====================================================

@router.get("/", response_model=List[SOSEventResponse])
def get_my_sos(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):

    events = get_user_sos_events(
        db,
        user_id
    )

    return events if events is not None else []


# =====================================================
# RESOLVE SOS WITH PIN
# =====================================================

@router.post("/{sos_id}/resolve")
@limiter.limit("60/minute")
def resolve_sos(
    request: Request,
    sos_id: str,
    payload: SOSResolve,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):

    sos = get_sos_event(
        db,
        sos_id
    )

    if not sos:

        raise HTTPException(
            status_code=404,
            detail="SOS event not found"
        )

    if sos.user_id != user_id:

        raise HTTPException(
            status_code=403,
            detail="Not allowed"
        )

    if sos.status != "active":

        raise HTTPException(
            status_code=409,
            detail=f"SOS event is already {sos.status}"
        )

    user = get_user_by_id(
        db,
        user_id
    )

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if not user.sos_pin_hash:

        raise HTTPException(
            status_code=400,
            detail="Set an SOS PIN before resolving an SOS"
        )

    pin = payload.pin.strip()

    if not pin.isdigit() or len(pin) != 4:

        raise HTTPException(
            status_code=400,
            detail="SOS PIN must contain exactly 4 digits"
        )

    if not verify_password(
        pin,
        user.sos_pin_hash
    ):

        raise HTTPException(
            status_code=401,
            detail="Incorrect SOS PIN"
        )

    sos.status = "resolved"

    sos.resolution_note = (
        payload.resolution_note
    )

    sos.resolved_at = datetime.utcnow()

    if sos.trip_id:

        trip = get_trip_by_id(
            db,
            sos.trip_id
        )

        if trip:

            trip.status = "active"

    db.commit()

    return {
        "message": "SOS resolved successfully",
        "sos_id": sos.id,
        "status": sos.status
    }