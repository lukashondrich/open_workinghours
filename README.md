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
backend/              # Legacy FastAPI service (verification, reporting, analytics)
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
cd backend
pip install -r requirements.txt  # or poetry install
uvicorn main:app --reload --port 8000
```

See `backend/README.md` for database configuration, Docker Compose, and additional endpoints. The frontend expects the following routes:
- `POST /verification/request`
- `POST /verification/confirm`
- `POST /reports/`
- `GET /analytics/`

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
