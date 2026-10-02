import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator
from app.utils.phone import validate_and_normalize_phone


class BeneficiaryCreate(BaseModel):
    name: str
    phone: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 2:
            raise ValueError("Contact name must be at least 2 characters")
        return clean

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        is_valid, norm, err = validate_and_normalize_phone(v)
        if not is_valid:
            raise ValueError(err or "Invalid phone number format")
        return norm


class BeneficiaryUpdate(BaseModel):
    name: str
    phone: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        clean = v.strip()
        if len(clean) < 2:
            raise ValueError("Contact name must be at least 2 characters")
        return clean

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        is_valid, norm, err = validate_and_normalize_phone(v)
        if not is_valid:
            raise ValueError(err or "Invalid phone number format")
        return norm


class BeneficiaryDecision(BaseModel):
    action: Literal["accept", "decline"]


class BeneficiaryResponse(BaseModel):
    id: str
    user_id: str
    registered_user_id: str | None = None
    name: str
    phone: str
    status: str
    is_confirmed: bool
    avatar_url: str | None = None
    confirmation_token: str | None = None
    confirmed_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class BeneficiaryRequestResponse(BaseModel):
    id: str
    user_id: str
    registered_user_id: str | None = None
    name: str
    phone: str
    status: str
    is_confirmed: bool
    avatar_url: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True