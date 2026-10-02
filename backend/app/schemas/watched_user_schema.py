from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class WatchedUserResponse(BaseModel):
    id: str
    full_name: str
    name: Optional[str] = None
    custom_name: Optional[str] = None
    account_name: Optional[str] = None
    phone: str
    avatar_url: Optional[str] = None

    last_lat: Optional[float] = None
    last_lng: Optional[float] = None
    last_seen_at: Optional[datetime] = None

    is_sharing_location: bool
    is_online: Optional[bool] = False
    sos_active: bool
    sos_id: Optional[str] = None