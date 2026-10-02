from sqlalchemy.orm import Session

from app.database.models.user import User
from app.utils.phone import get_phone_variants


# =====================================================
# GET USER BY PHONE
# =====================================================

def get_user_by_phone(
    db: Session,
    phone: str
):
    if not phone:
        return None
    variants = list(get_phone_variants(phone))
    if not variants:
        return None
    return (
        db.query(User)
        .filter(User.phone.in_(variants))
        .first()
    )


# =====================================================
# GET USER BY ID
# =====================================================

def get_user_by_id(
    db: Session,
    user_id: str
):
    if not user_id:
        return None
    return (
        db.query(User)
        .filter(User.id == user_id)
        .first()
    )