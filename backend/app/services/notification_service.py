from uuid import uuid4

from datetime import datetime

from sqlalchemy.orm import Session

from app.database.models.user import User

from app.database.models.notification import (
    Notification
)


def create_notification(
    db: Session,
    user_id: str,
    notification_type: str,
    title: str,
    message: str,
    related_entity_id: str | None = None
) -> Notification:

    notification = Notification(
        id=str(uuid4()),
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        message=message,
        related_entity_id=related_entity_id,
        is_read=False,
        created_at=datetime.utcnow()
    )

    db.add(notification)

    return notification


def sync_pending_beneficiary_requests_for_user(
    db: Session,
    user_id_or_user: str | User
) -> int:
    """
    Auto-links pending Beneficiary invitations to a user by matching phone numbers,
    and ensures a 'beneficiary_request' Notification is created for the recipient so they
    see it immediately upon creating an account or opening the app.
    """
    if isinstance(user_id_or_user, str):
        user = db.query(User).filter(User.id == user_id_or_user).first()
    else:
        user = user_id_or_user

    if not user or not user.phone:
        return 0

    from app.services.watched_user_service import get_phone_variants
    from app.database.models.beneficiary import Beneficiary

    phone_variants = list(get_phone_variants(user.phone))
    if not phone_variants:
        return 0

    pending_beneficiaries = (
        db.query(Beneficiary)
        .filter(
            Beneficiary.phone.in_(phone_variants),
            Beneficiary.status == "pending",
            Beneficiary.user_id != user.id
        )
        .all()
    )

    created_count = 0
    need_commit = False

    for b in pending_beneficiaries:
        if b.registered_user_id != user.id:
            b.registered_user_id = user.id
            need_commit = True

        existing_notif = (
            db.query(Notification)
            .filter(
                Notification.user_id == user.id,
                Notification.notification_type == "beneficiary_request",
                Notification.related_entity_id == b.id
            )
            .first()
        )

        if not existing_notif:
            owner = db.query(User).filter(User.id == b.user_id).first()
            owner_name = owner.full_name if owner else "A family member"
            new_notif = Notification(
                id=str(uuid4()),
                user_id=user.id,
                notification_type="beneficiary_request",
                title="New beneficiary request",
                message=(
                    f"{owner_name} wants to add you as an emergency "
                    "beneficiary on VibeMap.\n\nOpen the app to accept or decline."
                ),
                related_entity_id=b.id,
                is_read=False,
                created_at=datetime.utcnow()
            )
            db.add(new_notif)
            created_count += 1
            need_commit = True

    if need_commit:
        try:
            db.commit()
        except Exception:
            db.rollback()

    return created_count


def get_user_notifications(
    db: Session,
    user_id: str
):
    sync_pending_beneficiary_requests_for_user(db, user_id)
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id
        )
        .order_by(
            Notification.created_at.desc()
        )
        .all()
    )


def get_unread_count(
    db: Session,
    user_id: str
) -> int:
    sync_pending_beneficiary_requests_for_user(db, user_id)
    return (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        )
        .count()
    )


def get_notification_by_id(
    db: Session,
    notification_id: str
):

    return (
        db.query(Notification)
        .filter(
            Notification.id == notification_id
        )
        .first()
    )

def notify_new_beneficiary(
    db: Session,
    beneficiary_phone: str,
    owner_name: str,
    beneficiary_id: str,
):
    from app.services.watched_user_service import get_phone_variants

    phone_variants = list(get_phone_variants(beneficiary_phone))

    user = (
        db.query(User)
        .filter(
            User.phone.in_(phone_variants),
            User.is_active == True,
        )
        .first()
    )

    if not user:
        return None

    create_notification(
        db=db,
        user_id=user.id,
        notification_type="beneficiary_request",
        title="New beneficiary request",
        message=(
            f"{owner_name} wants to add you as an emergency "
            "beneficiary on VibeMap.\n\nOpen the app to accept or decline."
        ),
        related_entity_id=beneficiary_id,
    )

    db.commit()

    return user

def notify_beneficiary_response(
    db: Session,
    owner_id: str,
    responder_name: str,
    beneficiary_id: str,
    action: str,
):
    if action == "accept":
        title = "Beneficiary request accepted"
        message = (
            f"{responder_name} accepted your beneficiary request."
        )
        notification_type = "beneficiary_request_accepted"
    else:
        title = "Beneficiary request declined"
        message = (
            f"{responder_name} declined your beneficiary request."
        )
        notification_type = "beneficiary_request_declined"

    create_notification(
        db=db,
        user_id=owner_id,
        notification_type=notification_type,
        title=title,
        message=message,
        related_entity_id=beneficiary_id,
    )

    db.commit()


def notify_beneficiary_removed(
    db: Session,
    target_user_id: str,
    owner_name: str
):
    create_notification(
        db=db,
        user_id=target_user_id,
        notification_type="beneficiary_removed",
        title="Removed as Emergency Contact",
        message=f"{owner_name} removed you as their emergency contact."
    )
    db.commit()