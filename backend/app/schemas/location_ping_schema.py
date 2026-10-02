# =====================================================
# IMPORTS
# =====================================================

from datetime import datetime
from pydantic import BaseModel


# =====================================================
# LOCATION PING REQUEST
# =====================================================

class LocationPingCreate(BaseModel):

    trip_id: str

    raw_lat: float

    raw_lng: float

    smoothed_lat: float

    smoothed_lng: float

    accuracy_meters: int

    signal_source: str

    speed_ms: float | None = None

    heading: float | None = None


class LocationPingResponse(BaseModel):
    id: str
    trip_id: str
    raw_lat: float
    raw_lng: float
    smoothed_lat: float
    smoothed_lng: float
    accuracy_meters: int
    signal_source: str
    speed_ms: float | None = None
    heading: float | None = None
    recorded_at: datetime

    class Config:
        from_attributes = True