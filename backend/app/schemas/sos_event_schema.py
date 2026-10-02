# =====================================================
# IMPORTS
# =====================================================

from pydantic import BaseModel


# =====================================================
# TRIGGER SOS
# =====================================================

from datetime import datetime

class SOSCreate(BaseModel):

    trip_id: str | None = None
    triggered_lat: float | None = None
    triggered_lng: float | None = None


# =====================================================
# RESOLVE SOS
# =====================================================

class SOSResolve(BaseModel):
    pin: str
    resolution_note: str | None = None

class SOSEventResponse(BaseModel):
    id: str
    user_id: str
    trip_id: str | None = None
    triggered_lat: float
    triggered_lng: float
    status: str
    triggered_at: datetime
    resolved_at: datetime | None = None
    resolution_note: str | None = None

    class Config:
        from_attributes = True