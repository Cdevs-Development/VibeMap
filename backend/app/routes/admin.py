from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any

from app.database.connection import get_db
from app.database.models.user import User
from app.database.models.sos_event import SOSEvent
from app.database.models.trip import Trip
from app.database.models.beneficiary import Beneficiary
from app.database.models.vibe_pin import VibePin
from app.database.models.notification import Notification
from app.database.models.location_ping import LocationPing
from app.database.models.vibe_confirmation import VibeConfirmation
from app.database.models.admin_audit_log import AdminAuditLog
from app.database.models.legal_document import LegalDocument
from app.services.watched_user_service import normalize_phone, get_phone_variants
from app.security.auth import get_current_admin
from app.security.hashing import verify_password
from app.security.jwt import create_access_token
from uuid import uuid4
from pydantic import BaseModel
import math

router = APIRouter(prefix="/admin", tags=["Admin"])
public_legal_router = APIRouter(prefix="/legal", tags=["Legal"])

def format_response_time(seconds: int) -> str:
    if seconds < 60:
        return f"{seconds}s"
    minutes = seconds // 60
    remaining_seconds = seconds % 60
    return f"{minutes}m {remaining_seconds}s"

def log_admin_action(
    db: Session,
    admin: User,
    action: str,
    target_id: Optional[str] = None,
    target_type: Optional[str] = None,
    details: Optional[str] = None
):
    try:
        audit = AdminAuditLog(
            admin_id=admin.id,
            admin_email=admin.email,
            admin_name=admin.full_name or admin.email,
            action=action,
            target_id=target_id,
            target_type=target_type,
            details=details,
            created_at=datetime.utcnow()
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        print(f"[Admin Audit Log Warning] {e}")


# ----------------------------------------
# SCHEMAS
# ----------------------------------------

class AdminLoginRequest(BaseModel):
    email: str
    password: str

class SOSResolveRequest(BaseModel):
    resolution_notes: str

class LegalDocUpdateRequest(BaseModel):
    title: str
    content: str
    version: Optional[str] = None

class UserStatusUpdateRequest(BaseModel):
    is_active: bool
    ban_reason: Optional[str] = None

class UserOverrideRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    is_verified: Optional[bool] = None

class PinStatusUpdateRequest(BaseModel):
    is_active: bool

class BeneficiaryRelinkRequest(BaseModel):
    target_user_id: Optional[str] = None
    force_confirm: Optional[bool] = False

class BroadcastNotificationRequest(BaseModel):
    title: str
    message: str
    notification_type: Optional[str] = "broadcast_announcement"
    only_verified: Optional[bool] = False

class TargetedNotificationRequest(BaseModel):
    user_ids: List[str]
    title: str
    message: str
    notification_type: Optional[str] = "admin_message"


# ----------------------------------------
# ENDPOINTS
# ----------------------------------------

@router.post("/login")
async def admin_login(
    payload: AdminLoginRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.email).first()
    
    if not user or not user.is_admin:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
        
    if not user.password_hash or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
        
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Admin account is disabled")

    access_token = create_access_token(
        {
            "sub": user.id,
            "email": user.email,
            "is_admin": True,
            "role": "admin"
        }
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

@router.get("/metrics/overview")
async def get_overview_metrics(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    total_users = db.query(User).count()
    active_sos = db.query(SOSEvent).filter(SOSEvent.status == "active").count()
    resolved_sos = db.query(SOSEvent).filter(SOSEvent.status == "resolved").count()
    active_trips = db.query(Trip).filter(Trip.status == "active").count()
    
    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    signups_today = db.query(User).filter(User.created_at >= today).count()

    growth_series = []
    for i in range(6, -1, -1):
        day_start = today - timedelta(days=i)
        day_end = day_start + timedelta(days=1)
        
        users_count = db.query(User).filter(
            User.created_at >= day_start,
            User.created_at < day_end
        ).count()
        
        incidents_count = db.query(SOSEvent).filter(
            SOSEvent.triggered_at >= day_start,
            SOSEvent.triggered_at < day_end
        ).count()
        
        growth_series.append({
            "name": day_start.strftime("%a"),
            "users": users_count,
            "incidents": incidents_count
        })

    # Calculate average response time
    # We look at resolved and active SOS incidents that have been acknowledged
    acknowledged_incidents = db.query(SOSEvent).filter(
        SOSEvent.acknowledged_at != None,
        SOSEvent.triggered_at != None
    ).all()
    avg_response_time_seconds = 0
    valid_pairs = [
        (inc.acknowledged_at - inc.triggered_at).total_seconds()
        for inc in acknowledged_incidents
        if inc.acknowledged_at and inc.triggered_at
    ]
    if valid_pairs:
        avg_response_time_seconds = sum(valid_pairs) / len(valid_pairs)

    return {
        "total_users": total_users,
        "active_sos": active_sos,
        "resolved_sos": resolved_sos,
        "active_trips": active_trips,
        "signups_today": signups_today,
        "growth_series": growth_series,
        "avg_response_time_seconds": avg_response_time_seconds
    }

@router.get("/sos/live")
async def get_live_sos(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    # outerjoin so SOS events from deleted users still appear
    sos_events = (
        db.query(SOSEvent, User)
        .outerjoin(User, SOSEvent.user_id == User.id)
        .filter(SOSEvent.status == "active")
        .all()
    )

    results = []
    for event, user in sos_events:
        # Null-safe response time: fall back to 0 if triggered_at is missing
        now = datetime.utcnow()
        triggered = event.triggered_at or now
        is_acknowledged = bool(event.acknowledged_at)
        if is_acknowledged and event.acknowledged_at:
            response_time_seconds = int((event.acknowledged_at - triggered).total_seconds())
        else:
            response_time_seconds = int((now - triggered).total_seconds())
        response_time_seconds = max(0, response_time_seconds)

        results.append({
            "id": event.id,
            "user": getattr(user, "full_name", None) or "Deleted User",
            "phone": getattr(user, "phone", None) or "Unknown",
            "timestamp": event.triggered_at.isoformat() if event.triggered_at else now.isoformat(),
            "lat": float(event.triggered_lat) if event.triggered_lat else float(getattr(user, "last_known_lat", None) or 0),
            "lng": float(event.triggered_lng) if event.triggered_lng else float(getattr(user, "last_known_lng", None) or 0),
            "status": event.status or "active",
            "is_acknowledged": is_acknowledged,
            "acknowledged_at": event.acknowledged_at.isoformat() if event.acknowledged_at else None,
            "acknowledging_beneficiary_name": event.acknowledging_beneficiary_name,
            "response_time_formatted": format_response_time(response_time_seconds)
        })
    return results

@router.post("/sos/{sos_id}/resolve")
async def resolve_sos(
    sos_id: str,
    payload: SOSResolveRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    event = db.query(SOSEvent).filter(SOSEvent.id == sos_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="SOS event not found")
    
    event.status = "resolved"
    event.resolved_at = datetime.utcnow()
    event.resolution_note = payload.resolution_notes
    db.commit()

    log_admin_action(
        db, current_admin, "SOS_RESOLVED", 
        target_id=event.id, target_type="sos_event",
        details=f"Resolved with notes: {payload.resolution_notes}"
    )
    
    return {"success": True, "message": "SOS resolved successfully."}

@router.get("/users")
async def get_users(
    search: Optional[str] = None,
    status: Optional[str] = "all",
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    query = db.query(User)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (User.full_name.ilike(search_filter)) |
            (User.email.ilike(search_filter)) |
            (User.phone.ilike(search_filter))
        )
    
    if status == "active":
        query = query.filter(User.is_active == True, User.is_verified == True)
    elif status == "suspended":
        query = query.filter(User.is_active == False)
    elif status == "unverified":
        query = query.filter(User.is_verified == False)
        
    total = query.count()
    users = query.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    
    # Batch calculate trips and beneficiaries count
    user_ids = [u.id for u in users]
    trips_counts = dict(
        db.query(Trip.user_id, func.count(Trip.id))
        .filter(Trip.user_id.in_(user_ids))
        .group_by(Trip.user_id)
        .all()
    ) if user_ids else {}
    
    beneficiaries_counts = dict(
        db.query(Beneficiary.user_id, func.count(Beneficiary.id))
        .filter(Beneficiary.user_id.in_(user_ids))
        .group_by(Beneficiary.user_id)
        .all()
    ) if user_ids else {}

    results = []
    for u in users:
        results.append({
            "id": u.id,
            "name": u.full_name,
            "email": u.email,
            "phone": u.phone,
            "authProvider": u.auth_provider,
            "verified": u.is_verified,
            "banned": not u.is_active,
            "trips": trips_counts.get(u.id, 0),
            "beneficiaries": beneficiaries_counts.get(u.id, 0),
            "registeredAt": u.created_at.isoformat() if u.created_at else None
        })
        
    return results

@router.get("/users/{user_id}")
async def get_user_details(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    trips = db.query(Trip).filter(Trip.user_id == user.id).count()
    beneficiaries = db.query(Beneficiary).filter(Beneficiary.user_id == user.id).count()
    
    return {
        "id": user.id,
        "name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "authProvider": user.auth_provider,
        "verified": user.is_verified,
        "banned": not user.is_active,
        "trips": trips,
        "beneficiaries": beneficiaries,
        "registeredAt": user.created_at.isoformat() if user.created_at else None
    }

@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: str,
    payload: UserStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.is_active = payload.is_active
    db.commit()

    log_admin_action(
        db, current_admin, 
        "USER_ACTIVATED" if payload.is_active else "USER_SUSPENDED",
        target_id=user.id, target_type="user",
        details=f"User {user.full_name} ({user.email}). Reason: {payload.ban_reason or 'No reason provided'}"
    )
    
    return {"success": True, "message": "User status updated"}

@router.patch("/users/{user_id}/override")
async def override_user_contact(
    user_id: str,
    payload: UserOverrideRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    changes = []
    if payload.email is not None:
        # Check if email is used by another user
        existing_email = db.query(User).filter(User.email == payload.email, User.id != user_id).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email is already in use by another user")
        changes.append(f"email: {user.email} -> {payload.email}")
        user.email = payload.email
        
    if payload.phone is not None:
        # Check if phone is used by another user
        existing_phone = db.query(User).filter(User.phone == payload.phone, User.id != user_id).first()
        if existing_phone:
            raise HTTPException(status_code=400, detail="Phone is already in use by another user")
        changes.append(f"phone: {user.phone} -> {payload.phone}")
        user.phone = payload.phone
        
    if payload.is_verified is not None:
        changes.append(f"is_verified: {user.is_verified} -> {payload.is_verified}")
        user.is_verified = payload.is_verified

    db.commit()
    db.refresh(user)

    log_admin_action(
        db, current_admin, "USER_OVERRIDE",
        target_id=user.id, target_type="user",
        details=f"User {user.full_name}. Changed: {', '.join(changes)}"
    )
    
    trips = db.query(Trip).filter(Trip.user_id == user.id).count()
    beneficiaries = db.query(Beneficiary).filter(Beneficiary.user_id == user.id).count()
    
    return {
        "id": user.id,
        "name": user.full_name,
        "email": user.email,
        "phone": user.phone,
        "authProvider": user.auth_provider,
        "verified": user.is_verified,
        "banned": not user.is_active,
        "trips": trips,
        "beneficiaries": beneficiaries,
        "registeredAt": user.created_at.isoformat() if user.created_at else None
    }

@router.delete("/users/{user_id}")
async def delete_user_account(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_info = f"{user.full_name} ({user.email})"
        
    # Manual cascade deletion to avoid 500 DB constraint crashes
    # 1. Beneficiaries
    db.query(Beneficiary).filter(Beneficiary.user_id == user_id).delete()
    db.query(Beneficiary).filter(Beneficiary.registered_user_id == user_id).delete()
    
    # 2. Trips & Location Pings
    trips = db.query(Trip).filter(Trip.user_id == user_id).all()
    for t in trips:
        db.query(LocationPing).filter(LocationPing.trip_id == t.id).delete()
        db.delete(t)
        
    # 3. SOS Events
    db.query(SOSEvent).filter(SOSEvent.user_id == user_id).delete()
    
    # 4. Vibe Pins & Confirmations (vibe_confirmations handles CASCADE if set up, but let's be safe)
    db.query(VibePin).filter(VibePin.user_id == user_id).delete()
    
    # 5. Notifications
    db.query(Notification).filter(Notification.user_id == user_id).delete()
    
    # Finally, delete user
    db.delete(user)
    db.commit()

    log_admin_action(
        db, current_admin, "USER_DELETED",
        target_id=user_id, target_type="user",
        details=f"Permanently deleted account and all cascaded relations for {user_info}"
    )
    
    return {"success": True, "message": "User account permanently removed"}

@router.get("/sos/history")
async def get_sos_history(
    search: Optional[str] = None,
    status: Optional[str] = "resolved",
    page: int = 1, 
    limit: int = 20,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    # outerjoin so history records from deleted users are preserved
    query = db.query(SOSEvent, User).outerjoin(User, SOSEvent.user_id == User.id)
    
    if status and status != "all":
        query = query.filter(SOSEvent.status == status)
        
    if search:
        search_filter = f"%{search}%"
        # Guard against searching on null user columns
        query = query.filter(
            (User.full_name.ilike(search_filter)) |
            (User.email.ilike(search_filter)) |
            (SOSEvent.id.ilike(search_filter))
        )
        
    if start_date:
        try:
            start = datetime.fromisoformat(start_date)
            query = query.filter(SOSEvent.triggered_at >= start)
        except ValueError:
            pass
            
    if end_date:
        try:
            end = datetime.fromisoformat(end_date)
            query = query.filter(SOSEvent.triggered_at <= end)
        except ValueError:
            pass
            
    total = query.count()
    events = query.order_by(SOSEvent.triggered_at.desc()).offset((page - 1) * limit).limit(limit).all()
    
    results = []
    for event, user in events:
        now = datetime.utcnow()
        triggered = event.triggered_at

        duration_seconds = None
        if triggered and event.resolved_at:
            duration_seconds = int((event.resolved_at - triggered).total_seconds())
            
        is_acknowledged = bool(event.acknowledged_at)
        if is_acknowledged and event.acknowledged_at and triggered:
            response_time_seconds = max(0, int((event.acknowledged_at - triggered).total_seconds()))
        elif event.resolved_at and triggered:
            response_time_seconds = max(0, int((event.resolved_at - triggered).total_seconds()))
        elif triggered:
            response_time_seconds = max(0, int((now - triggered).total_seconds()))
        else:
            response_time_seconds = 0

        results.append({
            "id": event.id,
            "user": getattr(user, "full_name", None) or "Deleted User",
            "phone": getattr(user, "phone", None) or "Unknown",
            "triggered_at": triggered.isoformat() if triggered else None,
            "resolved_at": event.resolved_at.isoformat() if event.resolved_at else None,
            "duration_seconds": duration_seconds,
            "lat": float(event.triggered_lat) if event.triggered_lat else float(getattr(user, "last_known_lat", None) or 0),
            "lng": float(event.triggered_lng) if event.triggered_lng else float(getattr(user, "last_known_lng", None) or 0),
            "status": event.status or "unknown",
            "resolution_notes": event.resolution_note,
            "is_acknowledged": is_acknowledged,
            "acknowledged_at": event.acknowledged_at.isoformat() if event.acknowledged_at else None,
            "acknowledging_beneficiary_name": event.acknowledging_beneficiary_name,
            "response_time_formatted": format_response_time(response_time_seconds)
        })
        
    return {
        "data": results,
        "total": total,
        "page": page,
        "limit": limit
    }


# ----------------------------------------
# VIBE PINS MODERATION ENDPOINTS
# ----------------------------------------

@router.get("/pins/metrics")
async def get_pins_metrics(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    now = datetime.utcnow()
    total_pins = db.query(VibePin).count()
    active_pins = db.query(VibePin).filter(VibePin.is_active == True, VibePin.expires_at > now).count()
    expired_pins = db.query(VibePin).filter(VibePin.expires_at <= now).count()
    inactive_pins = db.query(VibePin).filter(VibePin.is_active == False).count()

    categories_list = ["party", "wedding", "construction", "unsafe", "market", "traffic"]
    category_counts = {}
    for cat in categories_list:
        category_counts[cat] = db.query(VibePin).filter(VibePin.category == cat).count()

    sources_list = ["user", "instagram", "twitter", "organiser"]
    source_counts = {}
    for src in sources_list:
        source_counts[src] = db.query(VibePin).filter(VibePin.source == src).count()

    return {
        "total_pins": total_pins,
        "active_pins": active_pins,
        "expired_pins": expired_pins,
        "inactive_pins": inactive_pins,
        "categories": category_counts,
        "sources": source_counts
    }

@router.get("/pins")
async def get_pins(
    search: Optional[str] = None,
    category: Optional[str] = "all",
    status: Optional[str] = "all",
    source: Optional[str] = "all",
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    now = datetime.utcnow()
    query = db.query(VibePin, User).outerjoin(User, VibePin.user_id == User.id)

    if category and category != "all":
        query = query.filter(VibePin.category == category)

    if source and source != "all":
        query = query.filter(VibePin.source == source)

    if status == "active":
        query = query.filter(VibePin.is_active == True, VibePin.expires_at > now)
    elif status == "inactive":
        query = query.filter(VibePin.is_active == False)
    elif status == "expired":
        query = query.filter(VibePin.expires_at <= now)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (VibePin.note.ilike(search_filter)) |
            (User.full_name.ilike(search_filter)) |
            (User.email.ilike(search_filter)) |
            (User.phone.ilike(search_filter)) |
            (VibePin.id.ilike(search_filter))
        )

    total = query.count()
    pins = query.order_by(VibePin.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    results = []
    for pin, user in pins:
        is_expired = pin.expires_at <= now if pin.expires_at else False
        results.append({
            "id": pin.id,
            "user_id": pin.user_id,
            "author_name": getattr(user, "full_name", None) or "Anonymous / System",
            "author_email": getattr(user, "email", None),
            "author_phone": getattr(user, "phone", None),
            "category": pin.category,
            "lat": float(pin.lat) if pin.lat else 0.0,
            "lng": float(pin.lng) if pin.lng else 0.0,
            "note": pin.note,
            "confirmation_count": pin.confirmation_count or 1,
            "expires_at": pin.expires_at.isoformat() if pin.expires_at else None,
            "is_active": bool(pin.is_active),
            "is_expired": is_expired,
            "source": pin.source or "user",
            "created_at": pin.created_at.isoformat() if pin.created_at else None
        })

    return {
        "data": results,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.patch("/pins/{pin_id}/status")
async def update_pin_status(
    pin_id: str,
    payload: PinStatusUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    pin = db.query(VibePin).filter(VibePin.id == pin_id).first()
    if not pin:
        raise HTTPException(status_code=404, detail="Vibe pin not found")

    pin.is_active = payload.is_active
    db.commit()

    log_admin_action(
        db, current_admin,
        "PIN_ACTIVATED" if payload.is_active else "PIN_HIDDEN",
        target_id=pin.id, target_type="vibe_pin",
        details=f"Pin category '{pin.category}' at ({pin.lat}, {pin.lng})"
    )

    return {
        "success": True,
        "message": f"Vibe pin {'activated' if payload.is_active else 'deactivated'} successfully",
        "pin_id": pin.id,
        "is_active": pin.is_active
    }

@router.delete("/pins/{pin_id}")
async def delete_pin(
    pin_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    pin = db.query(VibePin).filter(VibePin.id == pin_id).first()
    if not pin:
        raise HTTPException(status_code=404, detail="Vibe pin not found")

    pin_info = f"category '{pin.category}' note '{pin.note}' at ({pin.lat}, {pin.lng})"

    # Cascade delete confirmations
    try:
        db.query(VibeConfirmation).filter(VibeConfirmation.vibe_pin_id == pin_id).delete(synchronize_session=False)
    except Exception:
        pass

    db.delete(pin)
    db.commit()

    log_admin_action(
        db, current_admin, "PIN_DELETED",
        target_id=pin_id, target_type="vibe_pin",
        details=f"Permanently deleted pin: {pin_info}"
    )

    return {"success": True, "message": "Vibe pin permanently removed"}



# ----------------------------------------
# BENEFICIARY / FAMILY MAP OVERSIGHT ENDPOINTS
# ----------------------------------------

@router.get("/beneficiaries/metrics")
async def get_beneficiaries_metrics(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    total = db.query(Beneficiary).count()
    accepted = db.query(Beneficiary).filter(Beneficiary.status == "accepted").count()
    pending = db.query(Beneficiary).filter(Beneficiary.status == "pending").count()
    declined = db.query(Beneficiary).filter(Beneficiary.status == "declined").count()

    # Orphaned: registered_user_id is None
    orphaned_count = db.query(Beneficiary).filter(Beneficiary.registered_user_id == None).count()

    return {
        "total_beneficiaries": total,
        "accepted": accepted,
        "pending": pending,
        "declined": declined,
        "orphaned_count": orphaned_count
    }

@router.get("/beneficiaries")
async def get_beneficiaries(
    search: Optional[str] = None,
    status: Optional[str] = "all",
    health: Optional[str] = "all",  # "all", "orphaned", "linked"
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    # Query with alias for sender and registered recipient
    query = db.query(Beneficiary)

    if status and status != "all":
        query = query.filter(Beneficiary.status == status)

    if health == "orphaned":
        query = query.filter(Beneficiary.registered_user_id == None)
    elif health == "linked":
        query = query.filter(Beneficiary.registered_user_id != None)

    if search:
        search_filter = f"%{search}%"
        # Search by recipient name/phone or beneficiary ID
        query = query.filter(
            (Beneficiary.name.ilike(search_filter)) |
            (Beneficiary.phone.ilike(search_filter)) |
            (Beneficiary.id.ilike(search_filter))
        )

    total = query.count()
    beneficiaries = query.order_by(Beneficiary.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    # Fetch users in bulk for speed
    sender_ids = [b.user_id for b in beneficiaries if b.user_id]
    target_ids = [b.registered_user_id for b in beneficiaries if b.registered_user_id]
    user_ids_to_fetch = set(sender_ids + target_ids)
    
    users_by_id = {}
    if user_ids_to_fetch:
        users = db.query(User).filter(User.id.in_(user_ids_to_fetch)).all()
        users_by_id = {u.id: u for u in users}

    # For orphaned entries, check if an active registered user exists by phone
    orphaned_phones = []
    for b in beneficiaries:
        if not b.registered_user_id and b.phone:
            orphaned_phones.extend(list(get_phone_variants(b.phone)))

    users_by_phone = {}
    if orphaned_phones:
        phone_matches = db.query(User).filter(User.phone.in_(orphaned_phones), User.is_active == True).all()
        for u in phone_matches:
            if u.phone:
                for v in get_phone_variants(u.phone):
                    users_by_phone[v] = u

    results = []
    for b in beneficiaries:
        sender = users_by_id.get(b.user_id)
        target = users_by_id.get(b.registered_user_id) if b.registered_user_id else None

        suggested_match = None
        if not target and b.phone:
            for variant in get_phone_variants(b.phone):
                if variant in users_by_phone:
                    suggested_user = users_by_phone[variant]
                    suggested_match = {
                        "id": suggested_user.id,
                        "name": suggested_user.full_name,
                        "email": suggested_user.email,
                        "phone": suggested_user.phone
                    }
                    break

        is_orphaned = (b.registered_user_id is None)

        results.append({
            "id": b.id,
            "sender_id": b.user_id,
            "sender_name": getattr(sender, "full_name", None) or "Unknown Sender",
            "sender_email": getattr(sender, "email", None),
            "sender_phone": getattr(sender, "phone", None),
            "recipient_name": b.name,
            "recipient_phone": b.phone,
            "registered_user_id": b.registered_user_id,
            "registered_user_name": getattr(target, "full_name", None) if target else None,
            "registered_user_email": getattr(target, "email", None) if target else None,
            "registered_user_phone": getattr(target, "phone", None) if target else None,
            "is_orphaned": is_orphaned,
            "suggested_match": suggested_match,
            "status": b.status,
            "is_confirmed": bool(b.is_confirmed),
            "confirmed_at": b.confirmed_at.isoformat() if b.confirmed_at else None,
            "created_at": b.created_at.isoformat() if b.created_at else None
        })

    return {
        "data": results,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.post("/beneficiaries/{beneficiary_id}/relink")
async def relink_beneficiary(
    beneficiary_id: str,
    payload: BeneficiaryRelinkRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    beneficiary = db.query(Beneficiary).filter(Beneficiary.id == beneficiary_id).first()
    if not beneficiary:
        raise HTTPException(status_code=404, detail="Beneficiary relationship not found")

    target_user = None
    if payload.target_user_id:
        target_user = db.query(User).filter(User.id == payload.target_user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="Target user not found")
    else:
        # Auto-match using phone variants
        phone_variants = list(get_phone_variants(beneficiary.phone))
        target_user = db.query(User).filter(User.phone.in_(phone_variants), User.is_active == True).first()
        if not target_user:
            raise HTTPException(
                status_code=400,
                detail=f"No active registered user found matching phone {beneficiary.phone}"
            )

    beneficiary.registered_user_id = target_user.id
    if payload.force_confirm:
        beneficiary.status = "accepted"
        beneficiary.is_confirmed = True
        beneficiary.confirmed_at = datetime.utcnow()

    db.commit()
    db.refresh(beneficiary)

    log_admin_action(
        db, current_admin, "BENEFICIARY_RELINKED",
        target_id=beneficiary.id, target_type="beneficiary",
        details=f"Linked relation {beneficiary.id} to user {target_user.full_name} ({target_user.email}) - phone: {beneficiary.phone}"
    )

    return {
        "success": True,
        "message": f"Beneficiary linked to {target_user.full_name} ({target_user.email})",
        "beneficiary_id": beneficiary.id,
        "registered_user_id": target_user.id,
        "registered_user_name": target_user.full_name,
        "status": beneficiary.status,
        "is_confirmed": beneficiary.is_confirmed
    }

@router.delete("/beneficiaries/{beneficiary_id}")
async def delete_beneficiary_relationship(
    beneficiary_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    beneficiary = db.query(Beneficiary).filter(Beneficiary.id == beneficiary_id).first()
    if not beneficiary:
        raise HTTPException(status_code=404, detail="Beneficiary relationship not found")

    rel_info = f"relationship for phone {beneficiary.phone}, watcher={beneficiary.user_id}"

    # Clean up associated request notifications
    try:
        db.query(Notification).filter(
            Notification.related_entity_id == beneficiary_id
        ).delete(synchronize_session=False)
    except Exception:
        pass

    db.delete(beneficiary)
    db.commit()

    log_admin_action(
        db, current_admin, "BENEFICIARY_DELETED",
        target_id=beneficiary_id, target_type="beneficiary",
        details=f"Permanently removed {rel_info}"
    )

    return {"success": True, "message": "Beneficiary relationship permanently deleted"}



# ----------------------------------------
# TRIP & NAVIGATION ANALYTICS ENDPOINTS
# ----------------------------------------

@router.get("/trips/metrics")
async def get_trips_metrics(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    now = datetime.utcnow()
    total_trips = db.query(Trip).count()
    active_trips = db.query(Trip).filter(Trip.status == "active").count()
    completed_trips = db.query(Trip).filter(Trip.status == "completed").count()
    cancelled_trips = db.query(Trip).filter(Trip.status == "cancelled").count()
    sos_active_trips = db.query(Trip).filter(Trip.status == "sos_active").count()

    two_hours_ago = now - timedelta(hours=2)
    abandoned_trips = db.query(Trip).filter(
        Trip.status == "active",
        Trip.started_at < two_hours_ago
    ).count()

    completed_records = db.query(Trip).filter(Trip.status == "completed", Trip.ended_at != None).all()
    avg_duration_minutes = 0
    durations = [
        (t.ended_at - t.started_at).total_seconds() / 60
        for t in completed_records
        if t.ended_at and t.started_at and t.ended_at > t.started_at
    ]
    if durations:
        avg_duration_minutes = round(sum(durations) / len(durations), 1)

    dest_counts = db.query(Trip.destination_name, func.count(Trip.id).label("count"))\
        .group_by(Trip.destination_name)\
        .order_by(func.count(Trip.id).desc())\
        .limit(5)\
        .all()
    top_destinations = [{"name": d[0] or "Unknown", "count": d[1]} for d in dest_counts if d[0]]

    return {
        "total_trips": total_trips,
        "active_trips": active_trips,
        "completed_trips": completed_trips,
        "cancelled_trips": cancelled_trips,
        "sos_active_trips": sos_active_trips,
        "abandoned_trips": abandoned_trips,
        "avg_duration_minutes": avg_duration_minutes,
        "top_destinations": top_destinations
    }

@router.get("/trips")
async def get_trips(
    search: Optional[str] = None,
    status: Optional[str] = "all",
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    now = datetime.utcnow()
    query = db.query(Trip, User).outerjoin(User, Trip.user_id == User.id)

    if status and status != "all":
        if status == "abandoned":
            two_hours_ago = now - timedelta(hours=2)
            query = query.filter(Trip.status == "active", Trip.started_at < two_hours_ago)
        else:
            query = query.filter(Trip.status == status)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Trip.destination_name.ilike(search_filter)) |
            (User.full_name.ilike(search_filter)) |
            (User.phone.ilike(search_filter)) |
            (Trip.id.ilike(search_filter))
        )

    total = query.count()
    trips = query.order_by(Trip.started_at.desc()).offset((page - 1) * limit).limit(limit).all()

    results = []
    for trip, user in trips:
        duration_minutes = None
        if trip.started_at and trip.ended_at:
            duration_minutes = round(max(0, (trip.ended_at - trip.started_at).total_seconds() / 60), 1)
        elif trip.started_at:
            duration_minutes = round(max(0, (now - trip.started_at).total_seconds() / 60), 1)

        pings_count = db.query(LocationPing).filter(LocationPing.trip_id == trip.id).count()
        is_abandoned = (trip.status == "active" and trip.started_at and (now - trip.started_at).total_seconds() > 7200)

        results.append({
            "id": trip.id,
            "user_id": trip.user_id,
            "user_name": getattr(user, "full_name", None) or "Deleted User",
            "user_phone": getattr(user, "phone", None) or "No Phone",
            "destination_name": trip.destination_name,
            "origin_lat": float(trip.origin_lat) if trip.origin_lat else None,
            "origin_lng": float(trip.origin_lng) if trip.origin_lng else None,
            "destination_lat": float(trip.destination_lat) if trip.destination_lat else None,
            "destination_lng": float(trip.destination_lng) if trip.destination_lng else None,
            "current_lat": float(trip.current_lat or trip.last_known_lat) if (trip.current_lat or trip.last_known_lat) else None,
            "current_lng": float(trip.current_lng or trip.last_known_lng) if (trip.current_lng or trip.last_known_lng) else None,
            "status": "abandoned" if is_abandoned else (trip.status or "active"),
            "started_at": trip.started_at.isoformat() if trip.started_at else None,
            "ended_at": trip.ended_at.isoformat() if trip.ended_at else None,
            "last_ping_at": trip.last_ping_at.isoformat() if trip.last_ping_at else None,
            "duration_minutes": duration_minutes,
            "pings_count": pings_count
        })

    return {
        "data": results,
        "total": total,
        "page": page,
        "limit": limit
    }

@router.get("/trips/{trip_id}")
async def get_trip_details(
    trip_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    trip = db.query(Trip).filter(Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")

    user = db.query(User).filter(User.id == trip.user_id).first()
    pings = db.query(LocationPing).filter(LocationPing.trip_id == trip_id).order_by(LocationPing.recorded_at.asc()).all()

    pings_data = [
        {
            "id": p.id,
            "lat": float(p.smoothed_lat or p.raw_lat),
            "lng": float(p.smoothed_lng or p.raw_lng),
            "raw_lat": float(p.raw_lat),
            "raw_lng": float(p.raw_lng),
            "speed_ms": float(p.speed_ms) if p.speed_ms else 0.0,
            "accuracy_meters": p.accuracy_meters,
            "signal_source": p.signal_source,
            "recorded_at": p.recorded_at.isoformat() if p.recorded_at else None
        }
        for p in pings
    ]

    return {
        "id": trip.id,
        "user_id": trip.user_id,
        "user_name": getattr(user, "full_name", None) or "Deleted User",
        "user_email": getattr(user, "email", None),
        "user_phone": getattr(user, "phone", None),
        "destination_name": trip.destination_name,
        "origin_lat": float(trip.origin_lat) if trip.origin_lat else None,
        "origin_lng": float(trip.origin_lng) if trip.origin_lng else None,
        "destination_lat": float(trip.destination_lat) if trip.destination_lat else None,
        "destination_lng": float(trip.destination_lng) if trip.destination_lng else None,
        "current_lat": float(trip.current_lat or trip.last_known_lat) if (trip.current_lat or trip.last_known_lat) else None,
        "current_lng": float(trip.current_lng or trip.last_known_lng) if (trip.current_lng or trip.last_known_lng) else None,
        "status": trip.status,
        "started_at": trip.started_at.isoformat() if trip.started_at else None,
        "ended_at": trip.ended_at.isoformat() if trip.ended_at else None,
        "pings": pings_data
    }


# ----------------------------------------
# SYSTEM HEALTH & DIAGNOSTICS ENDPOINTS
# ----------------------------------------

@router.get("/system/health")
async def get_system_health(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    now = datetime.utcnow()
    total_users = db.query(User).count()

    fresh_threshold = now - timedelta(minutes=15)
    stale_24h_threshold = now - timedelta(hours=24)

    active_tracking_now = db.query(User).filter(User.last_location_updated_at >= fresh_threshold).count()
    stale_tracking_24h = db.query(User).filter(
        User.last_location_updated_at >= stale_24h_threshold,
        User.last_location_updated_at < fresh_threshold
    ).count()
    inactive_tracking = db.query(User).filter(
        (User.last_location_updated_at == None) | (User.last_location_updated_at < stale_24h_threshold)
    ).count()

    location_sharing_enabled = db.query(User).filter(User.location_sharing == True).count()
    location_sharing_disabled = db.query(User).filter(User.location_sharing == False).count()

    active_emergencies = db.query(SOSEvent).filter(SOSEvent.status == "active").count()
    total_emergencies = db.query(SOSEvent).count()

    return {
        "status": "online",
        "timestamp": now.isoformat(),
        "database": {
            "status": "connected",
            "engine": "PostgreSQL",
            "models_loaded": 8
        },
        "services": {
            "api_server": "operational",
            "websocket_tracking": "operational",
            "sos_dispatch": "operational",
            "push_notifications": "operational"
        },
        "tracking_health": {
            "total_users": total_users,
            "active_tracking_now": active_tracking_now,
            "stale_tracking_24h": stale_tracking_24h,
            "inactive_tracking": inactive_tracking,
            "location_sharing_enabled": location_sharing_enabled,
            "location_sharing_disabled": location_sharing_disabled
        },
        "emergency_health": {
            "active_emergencies": active_emergencies,
            "total_emergencies": total_emergencies
        }
    }


# ----------------------------------------
# NOTIFICATIONS & BROADCAST ENDPOINTS
# ----------------------------------------

@router.post("/notifications/broadcast")
async def broadcast_notification(
    payload: BroadcastNotificationRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    query = db.query(User).filter(User.is_active == True)
    if payload.only_verified:
        query = query.filter(User.is_verified == True)

    target_users = query.all()
    if not target_users:
        return {"success": True, "message": "No active users found", "sent_count": 0}

    now = datetime.utcnow()
    notifications = [
        Notification(
            id=str(uuid4()),
            user_id=u.id,
            notification_type=payload.notification_type or "broadcast_announcement",
            title=payload.title,
            message=payload.message,
            is_read=False,
            created_at=now
        )
        for u in target_users
    ]

    db.bulk_save_objects(notifications)
    db.commit()

    log_admin_action(
        db, current_admin, "BROADCAST_SENT",
        target_id=None, target_type="notification",
        details=f"Delivered broadcast '{payload.title}' ({payload.notification_type}) to {len(notifications)} users"
    )

    return {
        "success": True,
        "message": f"Broadcast sent to {len(notifications)} users",
        "sent_count": len(notifications)
    }

@router.post("/notifications/send")
async def send_targeted_notification(
    payload: TargetedNotificationRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    if not payload.user_ids:
        raise HTTPException(status_code=400, detail="At least one user ID is required")

    valid_users = db.query(User).filter(User.id.in_(payload.user_ids)).all()
    if not valid_users:
        raise HTTPException(status_code=404, detail="No matching users found")

    now = datetime.utcnow()
    notifications = [
        Notification(
            id=str(uuid4()),
            user_id=u.id,
            notification_type=payload.notification_type or "admin_message",
            title=payload.title,
            message=payload.message,
            is_read=False,
            created_at=now
        )
        for u in valid_users
    ]

    db.bulk_save_objects(notifications)
    db.commit()

    log_admin_action(
        db, current_admin, "TARGETED_NOTIFICATION_SENT",
        target_id=None, target_type="notification",
        details=f"Sent direct message '{payload.title}' to {len(notifications)} user(s)"
    )

    return {
        "success": True,
        "message": f"Notification delivered to {len(notifications)} users",
        "sent_count": len(notifications)
    }

@router.get("/notifications/logs")
async def get_notification_logs(
    search: Optional[str] = None,
    notification_type: Optional[str] = "all",
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    query = db.query(Notification, User).outerjoin(User, Notification.user_id == User.id)

    if notification_type and notification_type != "all":
        query = query.filter(Notification.notification_type == notification_type)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Notification.title.ilike(search_filter)) |
            (Notification.message.ilike(search_filter)) |
            (User.full_name.ilike(search_filter)) |
            (User.email.ilike(search_filter)) |
            (User.phone.ilike(search_filter))
        )

    total = query.count()
    logs = query.order_by(Notification.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    results = []
    for notif, user in logs:
        results.append({
            "id": notif.id,
            "user_id": notif.user_id,
            "recipient_name": getattr(user, "full_name", None) or "Deleted User",
            "recipient_email": getattr(user, "email", None),
            "recipient_phone": getattr(user, "phone", None),
            "notification_type": notif.notification_type,
            "title": notif.title,
            "message": notif.message,
            "is_read": bool(notif.is_read),
            "created_at": notif.created_at.isoformat() if notif.created_at else None
        })

    return {
        "data": results,
        "total": total,
        "page": page,
        "limit": limit
    }


# ----------------------------------------
# ADMIN ACCESS CONTROL ENDPOINTS
# ----------------------------------------

@router.get("/admins")
async def get_admins(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    admins = db.query(User).filter(User.is_admin == True).order_by(User.created_at.desc()).all()
    results = [
        {
            "id": a.id,
            "name": a.full_name,
            "email": a.email,
            "phone": a.phone,
            "is_active": a.is_active,
            "created_at": a.created_at.isoformat() if a.created_at else None
        }
        for a in admins
    ]
    return results

@router.post("/admins/{user_id}/promote")
async def promote_to_admin(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_admin = True
    db.commit()

    log_admin_action(
        db, current_admin, "ADMIN_PROMOTED",
        target_id=user.id, target_type="user",
        details=f"Granted Admin role to {user.full_name} ({user.email})"
    )

    return {
        "success": True,
        "message": f"{user.full_name} ({user.email}) has been granted Admin privileges",
        "user_id": user.id,
        "is_admin": True
    }

@router.post("/admins/{user_id}/demote")
async def demote_admin(
    user_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    if user_id == current_admin.id:
        raise HTTPException(status_code=400, detail="You cannot revoke your own administrator account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_admin = False
    db.commit()

    log_admin_action(
        db, current_admin, "ADMIN_DEMOTED",
        target_id=user.id, target_type="user",
        details=f"Revoked Admin role from {user.full_name} ({user.email})"
    )

    return {
        "success": True,
        "message": f"Admin privileges revoked from {user.full_name}",
        "user_id": user.id,
        "is_admin": False
    }


# ----------------------------------------
# ADMIN ACTIVITY AUDIT TRAIL ENDPOINTS
# ----------------------------------------

@router.get("/audit-logs")
async def get_admin_audit_logs(
    search: Optional[str] = None,
    action: Optional[str] = "all",
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    query = db.query(AdminAuditLog)

    if action and action != "all":
        query = query.filter(AdminAuditLog.action == action)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (AdminAuditLog.admin_email.ilike(search_filter)) |
            (AdminAuditLog.admin_name.ilike(search_filter)) |
            (AdminAuditLog.action.ilike(search_filter)) |
            (AdminAuditLog.details.ilike(search_filter)) |
            (AdminAuditLog.target_id.ilike(search_filter))
        )

    total = query.count()
    logs = query.order_by(AdminAuditLog.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    results = [
        {
            "id": log.id,
            "admin_id": log.admin_id,
            "admin_email": log.admin_email,
            "admin_name": log.admin_name,
            "action": log.action,
            "target_id": log.target_id,
            "target_type": log.target_type,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None
        }
        for log in logs
    ]

    return {
        "data": results,
        "total": total,
        "page": page,
        "limit": limit
    }


# ----------------------------------------
# LEGAL CONTENT & POLICY CMS ENDPOINTS
# ----------------------------------------

DEFAULT_LEGAL_DOCS = {
    "terms_of_service": {
        "title": "VibeMap Terms of Service",
        "version": "1.0",
        "content": """# Terms of Service for VibeMap

**Last Updated: March 2026**
**Version: 1.0**

Welcome to VibeMap! By accessing or using our mobile application, website, and location-based safety features, you agree to be bound by these Terms of Service.

## 1. Safety & Emergency Features
VibeMap provides real-time location sharing, SOS incident broadcasting, and community vibe tracking. While we strive to maintain uninterrupted service, VibeMap is supplementary and should not replace primary emergency services (such as dialing official emergency phone numbers).

## 2. User Accounts & Responsibilities
- You must provide accurate registration details (phone number, name, and email).
- You agree not to trigger false or malicious SOS alarms. Misuse of emergency features will result in immediate account termination.
- You are responsible for maintaining the confidentiality of your PIN and login credentials.

## 3. Location Sharing & Privacy
By enabling Live Tracking or Family Map features, you authorize VibeMap to share your background location coordinates with your approved beneficiaries. You may revoke or pause location sharing at any time through settings.

## 4. Community Vibe Pins
Pins submitted to the map (e.g. Traffic, Unsafe Areas, Roadblocks, Nightlife) must be truthful and helpful. We reserve the right to moderate or remove inappropriate content.

## 5. Contact & Support
If you have questions regarding these terms, contact us at support@vibemap.live.
"""
    },
    "privacy_policy": {
        "title": "VibeMap Privacy Policy",
        "version": "1.0",
        "content": """# Privacy Policy for VibeMap

**Last Updated: March 2026**
**Version: 1.0**

Your privacy and physical safety are fundamental to everything we build at VibeMap. This policy describes what information we collect, how we protect it, and when it is shared.

## 1. Information We Collect
- **Account Details:** Full name, verified mobile phone number, email address, and avatar.
- **Precise Geolocation Data:** High-accuracy GPS coordinates, breadcrumb location pings, altitude, and speed when active navigation or background safety sharing is enabled.
- **Safety Network:** Approved emergency contacts (beneficiaries) and relationship links.
- **Incident Telemetry:** Timestamps and location breadcrumbs recorded during SOS emergency events.

## 2. How We Use Your Data
- To display your real-time position to authorized beneficiaries on the Family Map.
- To route urgent alerts to your emergency contacts when an SOS trigger occurs.
- To crowdsource neighborhood safety alerts via anonymous Vibe Pins.

## 3. Data Protection & Retention
All location transmissions are encrypted in transit via TLS and protected at rest. Location history pings are stored strictly for trip tracking and safety audit logs.

## 4. Your Rights & Account Deletion
You retain full control over your personal data. You may request permanent deletion of your account and all associated location history at any time.
"""
    }
}

def get_or_create_legal_doc(db: Session, doc_type: str) -> LegalDocument:
    doc = db.query(LegalDocument).filter(LegalDocument.doc_type == doc_type).first()
    if not doc:
        defaults = DEFAULT_LEGAL_DOCS.get(doc_type, {
            "title": f"VibeMap {doc_type.replace('_', ' ').title()}",
            "version": "1.0",
            "content": f"# {doc_type.replace('_', ' ').title()}\n\nContent coming soon."
        })
        doc = LegalDocument(
            id=str(uuid4()),
            doc_type=doc_type,
            title=defaults["title"],
            content=defaults["content"],
            version=defaults["version"],
            updated_by="System Default",
            updated_at=datetime.utcnow()
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
    return doc

@router.get("/legal/{doc_type}")
async def get_admin_legal_doc(
    doc_type: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    if doc_type not in ["terms_of_service", "privacy_policy"]:
        raise HTTPException(status_code=400, detail="Invalid legal document type")

    doc = get_or_create_legal_doc(db, doc_type)
    return {
        "id": doc.id,
        "doc_type": doc.doc_type,
        "title": doc.title,
        "content": doc.content,
        "version": doc.version,
        "updated_by": doc.updated_by,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None
    }

@router.put("/legal/{doc_type}")
async def update_admin_legal_doc(
    doc_type: str,
    payload: LegalDocUpdateRequest,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    if doc_type not in ["terms_of_service", "privacy_policy"]:
        raise HTTPException(status_code=400, detail="Invalid legal document type")

    doc = get_or_create_legal_doc(db, doc_type)
    doc.title = payload.title
    doc.content = payload.content
    if payload.version:
        doc.version = payload.version
    else:
        # Increment patch version
        try:
            parts = doc.version.split(".")
            parts[-1] = str(int(parts[-1]) + 1)
            doc.version = ".".join(parts)
        except Exception:
            doc.version = f"{doc.version}.1"

    doc.updated_by = current_admin.email
    doc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(doc)

    log_admin_action(
        db, current_admin, "LEGAL_DOC_UPDATED",
        target_id=doc.id, target_type="legal_doc",
        details=f"Updated {doc.doc_type} to version {doc.version}"
    )

    return {
        "success": True,
        "message": f"{doc.title} updated successfully to v{doc.version}",
        "document": {
            "id": doc.id,
            "doc_type": doc.doc_type,
            "title": doc.title,
            "content": doc.content,
            "version": doc.version,
            "updated_by": doc.updated_by,
            "updated_at": doc.updated_at.isoformat() if doc.updated_at else None
        }
    }

# Public Legal Endpoint for Mobile App and Web
@public_legal_router.get("/{doc_type}")
async def get_public_legal_doc(
    doc_type: str,
    db: Session = Depends(get_db)
):
    if doc_type not in ["terms_of_service", "privacy_policy"]:
        raise HTTPException(status_code=400, detail="Invalid legal document type")

    doc = get_or_create_legal_doc(db, doc_type)
    return {
        "doc_type": doc.doc_type,
        "title": doc.title,
        "content": doc.content,
        "version": doc.version,
        "updated_at": doc.updated_at.isoformat() if doc.updated_at else None
    }

