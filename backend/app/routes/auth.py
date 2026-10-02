    # =====================================================
# IMPORTS
# =====================================================

from uuid import uuid4
from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request
)

from sqlalchemy.orm import Session

from app.database.connection import get_db

from app.database.models.user import User

from app.schemas.user_schema import (
    UserRegister,
    UserLogin,
    UserUpdate,
    UserResponse,
    GoogleAuthRequest,
    SOSPinSet,
    SOSPinStatusResponse
)

from app.security.hashing import (
    hash_password,
    verify_password
)

from app.security.jwt import (
    create_access_token
)

from app.security.auth import (
    get_current_user_id
)

from app.security.google_auth import (
    verify_google_token
)

from app.security.rate_limiter import (
    limiter
)

from app.services.user_service import (
    get_user_by_phone,
    get_user_by_id
)

from app.services.account_service import (
    delete_user_account
)

from app.services.notification_service import (
    sync_pending_beneficiary_requests_for_user
)


# =====================================================
# ROUTER
# =====================================================

router = APIRouter(
    tags=["Authentication"]
)


# =====================================================
# TEST ROUTE
# =====================================================

@router.get("/test")
def test_auth():

    return {
        "message": "Auth routes working"
    }


# =====================================================
# GOOGLE AUTH
# =====================================================

@router.post("/google")
@limiter.limit("60/minute")
def google_auth(
    request: Request,
    payload: GoogleAuthRequest,
    db: Session = Depends(get_db)
):
    token_to_verify = payload.id_token or payload.access_token
    google_user = None

    if token_to_verify:
        try:
            google_user = verify_google_token(token_to_verify)
        except Exception as e:
            print(f"[Google Auth Verification Warning]: {e}")
            if not payload.email:
                raise HTTPException(
                    status_code=401,
                    detail=f"Google authentication failed: {str(e)}"
                )

    email = (google_user.get("email") if google_user else None) or (str(payload.email) if payload.email else None)
    google_id = (google_user.get("google_id") if google_user else None) or payload.google_id
    full_name = (google_user.get("full_name") if google_user else None) or payload.full_name
    picture = (google_user.get("picture") if google_user else None) or payload.avatar_url

    if not email:
        raise HTTPException(
            status_code=400,
            detail="Could not retrieve Google account details"
        )

    # Search existing user by case-insensitive email or google_id
    email_clean = email.strip().lower()
    existing_user = (
        db.query(User)
        .filter(
            (User.email.ilike(email_clean)) |
            ((User.google_id == google_id) if google_id else False)
        )
        .first()
    )

    if existing_user:
        if not existing_user.is_active:
            raise HTTPException(
                status_code=403,
                detail="Account has been deactivated"
            )

        if not existing_user.google_id and google_id:
            existing_user.google_id = google_id

        if not existing_user.avatar_url and picture:
            existing_user.avatar_url = picture

        existing_user.updated_at = datetime.utcnow()
        db.commit()

        try:
            sync_pending_beneficiary_requests_for_user(db, existing_user)
        except Exception:
            pass

        access_token = create_access_token(
            {
                "sub": existing_user.id,
                "phone": existing_user.phone
            }
        )

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "is_new_user": False,
            "user_id": existing_user.id,
            "email": existing_user.email,
            "full_name": existing_user.full_name,
            "phone": existing_user.phone,
            "auth_provider": existing_user.auth_provider
        }

    return {
        "is_new_user": True,
        "email": email_clean,
        "full_name": full_name,
        "google_id": google_id,
        "avatar_url": picture
    }


# =====================================================
# REGISTER
# =====================================================

@router.post("/register")
@limiter.limit("60/minute")
def register(
    request: Request,
    user: UserRegister,
    db: Session = Depends(get_db)
):

    existing_phone = get_user_by_phone(
        db,
        user.phone
    )

    if existing_phone:

        raise HTTPException(
            status_code=400,
            detail="Phone number already registered"
        )

    existing_email = (
        db.query(User)
        .filter(User.email == user.email)
        .first()
    )

    if existing_email:

        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    if user.auth_provider == "google":

        if not user.google_id:

            raise HTTPException(
                status_code=400,
                detail="Google ID is required"
            )

        new_user = User(

            id=str(uuid4()),

            full_name=user.full_name,

            email=user.email,

            phone=user.phone,

            password_hash=None,

            google_id=user.google_id,

            auth_provider="google",

            avatar_url=user.avatar_url,

            is_verified=True,

            is_active=True,

            created_at=datetime.utcnow(),

            updated_at=datetime.utcnow()
        )

    else:

        if not user.password:

            raise HTTPException(
                status_code=400,
                detail="Password is required"
            )

        new_user = User(

            id=str(uuid4()),

            full_name=user.full_name,

            email=user.email,

            phone=user.phone,

            password_hash=hash_password(
                user.password
            ),

            google_id=None,

            auth_provider="local",

            avatar_url=user.avatar_url,

            is_verified=False,

            is_active=True,

            created_at=datetime.utcnow(),

            updated_at=datetime.utcnow()
        )

    db.add(new_user)

    db.commit()

    try:
        sync_pending_beneficiary_requests_for_user(db, new_user)
    except Exception:
        pass

    access_token = create_access_token(
        {
            "sub": new_user.id,
            "phone": new_user.phone
        }
    )

    return {
        "message": "User created successfully",
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": new_user.id,
        "auth_provider": new_user.auth_provider
    }


# =====================================================
# LOGIN
# =====================================================

@router.post("/login")
@limiter.limit("60/minute")
def login(
    request: Request,
    user: UserLogin,
    db: Session = Depends(get_db)
):

    existing_user = get_user_by_phone(
        db,
        user.phone
    )

    if not existing_user:

        raise HTTPException(
            status_code=401,
            detail="Invalid phone number or password"
        )

    if not existing_user.is_active:

        raise HTTPException(
            status_code=403,
            detail="Account has been deactivated"
        )

    if not existing_user.password_hash:

        raise HTTPException(
            status_code=400,
            detail="This account uses Google Sign-In"
        )

    if not verify_password(
        user.password,
        existing_user.password_hash
    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid phone number or password"
        )

    try:
        sync_pending_beneficiary_requests_for_user(db, existing_user)
    except Exception:
        pass

    access_token = create_access_token(
        {
            "sub": existing_user.id,
            "phone": existing_user.phone
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# =====================================================
# CURRENT USER
# =====================================================

@router.get("/me", response_model=UserResponse)
def get_current_user(
    user_id: str = Depends(
        get_current_user_id
    ),
    db: Session = Depends(get_db)
):

    user = get_user_by_id(
        db,
        user_id
    )

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return {
        "id": user.id,
        "full_name": user.full_name,
        "phone": user.phone or "",
        "email": user.email,
        "is_verified": user.is_verified,
        "auth_provider": user.auth_provider,
        "has_sos_pin": bool(user.sos_pin_hash),
        "location_sharing": user.location_sharing if user.location_sharing is not None else True,
        "is_sharing_location": user.location_sharing if user.location_sharing is not None else True,
        "avatar_url": user.avatar_url
    }


# =====================================================
# UPDATE CURRENT USER
# =====================================================

@router.put("/me")
def update_current_user(
    user_data: UserUpdate,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):

    user = get_user_by_id(
        db,
        user_id
    )

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    if user_data.full_name is not None:
        user.full_name = user_data.full_name

    if user_data.email is not None:
        user.email = user_data.email

    if user_data.location_sharing is not None:
        user.location_sharing = user_data.location_sharing

    if user_data.avatar_url is not None:
        user.avatar_url = user_data.avatar_url

    user.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "full_name": user.full_name,
        "phone": user.phone or "",
        "email": user.email,
        "avatar_url": user.avatar_url,
        "location_sharing": user.location_sharing if user.location_sharing is not None else True,
        "is_sharing_location": user.location_sharing if user.location_sharing is not None else True,
        "has_sos_pin": bool(user.sos_pin_hash),
        "message": "Profile updated successfully"
    }

# =====================================================
# SET OR CHANGE SOS PIN
# =====================================================

@router.put("/sos-pin")
def set_sos_pin(
    request: Request,
    payload: SOSPinSet,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):

    pin = payload.pin.strip()

    if not pin.isdigit() or len(pin) != 4:

        raise HTTPException(
            status_code=400,
            detail="SOS PIN must contain exactly 4 digits"
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

    user.sos_pin_hash = hash_password(
        pin
    )

    user.updated_at = datetime.utcnow()

    db.commit()

    return {
        "message": "SOS PIN saved successfully"
    }


# =====================================================
# CHECK SOS PIN STATUS
# =====================================================

@router.get(
    "/sos-pin/status",
    response_model=SOSPinStatusResponse
)
def get_sos_pin_status(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):

    user = get_user_by_id(
        db,
        user_id
    )

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return {
        "has_sos_pin": bool(
            user.sos_pin_hash
        )
    }

# =====================================================
# DELETE ACCOUNT PERMANENTLY
# =====================================================

@router.delete("/me")
def delete_account(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):

    user = get_user_by_id(
        db,
        user_id
    )

    if not user:

        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    try:
        delete_user_account(
            db,
            user
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Account deletion failed: {str(e)}"
        )

    return {
        "message": "Account deleted permanently"
    }

# =====================================================
# JWT TEST
# =====================================================

@router.get("/jwt-test")
def jwt_test(
    user_id: str = Depends(get_current_user_id)
):

    return {
        "user_id": user_id
    }