# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ระบบขยายเขตผู้ใช้น้ำ กปภ.เขต 6** — A dashboard for tracking, cost-benefit analysis, and geographic mapping of water supply expansion projects under PWA (Provincial Waterworks Authority) Area 6 (Northeast Thailand), covering 8 strategic branches.

## Tech Stack

This project does **not** use Next.js or TypeScript. The actual stack is:

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TailwindCSS v4 |
| Charts | Recharts |
| Map | Leaflet.js |
| Icons | Lucide React |
| Backend | Node.js + Express (CommonJS) |
| Database | MySQL 8.4, database: `pwa6_expansion`, port `3306` |

## Docker (recommended)

```bash
# Build and run both services
docker-compose up --build

# App is available at http://localhost:3000
# Backend API is internal-only (not exposed outside Docker network)
```

The backend reads DB credentials from `backend/.env`. MySQL at `192.168.60.31` is reached directly from the backend container (external host, no container needed).

## Commands (local dev without Docker)

### Frontend (run from `frontend/`)
```bash
npm run dev      # Vite dev server → http://localhost:5173
npm run build    # Production build to dist/
npm run lint     # ESLint check
npm run preview  # Preview production build
```

### Backend (run from `backend/`)
```bash
npm run dev      # Start API server → http://localhost:5000
npm start        # Same as dev (no nodemon — restarts manually)
```

### Database Utilities (run from `backend/`)
```bash
node seed.js     # Create schema + seed mock data (safe to re-run)
node migrate.js  # Migrate from PCIS source data (pcis.sql must be imported first)
node test_db.js  # Test MySQL connection
```

Backend requires a `.env` file in `backend/` with:
```
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_DATABASE=pwa6_expansion
```
If `.env` is absent, defaults to `root` with empty password on `127.0.0.1:3306`.

## Architecture

### Monorepo layout
```
├── backend/         # Express API + DB connection pool
│   ├── server.js    # All API routes (6 endpoints)
│   ├── db.js        # MySQL connection pool with auto-create database
│   ├── seed.js      # DDL schema + mock data seeder
│   └── migrate.js   # Migrates from PCIS source tables to dashboard tables
├── frontend/
│   └── src/
│       └── App.jsx  # Entire frontend (~1600 lines, single monolithic component)
└── index.html       # Static landing page (not part of the Vite app)
```

### Frontend: Single-Component Architecture
The entire frontend lives in **`frontend/src/App.jsx`** — there are no separate component files. All state, data fetching, map logic, and rendering is colocated in one `App()` function with inline subcomponents. When adding features, add them within this file following the existing patterns.

The app has three tabs driven by `currentTab` state:
- `'projects'` — Project overview with interactive Leaflet map and sortable/paginated data table
- `'monthly'` — Monthly performance matrix grid with drill-down and trend chart
- `'breakeven'` — Break-even analysis with per-project deep-dive selector

### Backend: Express REST API
All routes are in `backend/server.js`. The API base is `http://localhost:5000/api`.

| Endpoint | Description |
|----------|-------------|
| `GET /api/branches` | All PWA branches |
| `GET /api/projects` | All projects with `total_actual_users` and `achievement_rate` computed |
| `GET /api/monthly-data?branch=&year=&type=` | Monthly stats (filterable) |
| `GET /api/project-breakeven/:project_code` | Project + yearly performance for break-even chart |
| `GET /api/project-customers/:project_code` | Water users with GPS coordinates for a project |
| `GET /api/customers-coordinates?branch=&year=&type=` | All GPS coords (max 1500, filterable) |

### Database Schema

**Dashboard tables** (managed by `seed.js`):
- `pwa_branches` — Branch name + province
- `projects` — Project master data: `project_code` (PK), `contract_no`, `branch_name`, `project_type`, `start_year`, `completion_year`, `budget`, `target_users`
- `monthly_actual_users` — Monthly meter connection counts per project (unique on `project_code + fiscal_year + month_number`)
- `project_yearly_performance` — Annual cumulative target vs. actual for break-even calculation

**PCIS source tables** (imported externally via `pcis.sql`):
- `customer` — Water user records with `cus_code`, `fullName`, `LATITUDE`, `LONGITUDE`, `full_address`, `meter_no`, `status`, etc.
- `proj_cus` — Junction table linking `project_no_proj` (contract_no) to `custcode` (cus_code)

The join between PCIS and dashboard tables uses `CONVERT(...USING utf8mb4) COLLATE utf8mb4_unicode_ci` to handle charset collation mismatches between the two data sources.

## Domain Conventions

**Thai fiscal year**: October (month 10) to September (month 9) of the following calendar year. Month ordering in the UI starts at October (`month_number = 10`).

**Project types** (`project_type` integer):
- `1` = งบลงทุน (Capital budget)
- `2` = งบอุดหนุน (Subsidy budget)
- `3` = งบกระตุ้นเศรษฐกิจ (Economic stimulus)
- `4` = วางท่อเข้าซอย (Soi pipe laying — 1-year break-even criterion; types 1–3 use 5-year criterion)

**Break-even logic**: Types 1–3 have a 5-year payback target with percentage allocations per year (completion year + years 1–5). Type 4 has a 1-year payback target. Target allocation percentages are stored in `project_yearly_performance.target_percentage`.

**Map**: Uses Leaflet with a custom icon for project markers and teal/turquoise markers for individual water user pins. The `leafletMapInstanceRef` ref holds the live Leaflet map instance for programmatic pan/zoom.
