# Open Working Hours 🏥

A combined **Next.js 14 + FastAPI** project for hospitals to:

- onboard via email verification (`/verify`);
- review and plan shifts with an interactive calendar (`/data-ingestion`);
- publish neutral, desktop-first analytics (`/public-dashboard`);
- and route everything from a simple home/about hub (`/`).

The current UI uses React 19, Tailwind/shadcn components, and Recharts for the public dashboard. Backend endpoints (verification, reports, analytics) live under `/backend` and can be run locally during development.

> For a deeper architectural write-up, see [`blueprint.md`](./blueprint.md).

---

## Project Structure

```
app/                  # Next.js App Router pages (home, verify, ingestion, dashboard, calendar)
components/           # Shared UI and forms (VerificationForm, ReportForm, calendar views, etc.)
hooks/useAffiliationToken.ts
lib/                  # API client, calendar reducer/utilities, shared types
backend/              # FastAPI service (verification, reporting, analytics)
mobile-app/           # React Native app (geofencing, privacy-first tracking) [IN PROGRESS]
  └── MODULE_1_PROGRESS.md  # 📋 Detailed handoff documentation
config/, data/, datasets/  # Domain configuration + seed data
```

Key frontend entry points:
- `app/page.tsx` – home/about with navigation links.
- `app/verify/page.tsx` – request + confirm verification codes.
- `app/data-ingestion/page.tsx` – interactive calendar for shift planning and review, backed by `components/calendar-context.tsx`.
- `app/public-dashboard/page.tsx` – Recharts chart + collapsible hospital table.

---

## Requirements

- Node 18+
- pnpm (preferred) or npm
- Python 3.11 (for the FastAPI backend)
- Optional: Docker (see `backend/README.md`)

---

## Frontend Setup

```bash
# install deps (pnpm recommended)
pnpm install

# run Next.js dev server
pnpm dev

# lint
pnpm lint
```

Environment variables (create `.env.local`):
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
# or set NEXT_PUBLIC_API_PORT=8000 to infer protocol/host automatically
```

---

## Backend Setup (FastAPI)

```bash
# easiest: runs SQLite dev DB + uvicorn on port 8000
./scripts/start-backend.sh

# manual steps (if you prefer controlling the env)
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install .
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

See `backend/README.md` for database configuration, Docker Compose, and additional endpoints. The frontend expects the following routes:
- `POST /verification/request`
- `POST /verification/confirm`
- `POST /reports/`
- `GET /analytics/`

### Weekly Submission Smoke Test
- Follow [`docs/submission-smoke-test.md`](docs/submission-smoke-test.md) to verify the Expo app can submit a week and the backend stores it (SQLite fallback or Postgres).

---

## Temporary Mock Analytics API

Until the FastAPI backend is deployed, the Next.js app exposes a placeholder analytics endpoint at [`/api/analytics`](./app/api/analytics/route.ts). It returns deterministic mock data so the dashboard renders on Vercel, and should be removed or replaced as soon as a real backend is available. To point the frontend at your FastAPI instance, set `NEXT_PUBLIC_API_BASE_URL` (and optionally `API_BASE_URL`) to the live service URL; this automatically bypasses the mock.

---

## Primary Flows

1. **Email Verification**
   Users request a code, confirm it, and store an affiliation token (`hooks/useAffiliationToken.ts`).

2. **Data Ingestion (Open Review Calendar)**
   Interactive calendar for shift planning and review. Shift templates (name, start time, duration, color) can be edited or "armed". Instances snap to 5-minute increments, respect cross-midnight durations, and avoid overlaps (`lib/calendar-reducer.ts`, `components/week-view.tsx`).

3. **Public Dashboard**
   `app/public-dashboard/page.tsx` fetches `fetchAnalytics()` and renders a full-width Recharts chart with tooltips and a collapsible table of "Reports per hospital".

---

## Deployment

- **Frontend:** Deploy via Vercel or any Node-capable host (`pnpm build && pnpm start`).  
- **Backend:** Deploy FastAPI (e.g., Fly.io, Render, or Docker/VPS). Update `NEXT_PUBLIC_API_BASE_URL` accordingly.

---

## Mobile App (React Native)

**Status:** Module 1 in progress - Backend services complete (75% test coverage)

The mobile app provides automatic working hours tracking via geofencing. See **[mobile-app/MODULE_1_PROGRESS.md](./mobile-app/MODULE_1_PROGRESS.md)** for complete documentation.

**What's done:**
- ✅ Database layer (SQLite with geofence events, tracking sessions)
- ✅ Geofence service (expo-location wrapper, background tasks)
- ✅ Tracking manager (auto clock-in/out, notifications)
- ⏳ UI screens (pending)
- ⏳ iOS device testing (pending)

**Quick start:**
```bash
cd mobile-app
npm install
npm test          # Run tests (36/48 passing)
npm start         # Start Expo dev server
```

**Next steps:** Build UI screens and test on physical iOS device to validate geofencing reliability.

---

## Contributing / Next Steps

- Persist calendar templates/instances via the backend.
- Expand analytics filters and glossary tooltips.
- Improve mobile layouts + accessibility.
- Add Playwright tests for verification → ingestion → dashboard flows.

Open issues and ideas are tracked in [`to-do.md`](./to-do.md). Feel free to file GitHub issues or submit PRs if you build on top of this baseline.***

---

## License

This project is licensed under the [MIT License](./LICENSE).

Documentation and other non-code content may be shared under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
