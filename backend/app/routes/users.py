# =====================================================
# IMPORTS
# =====================================================

from typing import List

from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session

from app.database.connection import get_db

from app.database.models.user import User

from app.schemas.watched_user_schema import (
    WatchedUserResponse
)

from app.security.auth import (
    get_current_user_id
)

from app.services.user_service import (
    get_user_by_id
)

from app.services.watched_user_service import (
    get_users_watching_current_user
)


# =====================================================
# ROUTER
# =====================================================

router = APIRouter(
    tags=["Users"]
)


# =====================================================
# GET USERS I WATCH
# =====================================================

@router.get(
    "/my-watched",
    response_model=List[WatchedUserResponse]
)
def get_my_watched_users(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):

    current_user = get_user_by_id(
        db,
        user_id
    )

    if not current_user:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return get_users_watching_current_user(
        db,
        current_user
    )


# =====================================================
# UPDATE MY LOCATION (STANDALONE / OUTSIDE TRIPS)
# =====================================================

from app.schemas.user_schema import UserLocationUpdate
from datetime import datetime

@router.put("/me/location")
def update_my_location(
    loc_data: UserLocationUpdate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    current_user = get_user_by_id(db, user_id)
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    lat_val = loc_data.lat if loc_data.lat is not None else loc_data.latitude
    lng_val = loc_data.lng if loc_data.lng is not None else loc_data.longitude

    if lat_val is not None:
        current_user.last_known_lat = str(lat_val)
    if lng_val is not None:
        current_user.last_known_lng = str(lng_val)
    if loc_data.accuracy is not None:
        current_user.last_location_accuracy = str(loc_data.accuracy)

    current_user.last_location_updated_at = datetime.utcnow()
    db.commit()

    return {
        "message": "Location updated successfully",
        "lat": current_user.last_known_lat,
        "lng": current_user.last_known_lng,
        "updated_at": current_user.last_location_updated_at
    }


# =====================================================
# UPLOAD AVATAR
# =====================================================

import base64
from datetime import datetime
from fastapi import File, UploadFile, Body
from pydantic import BaseModel
from typing import Optional

class AvatarUploadPayload(BaseModel):
    avatar_url: Optional[str] = None
    data_url: Optional[str] = None
    image_base64: Optional[str] = None

@router.post("/me/avatar")
async def upload_avatar(
    file: Optional[UploadFile] = File(None),
    payload: Optional[AvatarUploadPayload] = Body(None),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    current_user = get_user_by_id(db, user_id)
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")

    data_url = None

    if file is not None:
        contents = await file.read()
        if len(contents) > 10 * 1024 * 1024:  # 10MB max
            raise HTTPException(status_code=400, detail="Image size exceeds limit")

        content_type = file.content_type or "image/jpeg"
        encoded_image = base64.b64encode(contents).decode("utf-8")
        data_url = f"data:{content_type};base64,{encoded_image}"
    elif payload is not None:
        raw = payload.avatar_url or payload.data_url or payload.image_base64
        if raw:
            if raw.startswith("data:image/") or raw.startswith("http://") or raw.startswith("https://"):
                data_url = raw
            else:
                data_url = f"data:image/jpeg;base64,{raw}"

    if not data_url:
        raise HTTPException(status_code=400, detail="No valid image data provided")

    current_user.avatar_url = data_url
    current_user.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(current_user)

    return {
        "message": "Avatar uploaded successfully",
        "avatar_url": current_user.avatar_url
    }

from app.services.account_service import delete_user_account

@router.delete("/me")
def delete_user_account_endpoint(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    current_user = get_user_by_id(db, user_id)
    if not current_user:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        delete_user_account(db, current_user)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Account deletion failed: {str(e)}")
    return {"message": "Account deleted permanently"}
