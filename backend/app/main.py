# =====================================================
# IMPORTS
# =====================================================

from fastapi import FastAPI

from fastapi.middleware.cors import (
    CORSMiddleware
)

from slowapi.errors import (
    RateLimitExceeded
)

from slowapi.middleware import (
    SlowAPIMiddleware
)

from slowapi import (
    _rate_limit_exceeded_handler
)

from app.database.database import (
    Base,
    engine
)

from app.security.rate_limiter import (
    limiter
)

import app.database.models


# =====================================================
# CREATE DATABASE TABLES
# =====================================================

Base.metadata.create_all(
    bind=engine
)

# =====================================================
# AUTO-MIGRATE COLUMNS FOR EXISTING TABLES
# =====================================================

def run_database_migrations():
    from sqlalchemy import text
    migrations = [
        ("users", "location_sharing", "BOOLEAN DEFAULT TRUE"),
        ("users", "last_known_lat", "VARCHAR(50)"),
        ("users", "last_known_lng", "VARCHAR(50)"),
        ("users", "last_location_accuracy", "VARCHAR(50)"),
        ("users", "last_location_updated_at", "TIMESTAMP"),
        ("users", "avatar_url", "TEXT"),
        ("users", "sos_pin_hash", "TEXT"),
        ("sos_events", "acknowledged_at", "TIMESTAMP"),
        ("sos_events", "acknowledging_beneficiary_name", "VARCHAR(255)"),
    ]
    try:
        with engine.begin() as conn:
            for table, col, col_type in migrations:
                try:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_type};"))
                except Exception:
                    try:
                        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type};"))
                    except Exception:
                        pass
            # Ensure vibe_confirmations table exists
            try:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS vibe_confirmations (
                        id VARCHAR(36) PRIMARY KEY,
                        vibe_pin_id VARCHAR(36) NOT NULL,
                        user_id VARCHAR(36) NOT NULL,
                        created_at TIMESTAMP NOT NULL,
                        CONSTRAINT uq_vibe_pin_user_confirmation UNIQUE (vibe_pin_id, user_id)
                    );
                """))
            except Exception as e:
                print(f"[DB vibe_confirmations table creation] {e}")
    except Exception as e:
        print(f"[DB Migration Warning] {e}")

run_database_migrations()


# =====================================================
# ROUTES
# =====================================================

from app.routes.auth import (
    router as auth_router
)

from app.routes.users import (
    router as users_router
)

from app.routes.notifications import (
    router as notifications_router
)

from app.routes.beneficiaries import (
    router as beneficiary_router
)

from app.routes.trips import (
    router as trips_router
)

from app.routes.location_pings import (
    router as location_ping_router
)

from app.routes.sos import (
    router as sos_router
)

from app.routes.vibe_pins import (
    router as vibe_pin_router
)

from app.routes.websocket_tracking import (
    router as websocket_router
)

from app.routes.admin import (
    router as admin_router,
    public_legal_router
)


# =====================================================
# APP
# =====================================================

app = FastAPI(
    title="Vibemap API",
    version="1.0.0"
)


# =====================================================
# RATE LIMITING
# =====================================================

app.state.limiter = limiter

app.add_exception_handler(
    RateLimitExceeded,
    _rate_limit_exceeded_handler
)

app.add_middleware(
    SlowAPIMiddleware
)


# =====================================================
# CORS
# =====================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://vibemap.tech",
        "https://www.vibemap.tech",
        "https://vibemap-frontend-dusky.vercel.app",
        "https://vibemap-frontend-thd6.onrender.com",
        "https://vibemap-backend-9q3z.onrender.com",
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4173",
        "https://localhost",
        "capacitor://localhost",
        "ionic://localhost",
        "http://localhost",
        "https://vibemap-adminpage.onrender.com"

    ],
    allow_origin_regex=r"https?://.*(\.onrender\.com|\.vercel\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =====================================================
# ROUTER REGISTRATION
# =====================================================

app.include_router(
    auth_router,
    prefix="/api/auth"
)

app.include_router(
    users_router,
    prefix="/api/users"
)

app.include_router(
    notifications_router,
    prefix="/api/notifications"
)

app.include_router(
    beneficiary_router,
    prefix="/api/beneficiaries"
)

app.include_router(
    trips_router,
    prefix="/api/trips"
)

app.include_router(
    location_ping_router,
    prefix="/api/location-pings"
)

app.include_router(
    sos_router,
    prefix="/api/sos"
)

app.include_router(
    vibe_pin_router,
    prefix="/api/vibe-pins"
)

app.include_router(
    admin_router,
    prefix="/api"
)

app.include_router(
    public_legal_router,
    prefix="/api"
)


app.include_router(
    websocket_router
)


# =====================================================
# ROOT
# =====================================================

@app.get("/")
def root():

    return {
        "message": "Vibemap API Running"
    }