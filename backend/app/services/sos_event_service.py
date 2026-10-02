# =====================================================
# IMPORTS
# =====================================================

from sqlalchemy.orm import Session

from app.database.models.sos_event import (
    SOSEvent
)


# =====================================================
# GET USER SOS EVENTS
# =====================================================

def get_user_sos_events(
    db: Session,
    user_id: str
):

    return (
        db.query(SOSEvent)
        .filter(
            SOSEvent.user_id == user_id,
            SOSEvent.status == "active"
        )
        .all()
    )


# =====================================================
# GET SOS EVENT
# =====================================================

def get_sos_event(
    db: Session,
    sos_id: str
):

    return (
        db.query(SOSEvent)
        .filter(
            SOSEvent.id == sos_id
        )
        .first()
    )