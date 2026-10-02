# Vibemap Developer Onboarding & Local Setup Guide

Welcome to the Vibemap development team! This guide will help you set up the entire stack (Frontend, Backend, and Database) locally on your machine.

---

## 1. Prerequisites

Before you begin, ensure you have the following software installed:

*   **Node.js**: Version `18.x` or `20.x` (LTS recommended)
*   **NPM**: Version `9.x` or higher
*   **Python**: Version `3.9` to `3.12`
*   **Database**: **MySQL** `5.7+` or **MariaDB** `10.1+` (tested with MariaDB `10.1.37`)
*   **Git**: For version control

---

## 2. Database Setup

We use MySQL/MariaDB for relational data storage. Follow these steps to initialize your database:

### Create the Database
1.  Start your local MySQL/MariaDB server.
2.  open the vibemap.sql in your mysql ide and run the file

## 3. Backend Setup (FastAPI)

The backend is built with FastAPI and SQLAlchemy. Follow these steps to get it running:

### Step 1: Clone the Repo & Navigate
If you haven't already, clone the repository and navigate to the backend directory:
```bash
git clone https://github.com/your-org/vibemap-frontend.git
cd vibemap-frontend/backend
```



### Step 4: Install Dependencies
Upgrade pip and install requirements:
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### Step 5: Configure Environment Variables
Copy the backend environment example file to create your local `.env`:
```bash
cp .env.example .env
```
Open the newly created `.env` file. You must add the `DATABASE_URL` variable, which the database engine expects:
```env
DATABASE_URL=mysql+pymysql://<db_user>:<db_password>@<db_host>:<db_port>/<db_name>
SECRET_KEY=your_super_secret_jwt_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

#### Example `.env` Configuration:
```env
DATABASE_URL=mysql+pymysql://root:password123@localhost:3306/vibemap
SECRET_KEY=vibemap_secret_key_change_this_in_production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```





### Step 6: Start the FastAPI Server
Launch the development server with hot-reloading:
```bash
uvicorn app.main:app --reload or python -m uvicorn app.main:app --reload
```
The server will be available at `http://127.0.0.1:8000`. You can inspect the interactive documentation at `http://127.0.0.1:8000/docs`.

---

## 4. Frontend Setup (React/Vite)

The frontend is a React application built with Vite and Capacitor.

### Step 1: Navigate to the Frontend Root
From the backend folder, go back to the root of the project:
```bash
cd ..
```

### Step 2: Install npm Packages
```bash
npm install
```

### Step 3: Configure Environment Variables
Create a `.env` file at the root of the frontend folder:
```bash
# On Windows (PowerShell)
New-Item .env
# On macOS / Linux
touch .env
```

Add the following environment variables:
```env
VITE_MAPTILER_KEY=[Maptiler API key]
VITE_API_BASE_URL=[Your Backend URL]
VITE_SOCKET_URL=[Your Backend URL]
```
*   `VITE_MAPTILER_KEY`: The API key used for loading interactive maps.
*   `VITE_API_BASE_URL`: Endpoint of your local FastAPI backend server.
*   `VITE_SOCKET_URL`: Endpoint of your local WebSocket connection for tracking.

### Step 4: Start the Frontend Dev Server
Run the Vite development server:
```bash
npm run dev
```
The frontend application will be hosted locally at `http://localhost:5173`. Open this URL in your web browser.


## 🛡️ Code Audit & Bug Fixes (June 2026)

This repository has undergone a comprehensive workspace audit to address 22 backend bugs across Critical, High, and Medium severity levels.
All fixes have been successfully implemented and verified. For detailed findings, refer to the [Bug Audit Report](BUG_AUDIT.md).

Key fixes include:
- Resolved SQLAlchemy model indentation errors that caused attribute retrieval crashes.
- Configured local SQLite defaults and auto-initialization of DB tables on startup.
- Safe defaults for token expiration (30 mins), secret keys, and JWT configurations.
- Fixed Python 3.13 / `passlib` compatibility crash by replacing `passlib` with native `bcrypt`.
- Secured Vibe Pin confirmation and supported custom locations on standalone SOS triggers.
- Configured CORS middleware to allow connection from the React frontend.

## 🚀 Frontend Feature Updates (July 2026)

Following the backend audit, the React frontend underwent a major UX and stability refactor:
- **Global Rate Limiting (429 Handling)**: Implemented a robust Axios response interceptor that triggers a friendly UI toast when the backend enforces rate limits.
- **Two-Step Vibe Reporting Wizard**: Refactored the `ReportVibe` form from manual text inputs into an intuitive two-step wizard, integrating an interactive map canvas with click-to-pin and geocoding search functionality.
- **Map UX Improvements**: Fixed missing map container heights, upgraded critical UI icons (e.g., dynamic Traffic 🚦 markers), and stabilized the `MapScreen` marker implementations.
- **Vibe Pin Interactivity**: Rewrote the Vibe Pin map modals to cleanly display pin categories, notes, and community confirmations. Fully wired up the `Confirm`, `Delete` (with optimistic instant UI removal), and `Get Directions` routing logic.
- **SOS Flow Enhancements**: Updated SOS success handlers to correctly parse and iterate over the new `notification_results` payload structure.

