# =====================================================
# IMPORTS
# =====================================================

from datetime import datetime
from pydantic import BaseModel


# =====================================================
# START TRIP REQUEST
# =====================================================

class TripCreate(BaseModel):

    origin_lat: float

    origin_lng: float

    destination_lat: float

    destination_lng: float

    destination_name: str


# =====================================================
# END TRIP REQUEST
# =====================================================

class TripEnd(BaseModel):

    status: str = "completed"


class TripResponse(BaseModel):
    id: str
    user_id: str
    origin_lat: float
    origin_lng: float
    destination_lat: float
    destination_lng: float
    destination_name: str
    current_lat: float | None = None
    current_lng: float | None = None
    last_ping_at: datetime | None = None
    last_known_lat: float | None = None
    last_known_lng: float | None = None
    status: str
    started_at: datetime
    ended_at: datetime | None = None
    share_token: str

    class Config:
        from_attributes = True