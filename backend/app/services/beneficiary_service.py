from sqlalchemy.orm import Session

from app.database.models.beneficiary import Beneficiary


def get_beneficiaries_by_user(
    db: Session,
    user_id: str,
):
    return (
        db.query(Beneficiary)
        .filter(Beneficiary.user_id == user_id)
        .all()
    )


def get_beneficiary_by_id(
    db: Session,
    beneficiary_id: str,
):
    return (
        db.query(Beneficiary)
        .filter(Beneficiary.id == beneficiary_id)
        .first()
    )


def get_pending_requests_for_user(
    db: Session,
    registered_user_id: str,
):
    return (
        db.query(Beneficiary)
        .filter(
            Beneficiary.registered_user_id == registered_user_id,
            Beneficiary.status == "pending",
        )
        .order_by(Beneficiary.created_at.desc())
        .all()
    )


def get_existing_beneficiary_by_phone(
    db: Session,
    owner_id: str,
    phone: str,
):
    return (
        db.query(Beneficiary)
        .filter(
            Beneficiary.user_id == owner_id,
            Beneficiary.phone == phone,
        )
        .first()
    )