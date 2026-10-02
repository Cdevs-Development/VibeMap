# Vibemap Codebase — Bug Audit Report

This document outlines the findings of a comprehensive code audit performed on the Vibemap workspace, detailing 22 identified issues across different severity levels and their corresponding resolutions.

---

## 🔴 Critical Bugs (Fixed)

### 1. User Model Relationship Indentation
* **File:** `backend/app/database/models/user.py`
* **Issue:** The relationship fields `trips`, `vibe_pins`, and `sos_events` were defined outside the `User` class block due to zero indentation.
* **Resolution:** Correctly indented them under the `User` class to register them as SQLAlchemy attributes.

### 2. Missing Database Configuration Fallbacks
* **File:** `backend/app/database/database.py`
* **Issue:** `DATABASE_URL = os.getenv("DATABASE_URL")` evaluated to `None` if the `.env` file was missing, causing immediate startup crashes.
* **Resolution:** Added a local SQLite fallback: `sqlite:///./vibemap.db`.

### 3. Parse Crashes on Missing Env Variables
* **File:** `backend/app/security/jwt.py`
* **Issue:** `int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))` crashed the application on startup if the variable was not present in the environment.
* **Resolution:** Defaulted token expiration to 30 minutes: `int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))`.

### 4. JWT Key and Algorithm Validation
* **Files:** `backend/app/security/jwt.py`, `backend/app/security/auth.py`
* **Issue:** Secret key and signature algorithms evaluated to `None` if `.env` was missing, breaking authorization.
* **Resolution:** Configured robust default development fallbacks (`HS256` and a development secret key).

### 5. Missing `email-validator` Dependency
* **File:** `backend/requirements.txt`
* **Issue:** Pydantic v2's `EmailStr` schema threw an `ImportError` because `email-validator` was not declared in the python requirements.
* **Resolution:** Added `email-validator>=2.0.0` to the requirements.

### 6. Broken Import in Database Connection Tester
* **File:** `backend/app/database/test_connection.py`
* **Issue:** Relative import `from database import engine` crashed when executing from the project root.
* **Resolution:** Updated to absolute package import: `from app.database.database import engine`.

---

## 🟠 High Severity Bugs (Fixed)

### 7. Missing CORS Middleware
* **File:** `backend/app/main.py`
* **Issue:** No CORS headers were returned, which blocked the React frontend (`localhost:5173`) from contacting the API.
* **Resolution:** Installed and configured FastAPI's `CORSMiddleware`.

### 8. Route Matching Collision
* **File:** `backend/app/routes/trips.py`
* **Issue:** The generic `/{trip_id}` route was declared before the `/public/{share_token}` route, rendering the public route unreachable.
* **Resolution:** Reordered routes so `/public/{share_token}` is matched first.

### 9. Database Entity Serialization Leak/Errors
* **Files:** Multiple route controllers
* **Issue:** Routes returned raw database models directly, leading to serialization issues and data leaks.
* **Resolution:** Created Pydantic response models (`UserResponse`, `TripResponse`, etc.) and defined them as the `response_model` on all read endpoints.

### 10. Vibe Pin Confirmation Security
* **File:** `backend/app/routes/vibe_pins.py`
* **Issue:** The `/confirm` route was open to anonymous users, allowing spam upvoting.
* **Resolution:** Secured the endpoint behind the user authentication dependency.

### 11. Standalone SOS Coordinates
* **File:** `backend/app/routes/sos.py`
* **Issue:** SOS triggers without a trip ID defaulted location coordinates to `0, 0`.
* **Resolution:** Updated `SOSCreate` and route logic to accept client-provided lat/lng fields when no active trip is running.

### 12. SQLite Tables Not Initialized
* **File:** `backend/app/main.py`
* **Issue:** Tables were never created programmatically in the local SQLite file.
* **Resolution:** Configured `Base.metadata.create_all(bind=engine)` to execute on application startup.

### 13. Passlib Bcrypt Python 3.13 Compatibility Crash
* **File:** `backend/app/security/hashing.py`
* **Issue:** `passlib` crashed on check-version operations under Python 3.13 with `ValueError: password cannot be longer than 72 bytes`.
* **Resolution:** Swapped `passlib` for direct `bcrypt` package calls, resolving compatibility issues.

---

## 🟡 Medium Severity Bugs (Fixed)

### 14. Deprecated Date Utility
* **Files:** `backend/app/services/vibe_pin_service.py`, `backend/app/security/jwt.py`
* **Issue:** `datetime.utcnow()` is deprecated and raises warning banners in Python 3.12+.
* **Resolution:** Replaced with safe timezone UTC calls: `datetime.now(timezone.utc).replace(tzinfo=None)`.

### 15. Active Pins Ignoring Expiry
* **File:** `backend/app/services/vibe_pin_service.py`
* **Issue:** The active pins listing returned all active pins, ignoring their 24-hour expiration threshold.
* **Resolution:** Updated filter query to check `expires_at > current_time`.

### 16. Dead Import Cleanup
* **Files:** `auth.py`, `sos.py`, `location_pings.py`
* **Issue:** Unused imports (e.g. `Header`, `Trip`) cluttered the headers.
* **Resolution:** Cleaned up unused imports across all router files.
