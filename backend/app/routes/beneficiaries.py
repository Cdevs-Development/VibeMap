from datetime import datetime
from typing import List
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.connection import get_db
from app.database.models.beneficiary import Beneficiary
from app.database.models.notification import Notification
from app.database.models.user import User
from app.schemas.beneficiary_schema import (
    BeneficiaryCreate,
    BeneficiaryDecision,
    BeneficiaryRequestResponse,
    BeneficiaryResponse,
    BeneficiaryUpdate,
)
from app.security.auth import get_current_user_id
from app.services.beneficiary_service import (
    get_beneficiaries_by_user,
    get_beneficiary_by_id,
    get_existing_beneficiary_by_phone,
    get_pending_requests_for_user,
)
from app.services.notification_service import (
    notify_beneficiary_response,
    notify_new_beneficiary,
    notify_beneficiary_removed,
    sync_pending_beneficiary_requests_for_user,
)
from app.services.user_service import get_user_by_id


router = APIRouter(tags=["Beneficiaries"])


from app.services.watched_user_service import normalize_phone, get_phone_variants

@router.post("/")
def create_beneficiary(
    beneficiary: BeneficiaryCreate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    phone = beneficiary.phone.strip()
    name = beneficiary.name.strip()

    if not phone:
        raise HTTPException(
            status_code=400,
            detail="Beneficiary phone number is required",
        )

    if not name:
        raise HTTPException(
            status_code=400,
            detail="Beneficiary name is required",
        )

    owner = get_user_by_id(db, user_id)

    if not owner:
        raise HTTPException(
            status_code=404,
            detail="Current user not found",
        )

    phone_variants = list(get_phone_variants(phone))

    if owner.phone:
        owner_variants = get_phone_variants(owner.phone)
        if any(v in owner_variants for v in phone_variants):
            raise HTTPException(
                status_code=400,
                detail="You cannot add yourself as a beneficiary",
            )

    existing = (
        db.query(Beneficiary)
        .filter(
            Beneficiary.user_id == user_id,
            Beneficiary.phone.in_(phone_variants),
        )
        .first()
    )

    if existing:
        if existing.status == "accepted":
            raise HTTPException(
                status_code=409,
                detail="This user is already your confirmed beneficiary",
            )

        if existing.status == "pending":
            raise HTTPException(
                status_code=409,
                detail="A beneficiary request is already pending",
            )

        # Allow a previously declined request to be sent again.
        existing.name = name
        existing.status = "pending"
        existing.is_confirmed = False
        existing.confirmed_at = None
        existing.created_at = datetime.utcnow()

        registered_user = (
            db.query(User)
            .filter(
                User.phone.in_(phone_variants),
                User.is_active == True,
            )
            .first()
        )

        existing.registered_user_id = (
            registered_user.id if registered_user else None
        )

        db.commit()
        db.refresh(existing)

        if registered_user:
            notify_new_beneficiary(
                db=db,
                beneficiary_phone=phone,
                owner_name=owner.full_name,
                beneficiary_id=existing.id,
            )

        return {
            "message": "Beneficiary request sent successfully",
            "beneficiary_id": existing.id,
            "status": existing.status,
            "registered_user": registered_user is not None,
        }

    registered_user = (
        db.query(User)
        .filter(
            User.phone.in_(phone_variants),
            User.is_active == True,
        )
        .first()
    )

    new_beneficiary = Beneficiary(
        id=str(uuid4()),
        user_id=user_id,
        registered_user_id=(
            registered_user.id if registered_user else None
        ),
        name=name,
        phone=phone,
        status="pending",
        is_confirmed=False,
        confirmation_token=None,
        confirmed_at=None,
        created_at=datetime.utcnow(),
    )

    db.add(new_beneficiary)
    db.commit()
    db.refresh(new_beneficiary)

    if registered_user:
        notify_new_beneficiary(
            db=db,
            beneficiary_phone=phone,
            owner_name=owner.full_name,
            beneficiary_id=new_beneficiary.id,
        )

    return {
        "message": "Beneficiary request created successfully",
        "beneficiary_id": new_beneficiary.id,
        "status": new_beneficiary.status,
        "registered_user": registered_user is not None,
    }


@router.get(
    "/requests",
    response_model=List[BeneficiaryRequestResponse],
)
def get_my_pending_beneficiary_requests(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    try:
        sync_pending_beneficiary_requests_for_user(db, user_id)
    except Exception:
        pass

    requests = get_pending_requests_for_user(
        db=db,
        registered_user_id=user_id,
    )
    if not requests:
        return []

    owner_ids = [r.user_id for r in requests if r.user_id]
    users_by_id = {}
    if owner_ids:
        owners = db.query(User).filter(User.id.in_(owner_ids)).all()
        users_by_id = {u.id: u for u in owners}

    results = []
    for r in requests:
        owner_user = users_by_id.get(r.user_id)
        results.append(
            BeneficiaryRequestResponse(
                id=r.id,
                user_id=r.user_id,
                registered_user_id=r.registered_user_id,
                name=r.name,
                phone=r.phone,
                status=r.status,
                is_confirmed=r.is_confirmed,
                avatar_url=owner_user.avatar_url if owner_user else None,
                created_at=r.created_at,
            )
        )
    return results


@router.patch("/{beneficiary_id}/respond")
def respond_to_beneficiary_request(
    beneficiary_id: str,
    decision: BeneficiaryDecision,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    beneficiary = get_beneficiary_by_id(
        db=db,
        beneficiary_id=beneficiary_id,
    )

    if not beneficiary:
        raise HTTPException(
            status_code=404,
            detail="Beneficiary request not found",
        )

    if beneficiary.registered_user_id != user_id:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to respond to this request",
        )

    if beneficiary.status != "pending":
        # Auto-mark any notification as read to clean up UI
        user_notifs = (
            db.query(Notification)
            .filter(
                Notification.user_id == user_id,
                Notification.related_entity_id == beneficiary.id,
            )
            .all()
        )
        for n in user_notifs:
            n.is_read = True
        db.commit()

        return {
            "message": f"This request was already {beneficiary.status}",
            "beneficiary_id": beneficiary.id,
            "status": beneficiary.status,
            "is_confirmed": beneficiary.is_confirmed,
            "already_processed": True,
        }

    current_user = get_user_by_id(db, user_id)

    if not current_user:
        raise HTTPException(
            status_code=404,
            detail="Current user not found",
        )

    if decision.action == "accept":
        beneficiary.status = "accepted"
        beneficiary.is_confirmed = True
        beneficiary.confirmed_at = datetime.utcnow()
    else:
        beneficiary.status = "declined"
        beneficiary.is_confirmed = False
        beneficiary.confirmed_at = None

    # Auto-mark responder's notification for this beneficiary request as read
    user_notifs = (
        db.query(Notification)
        .filter(
            Notification.user_id == user_id,
            Notification.related_entity_id == beneficiary.id,
        )
        .all()
    )
    for n in user_notifs:
        n.is_read = True

    db.commit()
    db.refresh(beneficiary)

    notify_beneficiary_response(
        db=db,
        owner_id=beneficiary.user_id,
        responder_name=current_user.full_name,
        beneficiary_id=beneficiary.id,
        action=decision.action,
    )

    return {
        "message": (
            f"Beneficiary request {decision.action}ed successfully"
        ),
        "beneficiary_id": beneficiary.id,
        "status": beneficiary.status,
        "is_confirmed": beneficiary.is_confirmed,
    }


@router.get(
    "/",
    response_model=List[BeneficiaryResponse],
)
def get_my_beneficiaries(
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    beneficiaries = get_beneficiaries_by_user(
        db=db,
        user_id=user_id,
    )

    if not beneficiaries:
        return []

    registered_ids = [b.registered_user_id for b in beneficiaries if b.registered_user_id]
    users_by_id = {}
    if registered_ids:
        users = db.query(User).filter(User.id.in_(registered_ids)).all()
        users_by_id = {u.id: u for u in users}

    all_phones = []
    for b in beneficiaries:
        if not b.registered_user_id and b.phone:
            all_phones.extend(list(get_phone_variants(b.phone)))

    users_by_phone = {}
    if all_phones:
        p_users = db.query(User).filter(User.phone.in_(all_phones), User.is_active == True).all()
        for u in p_users:
            if u.phone:
                for v in get_phone_variants(u.phone):
                    users_by_phone[v] = u

    results = []
    for b in beneficiaries:
        target_user = users_by_id.get(b.registered_user_id) if b.registered_user_id else None
        if not target_user and b.phone:
            target_user = users_by_phone.get(b.phone)

        results.append(
            BeneficiaryResponse(
                id=b.id,
                user_id=b.user_id,
                registered_user_id=b.registered_user_id or (target_user.id if target_user else None),
                name=b.name,
                phone=b.phone,
                status=b.status,
                is_confirmed=b.is_confirmed,
                avatar_url=target_user.avatar_url if target_user else None,
                confirmation_token=b.confirmation_token,
                confirmed_at=b.confirmed_at,
                created_at=b.created_at,
            )
        )

    return results


@router.put("/{beneficiary_id}")
def update_beneficiary(
    beneficiary_id: str,
    beneficiary: BeneficiaryUpdate,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    existing_beneficiary = get_beneficiary_by_id(
        db=db,
        beneficiary_id=beneficiary_id,
    )

    if not existing_beneficiary:
        raise HTTPException(
            status_code=404,
            detail="Beneficiary not found",
        )

    if existing_beneficiary.user_id != user_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    existing_beneficiary.name = beneficiary.name.strip()
    existing_beneficiary.phone = beneficiary.phone.strip()

    phone_variants = list(get_phone_variants(existing_beneficiary.phone))

    registered_user = (
        db.query(User)
        .filter(
            User.phone.in_(phone_variants),
            User.is_active == True,
        )
        .first()
    )

    existing_beneficiary.registered_user_id = (
        registered_user.id if registered_user else None
    )

    # Changing the phone means the new person has not accepted.
    existing_beneficiary.status = "pending"
    existing_beneficiary.is_confirmed = False
    existing_beneficiary.confirmed_at = None

    db.commit()

    return {
        "message": "Beneficiary updated successfully",
        "status": existing_beneficiary.status,
    }


@router.delete("/{beneficiary_id}")
def delete_beneficiary(
    beneficiary_id: str,
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    existing_beneficiary = get_beneficiary_by_id(
        db=db,
        beneficiary_id=beneficiary_id,
    )

    if not existing_beneficiary:
        raise HTTPException(
            status_code=404,
            detail="Beneficiary not found",
        )

    if existing_beneficiary.user_id != user_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    target_user_id = existing_beneficiary.registered_user_id
    if not target_user_id and existing_beneficiary.phone:
        phone_variants = list(get_phone_variants(existing_beneficiary.phone))
        reg_user = db.query(User).filter(User.phone.in_(phone_variants), User.is_active == True).first()
        if reg_user:
            target_user_id = reg_user.id

    owner = get_user_by_id(db, user_id)
    owner_name = owner.full_name if owner else "Someone"

    # Clean up any lingering request notifications for this beneficiary
    db.query(Notification).filter(
        Notification.related_entity_id == existing_beneficiary.id
    ).delete(synchronize_session=False)

    db.delete(existing_beneficiary)
    db.commit()

    if target_user_id:
        try:
            notify_beneficiary_removed(
                db=db,
                target_user_id=target_user_id,
                owner_name=owner_name
            )
        except Exception as e:
            print(f"[Beneficiaries] Error sending removal notification: {e}")

    return {
        "message": "Beneficiary deleted successfully",
    }