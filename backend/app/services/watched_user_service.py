import re
from datetime import datetime
from sqlalchemy.orm import Session

from app.database.models.beneficiary import Beneficiary
from app.database.models.sos_event import SOSEvent
from app.database.models.trip import Trip
from app.database.models.user import User


def normalize_phone(phone: str) -> str:
    if not phone:
        return ""
    digits = re.sub(r"\D", "", phone.strip())
    if digits.startswith("234") and len(digits) >= 13:
        return "0" + digits[3:]
    if digits.startswith("234") and len(digits) == 13:
        return "0" + digits[3:]
    if len(digits) == 10 and not digits.startswith("0"):
        return "0" + digits
    return digits


def get_phone_variants(phone: str) -> set:
    variants = set()
    if not phone:
        return variants
    raw = phone.strip()
    norm = normalize_phone(raw)
    variants.add(raw)
    if norm:
        variants.add(norm)
        if norm.startswith("0"):
            variants.add(f"+234{norm[1:]}")
            variants.add(f"234{norm[1:]}")
        elif norm.startswith("234"):
            variants.add(f"+{norm}")
            variants.add(f"0{norm[3:]}")
    return variants


def get_users_watching_current_user(
    db: Session,
    current_user: User
):
    phone_candidates = get_phone_variants(current_user.phone) if current_user.phone else set()

    # 1. Accepted beneficiaries added BY current_user
    my_beneficiaries = (
        db.query(Beneficiary)
        .filter(
            Beneficiary.user_id == current_user.id,
            Beneficiary.status == "accepted",
            Beneficiary.is_confirmed == True,
        )
        .all()
    )

    # 2. Accepted watchers who added current_user
    watchers = (
        db.query(Beneficiary)
        .filter(
            (
                (Beneficiary.registered_user_id == current_user.id) |
                (Beneficiary.phone.in_(list(phone_candidates)) if phone_candidates else False)
            ),
            Beneficiary.status == "accepted",
            Beneficiary.is_confirmed == True,
        )
        .all()
    )

    # All of current user's beneficiary entries (for custom names lookup)
    all_my_contacts = (
        db.query(Beneficiary)
        .filter(
            Beneficiary.user_id == current_user.id
        )
        .all()
    )

    custom_names_by_user_id = {}
    custom_names_by_phone = {}
    target_user_ids = set()

    # Auto-link registered_user_id if missing and populate name lookups
    all_users = db.query(User).filter(User.is_active == True).all()
    users_by_phone_norm = {}
    for u in all_users:
        if u.phone:
            u_norm = normalize_phone(u.phone)
            users_by_phone_norm[u_norm] = u
            users_by_phone_norm[u.phone.strip()] = u

    need_commit = False
    for b in all_my_contacts:
        if b.registered_user_id:
            custom_names_by_user_id[b.registered_user_id] = b.name
        
        if b.phone:
            norm_b = normalize_phone(b.phone)
            for v in get_phone_variants(b.phone):
                custom_names_by_phone[v] = b.name

            # Auto-link registered_user_id if not linked yet
            if not b.registered_user_id and norm_b in users_by_phone_norm:
                matched_user = users_by_phone_norm[norm_b]
                if matched_user.id != current_user.id:
                    b.registered_user_id = matched_user.id
                    custom_names_by_user_id[matched_user.id] = b.name
                    need_commit = True

    if need_commit:
        try:
            db.commit()
        except Exception:
            db.rollback()

    # Only include users from ACCEPTED and CONFIRMED relationships
    for b in my_beneficiaries:
        if b.registered_user_id:
            target_user_ids.add(b.registered_user_id)
        elif b.phone:
            norm_b = normalize_phone(b.phone)
            matched_user = users_by_phone_norm.get(norm_b) or users_by_phone_norm.get(b.phone.strip())
            if matched_user:
                target_user_ids.add(matched_user.id)

    for w in watchers:
        if w.user_id and w.user_id != current_user.id:
            target_user_ids.add(w.user_id)

    target_user_ids.discard(current_user.id)

    if not target_user_ids:
        return []

    users = (
        db.query(User)
        .filter(
            User.id.in_(list(target_user_ids)),
            User.is_active == True
        )
        .all()
    )

    results = []

    for target_user in users:
        target_norm = normalize_phone(target_user.phone) if target_user.phone else ""
        custom_name = (
            custom_names_by_user_id.get(target_user.id)
            or (custom_names_by_phone.get(target_user.phone) if target_user.phone else None)
            or (custom_names_by_phone.get(target_norm) if target_norm else None)
        )
        display_name = custom_name or target_user.full_name or "Beneficiary"

        latest_trip = (
            db.query(Trip)
            .filter(
                Trip.user_id == target_user.id
            )
            .order_by(
                Trip.started_at.desc()
            )
            .first()
        )

        active_sos = (
            db.query(SOSEvent)
            .filter(
                SOSEvent.user_id == target_user.id,
                SOSEvent.status == "active"
            )
            .first()
        )

        trip_is_active = bool(
            latest_trip
            and latest_trip.status in (
                "active",
                "sos_active"
            )
        )

        user_sharing_enabled = (
            target_user.location_sharing is not False
        )
        is_sharing = bool(trip_is_active or user_sharing_enabled)

        lat = None
        lng = None
        last_seen = None

        trip_lat = None
        trip_lng = None
        trip_last_seen = None

        if trip_is_active and latest_trip and latest_trip.last_known_lat is not None:
            try:
                trip_lat = float(latest_trip.last_known_lat)
                trip_lng = float(latest_trip.last_known_lng)
                trip_last_seen = latest_trip.last_ping_at
            except (ValueError, TypeError):
                pass

        user_lat = None
        user_lng = None
        user_last_seen = None
        if target_user.last_known_lat is not None and target_user.last_known_lng is not None:
            try:
                user_lat = float(target_user.last_known_lat)
                user_lng = float(target_user.last_known_lng)
                user_last_seen = target_user.last_location_updated_at
            except (ValueError, TypeError):
                pass

        # Select the most accurate coordinate using freshness-based priority.
        #
        # PREVIOUS BUG: comparing user_last_seen vs trip_last_seen cross-table caused the
        # marker to flip-flop between two fixed points every poll cycle, because the two
        # timestamp columns (last_location_updated_at on User, last_ping_at on Trip) are
        # updated by different code paths at different rates.
        #
        # FIX: user.last_known_lat (updated by PUT /users/me/location every ~15 s) is the
        # live heartbeat and wins unconditionally when it is fresh (< 5 min old).
        # We only fall back to the trip coordinate when the user heartbeat is stale/absent.
        STALE_THRESHOLD_SECONDS = 300  # 5 minutes
        user_is_fresh = (
            user_lat is not None
            and user_last_seen is not None
            and (datetime.utcnow() - user_last_seen).total_seconds() < STALE_THRESHOLD_SECONDS
        )

        if user_is_fresh:
            lat, lng, last_seen = user_lat, user_lng, user_last_seen
        elif trip_lat is not None:
            lat, lng, last_seen = trip_lat, trip_lng, trip_last_seen
        elif user_lat is not None:
            # user coordinate exists but is stale — still better than nothing
            lat, lng, last_seen = user_lat, user_lng, user_last_seen

        # User is actively online if sharing is enabled AND a fresh location ping occurred within 10 minutes
        IS_ONLINE_THRESHOLD_SECONDS = 600  # 10 minutes
        is_online = bool(
            is_sharing
            and last_seen is not None
            and (datetime.utcnow() - last_seen).total_seconds() < IS_ONLINE_THRESHOLD_SECONDS
        )

        results.append(
            {
                "id": target_user.id,
                "full_name": display_name,
                "name": display_name,
                "custom_name": custom_name or "",
                "account_name": target_user.full_name or "",
                "avatar_url": target_user.avatar_url or "",
                "phone": target_user.phone or "",
                "last_lat": lat,
                "last_lng": lng,
                "last_seen_at": last_seen,
                "is_sharing_location": is_sharing,
                "is_online": is_online,
                "sos_active": active_sos is not None,
                "sos_id": active_sos.id if active_sos else None
            }
        )

    return results