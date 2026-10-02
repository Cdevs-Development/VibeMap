# Vibemap API Documentation v1

## Base URL

Development:

```
http://127.0.0.1:8000
```

---

# Authentication

## Register User

### Endpoint

```
POST /auth/register
```

### Purpose

Creates a new user account.

### Authentication

❌ Not Required

---

## Login

### Endpoint

```
POST /auth/login
```

### Purpose

Authenticates a user and returns a JWT access token.

### Authentication

❌ Not Required

---

## Get Current User

### Endpoint

```
GET /auth/me
```

### Purpose

Returns information about the authenticated user.

### Authentication

✅ Required

---

# Beneficiaries

## Create Beneficiary

### Endpoint

```
POST /beneficiaries/
```

### Purpose

Creates a new emergency contact.

### Authentication

✅ Required

---

## Get User Beneficiaries

### Endpoint

```
GET /beneficiaries/
```

### Purpose

Returns all beneficiaries belonging to the authenticated user.

### Authentication

✅ Required

---

## Update Beneficiary

### Endpoint

```
PUT /beneficiaries/{beneficiary_id}
```

### Purpose

Updates an existing beneficiary.

### Authentication

✅ Required

---

# Trips

## Start Trip

### Endpoint

```
POST /trips/start
```

### Purpose

Creates a new active trip and generates a share token.

### Authentication

✅ Required

---

## Get User Trips

### Endpoint

```
GET /trips/
```

### Purpose

Returns all trips belonging to the authenticated user.

### Authentication

✅ Required

---

## Get Single Trip

### Endpoint

```
GET /trips/{trip_id}
```

### Purpose

Returns details for a specific trip.

### Authentication

✅ Required

---

## End Trip

### Endpoint

```
POST /trips/{trip_id}/end
```

### Purpose

Marks a trip as completed.

### Authentication

✅ Required

---

## Public Trip Tracking

### Endpoint

```
GET /trips/public/{share_token}
```

### Purpose

Allows beneficiaries or external users to track a trip using its share token.

### Authentication

❌ Not Required

---

# Location Pings

## Create Location Ping

### Endpoint

```
POST /location-pings/
```

### Purpose

Records a GPS update and updates the trip's current location.

### Authentication

✅ Required

---

## Get Trip Location History

### Endpoint

```
GET /location-pings/{trip_id}
```

### Purpose

Returns all recorded GPS pings for a trip.

### Authentication

✅ Required

---

# SOS

## Trigger SOS

### Endpoint

```
POST /sos/
```

### Purpose

Creates an SOS event linked to the user and optionally a trip.

### Authentication

✅ Required

---

## Get User SOS Events

### Endpoint

```
GET /sos/
```

### Purpose

Returns all SOS events belonging to the authenticated user.

### Authentication

✅ Required

---

## Resolve SOS Event

### Endpoint

```
POST /sos/{sos_id}/resolve
```

### Purpose

Marks an SOS event as resolved and stores a resolution note.

### Authentication

✅ Required

---

# Vibe Pins

## Create Vibe Pin

### Endpoint

```
POST /vibe-pins/
```

### Purpose

Creates a new community vibe report.

### Authentication

✅ Required

---

## Get Active Vibe Pins

### Endpoint

```
GET /vibe-pins/
```

### Purpose

Returns all active vibe pins.

### Authentication

❌ Not Required

---

## Confirm Vibe Pin

### Endpoint

```
POST /vibe-pins/{pin_id}/confirm
```

### Purpose

Increases the confirmation count for a vibe pin.

### Authentication

❌ Not Required

---

## Deactivate Vibe Pin

### Endpoint

```
DELETE /vibe-pins/{pin_id}
```

### Purpose

Deactivates a vibe pin owned by the authenticated user.

### Authentication

✅ Required

---

# Authentication Requirements

Protected endpoints require:

```
Authorization: Bearer <JWT_TOKEN>
```

The token is obtained from:

```
POST /auth/login
```

---

# Current Backend Modules

* Authentication
* Beneficiaries
* Trips
* Location Pings
* SOS
* Vibe Pins
* Public Trip Tracking

---

# Backend Status

Authentication      ✅
Beneficiaries       ✅
Trips               ✅
Location Tracking   ✅
SOS                 ✅
Vibe Pins           ✅
Public Sharing      ✅
JWT Security        ✅
CORS Enabled        ✅

Backend Version: v1 Complete
