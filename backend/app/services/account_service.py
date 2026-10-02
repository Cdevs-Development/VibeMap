# =====================================================
# IMPORTS
# =====================================================

import logging
from sqlalchemy.orm import Session

from app.database.models.user import User
from app.database.models.trip import Trip
from app.database.models.location_ping import LocationPing
from app.database.models.sos_event import SOSEvent
from app.database.models.vibe_pin import VibePin
from app.database.models.vibe_confirmation import VibeConfirmation
from app.database.models.beneficiary import Beneficiary
from app.database.models.notification import Notification

logger = logging.getLogger(__name__)

# =====================================================
# DELETE USER ACCOUNT
# =====================================================

def delete_user_account(
    db: Session,
    user: User
) -> None:
    """
    Permanently deletes a user and all related records across the entire database,
    strictly respecting all foreign key constraints. Works for both standard (email/phone)
    and Google OAuth users.
    """
    try:
        user_id = user.id
        logger.info(f"Initiating full account deletion for user: {user_id} ({user.email})")

        # 1. Location pings linked to the user's trips
        trip_ids = [
            t_id
            for (t_id,) in (
                db.query(Trip.id)
                .filter(Trip.user_id == user_id)
                .all()
            )
        ]
        if trip_ids:
            db.query(LocationPing).filter(
                LocationPing.trip_id.in_(trip_ids)
            ).delete(synchronize_session=False)

        # 2. Vibe confirmations made by the user
        db.query(VibeConfirmation).filter(
            VibeConfirmation.user_id == user_id
        ).delete(synchronize_session=False)

        # 3. Vibe confirmations made by other users on this user's pins
        user_pin_ids = [
            p_id
            for (p_id,) in (
                db.query(VibePin.id)
                .filter(VibePin.user_id == user_id)
                .all()
            )
        ]
        if user_pin_ids:
            db.query(VibeConfirmation).filter(
                VibeConfirmation.vibe_pin_id.in_(user_pin_ids)
            ).delete(synchronize_session=False)

        # 4. Vibe pins owned by the user
        db.query(VibePin).filter(
            VibePin.user_id == user_id
        ).delete(synchronize_session=False)

        # 5. SOS events owned by the user
        db.query(SOSEvent).filter(
            SOSEvent.user_id == user_id
        ).delete(synchronize_session=False)

        # 6. Notifications sent to the user
        db.query(Notification).filter(
            Notification.user_id == user_id
        ).delete(synchronize_session=False)

        # 7. Beneficiary records where this user is the owner
        db.query(Beneficiary).filter(
            Beneficiary.user_id == user_id
        ).delete(synchronize_session=False)

        # 8. Beneficiary records where this user was added by someone else
        # Nullify registered_user_id to remove foreign key link while keeping contact entry for watcher
        db.query(Beneficiary).filter(
            Beneficiary.registered_user_id == user_id
        ).update(
            {Beneficiary.registered_user_id: None},
            synchronize_session=False
        )

        # 9. Trips owned by the user
        db.query(Trip).filter(
            Trip.user_id == user_id
        ).delete(synchronize_session=False)

        # 10. Finally, delete the User record itself
        db.delete(user)
        db.commit()
        logger.info(f"User account {user_id} deleted successfully.")

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to delete user account {user.id}: {e}", exc_info=True)
        raise