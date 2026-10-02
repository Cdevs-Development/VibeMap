# =====================================================
# IMPORTS
# =====================================================

from uuid import uuid4
from datetime import datetime
from typing import List, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session

from app.database.connection import get_db

from app.database.models.vibe_pin import (
    VibePin
)

from app.database.models.vibe_confirmation import (
    VibeConfirmation
)

from app.security.auth import (
    get_current_user_id,
    get_optional_current_user_id
)

from app.schemas.vibe_pin_schema import (
    VibePinCreate,
    VibePinResponse
)

from app.services.vibe_pin_service import (
    find_nearby_duplicate_pin,
    get_active_vibe_pins,
    get_pin_expiry,
    get_vibe_pin,
    refresh_pin_expiration
)


# =====================================================
# ROUTER
# =====================================================

router = APIRouter(
    tags=["Vibe Pins"]
)


# =====================================================
# CREATE OR CONFIRM VIBE PIN
# =====================================================

@router.post("")
@router.post("/")
def create_vibe_pin(
    pin: VibePinCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id)
):

    nearby_duplicate = find_nearby_duplicate_pin(
        db=db,
        category=pin.category,
        latitude=float(pin.lat),
        longitude=float(pin.lng)
    )

    if nearby_duplicate:
        # Check if user already confirmed this duplicate
        existing_conf = db.query(VibeConfirmation).filter(
            VibeConfirmation.vibe_pin_id == nearby_duplicate.id,
            VibeConfirmation.user_id == user_id
        ).first()

        if not existing_conf:
            db.add(VibeConfirmation(
                id=str(uuid4()),
                vibe_pin_id=nearby_duplicate.id,
                user_id=user_id,
                created_at=datetime.utcnow()
            ))
            db.commit()
            conf_count = db.query(VibeConfirmation).filter(
                VibeConfirmation.vibe_pin_id == nearby_duplicate.id
            ).count()
            nearby_duplicate.confirmation_count = max(1, conf_count)
            refresh_pin_expiration(nearby_duplicate)
            db.commit()

        return {
            "message": "Nearby vibe pin confirmed",
            "pin_id": nearby_duplicate.id,
            "confirmation_count":
                nearby_duplicate.confirmation_count,
            "expires_at":
                nearby_duplicate.expires_at,
            "duplicate_merged": True
        }

    current_time = datetime.utcnow()

    new_pin = VibePin(
        id=str(uuid4()),
        user_id=user_id,
        category=pin.category,
        lat=pin.lat,
        lng=pin.lng,
        note=pin.note,
        confirmation_count=1,
        expires_at=get_pin_expiry(
            pin.category
        ),
        is_active=True,
        source=pin.source,
        created_at=current_time
    )

    db.add(new_pin)
    db.commit()
    db.refresh(new_pin)

    # Automatically register creator's confirmation
    new_confirmation = VibeConfirmation(
        id=str(uuid4()),
        vibe_pin_id=new_pin.id,
        user_id=user_id,
        created_at=current_time
    )
    db.add(new_confirmation)
    db.commit()

    return {
        "message": "Vibe pin created",
        "pin_id": new_pin.id,
        "confirmation_count":
            new_pin.confirmation_count,
        "expires_at": new_pin.expires_at,
        "duplicate_merged": False
    }


# =====================================================
# GET ACTIVE PUBLIC VIBE PINS
# =====================================================

@router.get(
    "",
    response_model=List[VibePinResponse]
)
@router.get(
    "/",
    response_model=List[VibePinResponse]
)
def get_all_vibe_pins(
    db: Session = Depends(get_db),
    user_id: Optional[str] = Depends(get_optional_current_user_id)
):

    pins = get_active_vibe_pins(
        db
    ) or []

    if not user_id:
        return pins

    # Retrieve all pin IDs confirmed by this user
    user_conf_ids = {
        c.vibe_pin_id for c in db.query(VibeConfirmation.vibe_pin_id).filter(
            VibeConfirmation.user_id == user_id
        ).all()
    }

    result = []
    for p in pins:
        # Build response with user_confirmed status
        resp = VibePinResponse(
            id=p.id,
            user_id=p.user_id,
            category=p.category,
            lat=float(p.lat),
            lng=float(p.lng),
            note=p.note,
            confirmation_count=p.confirmation_count,
            expires_at=p.expires_at,
            is_active=p.is_active,
            source=p.source,
            created_at=p.created_at,
            user_confirmed=(p.id in user_conf_ids or p.user_id == user_id)
        )
        result.append(resp)

    return result


# =====================================================
# CONFIRM VIBE PIN
# =====================================================

@router.post("/{pin_id}/confirm")
def confirm_vibe_pin(
    pin_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(
        get_current_user_id
    )
):

    pin = get_vibe_pin(
        db,
        pin_id
    )

    if not pin:
        raise HTTPException(
            status_code=404,
            detail="Vibe pin not found"
        )

    if not pin.is_active:
        raise HTTPException(
            status_code=400,
            detail="Vibe pin is inactive"
        )

    existing_conf = db.query(VibeConfirmation).filter(
        VibeConfirmation.vibe_pin_id == pin.id,
        VibeConfirmation.user_id == user_id
    ).first()

    if existing_conf:
        # If user already confirmed and is not the creator, toggle/remove confirmation
        if pin.user_id != user_id:
            db.delete(existing_conf)
            db.commit()
            conf_count = db.query(VibeConfirmation).filter(
                VibeConfirmation.vibe_pin_id == pin.id
            ).count()
            pin.confirmation_count = max(1, conf_count)
            db.commit()
            return {
                "message": "Confirmation removed",
                "confirmed": False,
                "confirmation_count": pin.confirmation_count,
                "expires_at": pin.expires_at
            }
        else:
            return {
                "message": "You created this vibe report",
                "confirmed": True,
                "confirmation_count": pin.confirmation_count,
                "expires_at": pin.expires_at
            }

    # Add confirmation
    db.add(VibeConfirmation(
        id=str(uuid4()),
        vibe_pin_id=pin.id,
        user_id=user_id,
        created_at=datetime.utcnow()
    ))
    db.commit()

    conf_count = db.query(VibeConfirmation).filter(
        VibeConfirmation.vibe_pin_id == pin.id
    ).count()
    pin.confirmation_count = max(1, conf_count)
    refresh_pin_expiration(pin)
    db.commit()

    return {
        "message": "Vibe pin confirmed",
        "confirmed": True,
        "confirmation_count": pin.confirmation_count,
        "expires_at": pin.expires_at
    }


# =====================================================
# DELETE VIBE PIN
# =====================================================

@router.delete("/{pin_id}")
def delete_vibe_pin(
    pin_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(
        get_current_user_id
    )
):

    pin = get_vibe_pin(
        db,
        pin_id
    )

    if not pin:
        raise HTTPException(
            status_code=404,
            detail="Vibe pin not found"
        )

    if pin.user_id != user_id:
        raise HTTPException(
            status_code=403,
            detail="Not allowed"
        )

    pin.is_active = False

    # Delete all associated confirmations
    try:
        db.query(VibeConfirmation).filter(
            VibeConfirmation.vibe_pin_id == pin.id
        ).delete(synchronize_session=False)
    except Exception:
        pass

    db.commit()

    return {
        "message": "Vibe pin deactivated"
    }