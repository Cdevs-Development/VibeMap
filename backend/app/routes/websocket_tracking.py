# =====================================================
# IMPORTS
# =====================================================

from fastapi import (
    APIRouter,
    WebSocket,
    WebSocketDisconnect
)

from app.database.database import (
    SessionLocal
)

from app.database.models.beneficiary import (
    Beneficiary
)

from app.database.models.trip import (
    Trip
)

from app.database.models.user import (
    User
)

from app.security.auth import (
    decode_access_token
)

from app.websockets.connection_manager import (
    manager
)


# =====================================================
# ROUTER
# =====================================================

router = APIRouter()


# =====================================================
# CHECK AUTHENTICATED VIEWER ACCESS
# =====================================================

def user_can_view_trip(
    db,
    user: User,
    trip: Trip
) -> bool:

    # Trip owner always has access
    if trip.user_id == user.id:

        return True

    confirmed_beneficiary = (
        db.query(Beneficiary)
        .filter(
            Beneficiary.user_id == trip.user_id,
            Beneficiary.registered_user_id == user.id,
            Beneficiary.status == "accepted",
            Beneficiary.is_confirmed == True,
        )
        .first()
    )

    return confirmed_beneficiary is not None


# =====================================================
# LIVE TRIP TRACKING
# =====================================================

@router.websocket(
    "/ws/trips/{share_token}"
)
async def trip_tracking_socket(
    websocket: WebSocket,
    share_token: str
):

    db = SessionLocal()

    connected = False

    try:

        trip = (

            db.query(Trip)

            .filter(
                Trip.share_token == share_token
            )

            .first()
        )

        if not trip:

            await websocket.close(
                code=4004,
                reason="Trip not found"
            )

            return

        token = websocket.query_params.get(
            "token"
        )

        # A supplied token must be valid and authorized.
        if token:

            try:

                user_id = decode_access_token(
                    token
                )

            except ValueError:

                await websocket.close(
                    code=4001,
                    reason="Invalid or expired token"
                )

                return

            user = (

                db.query(User)

                .filter(
                    User.id == user_id,
                    User.is_active == True
                )

                .first()
            )

            if not user:

                await websocket.close(
                    code=4001,
                    reason="User not found or inactive"
                )

                return

            if not user_can_view_trip(
                db,
                user,
                trip
            ):

                await websocket.close(
                    code=4003,
                    reason="Not authorized to view this trip"
                )

                return

        # No token means a public, read-only share-link viewer.
        # The long random share_token acts as the access capability.
        await manager.connect(
            share_token,
            websocket
        )

        connected = True

        while True:

            # Keeps the socket alive.
            # Incoming client messages are ignored.
            await websocket.receive_text()

    except WebSocketDisconnect:

        pass

    finally:

        if connected:

            manager.disconnect(
                share_token,
                websocket
            )

        db.close()