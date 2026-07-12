# AssetFlow — Enterprise Asset & Resource Management System

A centralized ERP platform to track, allocate, and maintain physical assets and
shared resources. Built for the Odoo hackathon.

AssetFlow lets any organization maintain departments, asset categories and an
employee directory; track assets through a full lifecycle; allocate assets with
conflict handling; book shared resources without overlaps; run a maintenance
approval workflow; run structured audit cycles; and surface overdue returns,
bookings and maintenance through notifications and a KPI dashboard.

## Tech Stack

- **Backend:** FastAPI (Python) + SQLAlchemy + PostgreSQL, JWT auth, role-based access
- **Frontend:** React + Vite + React Router + Axios
- **Auth:** email/password with JWT, bcrypt password hashing

## Features (mapped to the 10 screens)

| # | Screen | Status |
|---|--------|--------|
| 1 | Login / Signup (signup creates Employee only, no self-elevation) | ✅ |
| 2 | Dashboard with KPI cards + overdue returns + quick actions | ✅ |
| 3 | Organization Setup — Departments / Categories / Employee Directory (role assignment) | ✅ |
| 4 | Asset Registration & Directory (auto tag `AF-0001`, search/filter, history) | ✅ |
| 5 | Allocation & Transfer (conflict rule, transfer approval, return, overdue) | ✅ |
| 6 | Resource Booking (time-slot with overlap validation) | ✅ |
| 7 | Maintenance (Pending → Approved → Assigned → In Progress → Resolved) | ✅ |
| 8 | Asset Audit (cycles, auditors, mark verified/missing/damaged, discrepancy report, close) | ✅ |
| 9 | Reports & Analytics (utilization, idle assets, maintenance by category, booking heatmap) | ✅ |
| 10 | Activity Logs & Notifications | ✅ |

## Roles

- **Admin** — organization setup, role assignment, org-wide analytics
- **Asset Manager** — registers/allocates assets, approves transfers/maintenance/returns
- **Department Head** — views/approves within their department, books on its behalf
- **Employee** — views own assets, books resources, raises maintenance, initiates returns/transfers

Roles are **only** assigned by an Admin in the Employee Directory — never at signup.

## Getting Started

### 1. Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate            # Windows  (source venv/bin/activate on macOS/Linux)
pip install -r requirements.txt

# configure the database
copy .env.example .env           # then edit DATABASE_URL with your Postgres password

python seed.py                   # creates tables + demo data
uvicorn app.main:app --reload    # http://127.0.0.1:8000  (docs at /docs)
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                      # http://127.0.0.1:5173
```

## Demo Logins

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@assetflow.com | admin123 |
| Asset Manager | manager@assetflow.com | manager123 |
| Department Head | head@assetflow.com | head123 |
| Employee | priya@assetflow.com | priya123 |
| Employee | raj@assetflow.com | raj123 |

## Key Business Rules

- **No double allocation** — allocating an already-held asset returns `409` with the
  current holder and offers a Transfer Request instead.
- **No overlapping bookings** — `9:00–10:00` blocks `9:30–10:30`, but `10:00–11:00` is
  allowed (adjacent slots are fine).
- **Maintenance gating** — an asset only flips to *Under Maintenance* after approval,
  and back to *Available* on resolution.
- **Audit close** — confirmed-missing assets are automatically set to *Lost*.

## Project Structure

```
backend/
  app/
    main.py          # FastAPI app + router wiring
    database.py      # SQLAlchemy engine/session
    models.py        # ORM models
    schemas.py       # Pydantic schemas
    auth.py          # JWT + bcrypt + role guards
    utils.py         # activity log / notifications / tag generation
    routers/         # auth, org, assets, allocations, bookings,
                     # maintenance, audits, dashboard, notifications
  seed.py            # demo data
frontend/
  src/
    api.js, auth.jsx # axios client + auth context
    components/       # Layout, shared UI
    pages/            # one file per screen
```
