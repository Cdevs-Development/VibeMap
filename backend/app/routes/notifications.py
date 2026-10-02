# =====================================================
# IMPORTS
# =====================================================

from typing import List

from fastapi import (
    APIRouter,
    Depends,
    HTTPException
)

from sqlalchemy.orm import Session

from app.database.connection import get_db

from app.schemas.notification_schema import (
    NotificationResponse,
    UnreadCountResponse
)

from app.security.auth import (
    get_current_user_id
)

from app.services.notification_service import (
    get_user_notifications,
    get_unread_count,
    get_notification_by_id
)


# =====================================================
# ROUTER
# =====================================================

router = APIRouter(
    tags=["Notifications"]
)


# =====================================================
# GET MY NOTIFICATIONS
# =====================================================

@router.get(
    "/",
    response_model=List[NotificationResponse]
)
def get_my_notifications(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):

    return get_user_notifications(
        db,
        user_id
    )


# =====================================================
# GET UNREAD COUNT
# =====================================================

@router.get(
    "/unread-count",
    response_model=UnreadCountResponse
)
def get_my_unread_count(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):

    return {
        "unread_count": get_unread_count(
            db,
            user_id
        )
    }


# =====================================================
# MARK ONE AS READ
# =====================================================

@router.patch("/{notification_id}/read")
def mark_notification_as_read(
    notification_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):

    notification = get_notification_by_id(
        db,
        notification_id
    )

    if not notification:

        raise HTTPException(
            status_code=404,
            detail="Notification not found"
        )

    if notification.user_id != user_id:

        raise HTTPException(
            status_code=403,
            detail="Not allowed"
        )

    notification.is_read = True

    db.commit()

    return {
        "message": "Notification marked as read"
    }


# =====================================================
# MARK ALL AS READ
# =====================================================

@router.patch("/read-all")
def mark_all_notifications_as_read(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):

    notifications = get_user_notifications(
        db,
        user_id
    )

    for notification in notifications:
        notification.is_read = True

    db.commit()

    return {
        "message": "All notifications marked as read"
    }


# =====================================================
# CLEAR ALL NOTIFICATIONS
# =====================================================

@router.delete("/clear-all")
def clear_all_notifications(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    notifications = get_user_notifications(db, user_id)
    for notification in notifications:
        db.delete(notification)
    db.commit()

    return {
        "message": "All notifications cleared successfully"
    }


# =====================================================
# DELETE SINGLE NOTIFICATION
# =====================================================

@router.delete("/{notification_id}")
def delete_notification(
    notification_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    notification = get_notification_by_id(db, notification_id)
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    if notification.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not allowed")

    db.delete(notification)
    db.commit()

    return {
        "message": "Notification deleted successfully"
    }