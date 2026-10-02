# =====================================================
# IMPORTS
# =====================================================

import os

from dotenv import load_dotenv

from fastapi import (
    Depends,
    HTTPException
)

from fastapi.security import (
    HTTPBearer,
    HTTPAuthorizationCredentials
)

from jose import (
    JWTError,
    jwt
)

from sqlalchemy.orm import Session
from app.database.connection import get_db
from app.database.models.user import User


load_dotenv()


# =====================================================
# JWT CONFIG
# =====================================================

SECRET_KEY = os.getenv(
    "SECRET_KEY",
    "dev_secret_key_vibemap_2026"
)

ALGORITHM = os.getenv(
    "ALGORITHM",
    "HS256"
)


# =====================================================
# HTTP BEARER AUTH
# =====================================================

security = HTTPBearer()


# =====================================================
# DECODE ACCESS TOKEN
# =====================================================

def decode_access_token(
    token: str
) -> str:

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        user_id = payload.get("sub")

        if not user_id:

            raise ValueError(
                "Token does not contain a user ID"
            )

        return user_id

    except JWTError as exc:

        raise ValueError(
            "Invalid or expired access token"
        ) from exc


# =====================================================
# GET CURRENT USER ID FROM HTTP TOKEN
# =====================================================

def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(
        security
    )
):

    credentials_exception = HTTPException(
        status_code=401,
        detail="Could not validate credentials"
    )

    try:

        return decode_access_token(
            credentials.credentials
        )

    except ValueError:

        raise credentials_exception


optional_security = HTTPBearer(auto_error=False)

def get_optional_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(
        optional_security
    )
):
    if not credentials:
        return None
    try:
        return decode_access_token(credentials.credentials)
    except Exception:
        return None

# =====================================================
# FULL USER RETRIEVAL
# =====================================================

def get_current_user(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )
    return user


# =====================================================
# ADMIN CHECK
# =====================================================

async def get_current_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    is_admin = getattr(current_user, "is_admin", False)
    role = getattr(current_user, "role", None)
    
    if role != "admin" and not is_admin:
        raise HTTPException(
            status_code=403, 
            detail="Admin access required"
        )
    return current_user