# =====================================================
# IMPORTS
# =====================================================

from sqlalchemy.orm import Session

from app.database.models.beneficiary import Beneficiary
from app.database.models.user import User

from app.services.notification_service import (
    create_notification
)
from app.services.watched_user_service import get_phone_variants


# =====================================================
# NOTIFY BENEFICIARIES
# =====================================================

def notify_beneficiaries(
    db: Session,
    user_id: str,
    latitude: float,
    longitude: float
):

    # Fetch only accepted and confirmed beneficiaries
    beneficiaries = (
        db.query(Beneficiary)
        .filter(
            Beneficiary.user_id == user_id,
            Beneficiary.status == "accepted",
            Beneficiary.is_confirmed == True,
        )
        .all()
    )

    if not beneficiaries:
        return []

    # Fetch SOS owner once
    owner = (
        db.query(User)
        .filter(
            User.id == user_id
        )
        .first()
    )

    if not owner:
        return []

    # Get the registered user IDs directly.
    # No phone matching is needed anymore.
    recipient_ids = [
        beneficiary.registered_user_id
        for beneficiary in beneficiaries
        if beneficiary.registered_user_id
    ]

    # Bulk-fetch all registered beneficiaries in ONE query
    recipients = (
        db.query(User)
        .filter(
            User.id.in_(recipient_ids),
            User.is_active == True,
        )
        .all()
        if recipient_ids
        else []
    )

    # Map users by ID for fast in-memory lookup
    recipients_by_id = {
        recipient.id: recipient
        for recipient in recipients
    }

    results = []

    for beneficiary in beneficiaries:

        if not beneficiary.registered_user_id:

            results.append({
                "success": False,
                "beneficiary": beneficiary.name,
                "reason": "Beneficiary not registered",
            })

            continue

        recipient = recipients_by_id.get(
            beneficiary.registered_user_id
        )

        if not recipient:

            results.append({
                "success": False,
                "beneficiary": beneficiary.name,
                "reason": "Beneficiary account unavailable",
            })

            continue

        # Check if recipient has a custom name for the SOS owner
        owner_phone_variants = list(get_phone_variants(owner.phone)) if owner.phone else []
        recip_custom_contact = (
            db.query(Beneficiary)
            .filter(
                Beneficiary.user_id == recipient.id,
                (Beneficiary.registered_user_id == owner.id) |
                (Beneficiary.phone.in_(owner_phone_variants) if owner_phone_variants else False),
            )
            .first()
        )
        sender_display_name = (
            recip_custom_contact.name
            if (recip_custom_contact and recip_custom_contact.name)
            else (owner.full_name or "Your Emergency Contact")
        )

        create_notification(
            db=db,
            user_id=recipient.id,
            notification_type="sos",
            title="🚨 Emergency SOS",
            message=(
                f"{sender_display_name} has triggered an SOS."
            ),
            related_entity_id=user_id,
        )

        results.append({
            "success": True,
            "beneficiary": beneficiary.name,
        })

    db.commit()

    return results  