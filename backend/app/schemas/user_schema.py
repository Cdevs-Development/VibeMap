import re
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional

from app.utils.phone import validate_and_normalize_phone


class UserRegister(BaseModel):
    full_name: str
    phone: str
    email: EmailStr
    password: Optional[str] = None
    google_id: Optional[str] = None
    auth_provider: str = "email"
    avatar_url: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 2:
            raise ValueError("Full name must be at least 2 characters")
        if not any(c.isalpha() for c in clean):
            raise ValueError("Full name must contain letters")
        return clean

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        is_valid, norm, err = validate_and_normalize_phone(v)
        if not is_valid:
            raise ValueError(err or "Invalid phone number format")
        return norm


class UserLogin(BaseModel):
    phone: str
    password: str

    @field_validator("phone")
    @classmethod
    def validate_login_phone(cls, v: str) -> str:
        is_valid, norm, err = validate_and_normalize_phone(v)
        if not is_valid:
            raise ValueError(err or "Invalid phone number format")
        return norm

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Password is required")
        return v


class GoogleAuthRequest(BaseModel):
    id_token: Optional[str] = None
    access_token: Optional[str] = None
    email: Optional[EmailStr] = None
    google_id: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    is_verified: bool
    auth_provider: str
    has_sos_pin: bool
    location_sharing: bool = True
    is_sharing_location: bool = True
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    location_sharing: Optional[bool] = None
    avatar_url: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def validate_update_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        clean = v.strip()
        if len(clean) < 2:
            raise ValueError("Full name must be at least 2 characters")
        if not any(c.isalpha() for c in clean):
            raise ValueError("Full name must contain letters")
        return clean


class UserLocationUpdate(BaseModel):
    lat: Optional[float] = None
    lng: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy: Optional[float] = None
    speed: Optional[float] = None
    heading: Optional[float] = None


class SOSPinSet(BaseModel):
    pin: str

    @field_validator("pin")
    @classmethod
    def validate_pin(cls, v: str) -> str:
        clean = v.strip()
        if not re.match(r"^\d{4}$", clean):
            raise ValueError("SOS PIN must be exactly 4 digits")
        return clean


class SOSPinStatusResponse(BaseModel):
    has_sos_pin: bool