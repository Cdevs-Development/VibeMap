Vibemap Backend Architecture Map
Root Structure
backend/
│
├── app/
│   ├── database/
│   ├── models/
│   ├── routes/
│   ├── schemas/
│   ├── services/
│   ├── security/
│   ├── middleware/
│   ├── utils/
│   └── main.py
│
├── requirements.txt
└── .env
Entry Point
app/main.py
Purpose

Application bootstrap.

Responsibilities
Creates FastAPI app
Registers routers
Starts API
Current Routers
auth_router
beneficiary_router
trips_router
location_ping_router
sos_router
vibe_pin_router
DATABASE LAYER
app/database/database.py
Purpose

Creates SQLAlchemy Base.

Used By
Every model
app/database/connection.py
Purpose

Database connection.

Responsibilities
Create Engine
Create SessionLocal
Provide get_db()
Used By
Every route
Every service
MODELS
app/database/models/user.py
Table
users
Purpose

Main user account.

Relationships
User
├── Beneficiaries
├── Trips
├── SOS Events
└── Vibe Pins
app/database/models/beneficiary.py
Table
beneficiaries
Purpose

Emergency contacts.

Used By
SOS notifications
Trip sharing
Emergency escalation
app/database/models/trip.py
Table
trips
Purpose

Travel session tracking.

Stores
Origin
Destination
Current Location
Status
Share Token
Last Ping
Status Values
active
completed
cancelled
sos_active
app/database/models/location_ping.py
Table
location_pings
Purpose

GPS history.

Stores
Raw GPS
Smoothed GPS
Accuracy
Speed
Heading
Timestamp
app/database/models/sos_event.py
Table
sos_events
Purpose

Emergency alerts.

Stores
User
Trip
GPS location
Status
Resolution
Status Values
active
resolved
cancelled
app/database/models/vibe_pin.py
Table
vibe_pins
Purpose

Community reports.

Categories
party
wedding
construction
unsafe
market
traffic
ROUTES

Routes only handle:

HTTP Request
Validation
Authentication
Response

Business logic belongs in services.

app/routes/auth.py
Responsibilities
Register User
Login User
Get Current User
JWT Validation Testing
Endpoints
POST /auth/register
POST /auth/login
GET  /auth/me
app/routes/beneficiaries.py
Responsibilities
Create Beneficiary
List Beneficiaries
Update Beneficiary
Endpoints
POST /beneficiaries/
GET  /beneficiaries/
PUT  /beneficiaries/{id}
app/routes/trips.py
Responsibilities
Start Trip
Get Trips
Get Single Trip
End Trip
Public Trip Tracking
Endpoints
POST /trips/start
GET  /trips/
GET  /trips/{id}
POST /trips/{id}/end
GET  /trips/public/{share_token}
app/routes/location_pings.py
Responsibilities
Store GPS Updates
Update Trip Location
View GPS History
Endpoints
POST /location-pings/
GET  /location-pings/{trip_id}
app/routes/sos.py
Responsibilities
Trigger SOS
Resolve SOS
View SOS Events
Endpoints
POST /sos/
GET  /sos/
POST /sos/{id}/resolve
app/routes/vibe_pins.py
Responsibilities
Create Pins
View Pins
Confirm Pins
Deactivate Pins
Endpoints
POST   /vibe-pins/
GET    /vibe-pins/
POST   /vibe-pins/{id}/confirm
DELETE /vibe-pins/{id}
SCHEMAS

Schemas validate incoming API requests.

app/schemas/user_schema.py
UserRegister
UserLogin
app/schemas/beneficiary_schema.py
BeneficiaryCreate
BeneficiaryUpdate
app/schemas/trip_schema.py
TripCreate
TripEnd
app/schemas/location_ping_schema.py
LocationPingCreate
app/schemas/sos_event_schema.py
SOSCreate
SOSResolve
app/schemas/vibe_pin_schema.py
VibePinCreate
SERVICES

This is where business logic lives.

Routes should call services.

app/services/user_service.py
Responsibilities
Find User By ID
Find User By Phone
app/services/beneficiary_service.py
Responsibilities
Get Beneficiaries
Get Beneficiary
app/services/trip_service.py
Responsibilities
Get User Trips
Get Trip By ID
Get Trip By Share Token
app/services/location_ping_service.py
Responsibilities
Get Trip Ping History
app/services/sos_event_service.py
Responsibilities
Get SOS Events
Get SOS Event
app/services/vibe_pin_service.py
Responsibilities
Get Active Pins
Get Pin
app/services/sms_service.py
Status
Placeholder
Future
Termii
Twilio
Africa's Talking
app/services/notification_service.py
Status
Placeholder
Future
Push Notifications
SMS
Email
SECURITY
app/security/hashing.py
Responsibilities
Hash Password
Verify Password
app/security/jwt.py
Responsibilities
Create JWT Token
app/security/auth.py
Responsibilities
Validate JWT
Get Current User ID
Protect Routes
CURRENT FEATURE FLOW
User
│
├── Register
├── Login
│
├── Beneficiaries
│
├── Start Trip
│   │
│   ├── Location Pings
│   │
│   ├── Share Token
│   │
│   └── SOS
│
└── Vibe Pins