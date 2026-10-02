# =====================================================
# IMPORTS
# =====================================================

from datetime import datetime
from pydantic import BaseModel


# =====================================================
# CREATE VIBE PIN
# =====================================================

class VibePinCreate(BaseModel):

    category: str

    lat: float

    lng: float

    note: str | None = None

    source: str = "user"


class VibePinResponse(BaseModel):
    id: str
    user_id: str
    category: str
    lat: float
    lng: float
    note: str | None = None
    confirmation_count: int
    expires_at: datetime
    is_active: bool
    source: str
    created_at: datetime
    user_confirmed: bool = False

    class Config:
        from_attributes = True