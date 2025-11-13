# Open Working Hours – System Blueprint

## 1. Purpose & Scope
The repo combines a **Next.js 14 App Router frontend** (React 19, pnpm, Tailwind/shadcn) with the legacy **FastAPI backend** found in `backend/`. It delivers a neutral, desktop-first experience that walks a hospital partner through:
- landing on the home/about entry point (`app/page.tsx`);
- verifying an email + affiliation (`app/verify/page.tsx`, `components/verification-form.tsx`);
- ingesting staffing reports once verified (`app/data-ingestion/page.tsx`, `components/report-form.tsx`);
- exploring aggregated reports on the public dashboard (`app/public-dashboard/page.tsx`);
- planning typical shifts in the calendar (`app/calendar/page.tsx` plus calendar components).

The blueprint explains how these flows fit together, which files own the responsibility, and how to continue iterating without re-reading the entire repository.

## 2. High-level Architecture
| Layer | Purpose | Key files |
| --- | --- | --- |
| Routing & Layout | Next.js App Router, shared metadata, font/theme providers. | `app/layout.tsx`, `components/theme-provider.tsx`, `app/globals.css` |
| Navigation Shell | Home/about hub with links to verify, ingest, dashboard, calendar. | `app/page.tsx` |
| Verification Flow | Request + confirm codes, capture affiliation token. | `app/verify/page.tsx`, `components/verification-form.tsx`, `hooks/useAffiliationToken.ts` |
| Data Ingestion Flow | Submit shift reports with token-backed API calls. | `app/data-ingestion/page.tsx`, `components/report-form.tsx` |
| Public Dashboard | Recharts-based line+area chart, collapsible “Reports per hospital” table. | `app/public-dashboard/page.tsx` |
| Calendar Planner | Template bar, week grid, context/reducer for shift instances. | `app/calendar/page.tsx`, `components/calendar-context.tsx`, `components/week-view.tsx`, `components/shift-template-panel.tsx`, `lib/calendar-reducer.ts` |
| API Client | Shared fetch wrapper, analytics + verification/report helpers. | `lib/backend-api.ts` |
| Styling | Tailwind config via `globals.css`, shadcn primitives, neutral palette tokens. | `app/globals.css`, `components/ui/*` |
| Backend (FastAPI) | Verification/reports/analytics endpoints. | `backend/` (see `backend/README.md`) |

## 3. User Flows & Data
### 3.1 Verification → Data Ingestion
1. **Request**: `VerificationForm` posts to `/verification/request` via `requestVerification()` (`lib/backend-api.ts`). Success echoes a toast and hints at email delivery.
2. **Confirm**: Same component handles code submission using `confirmVerification()`, storing `affiliation_token` in `useAffiliationToken`.
3. **Reporting**: `ReportForm` (data-ingestion page) loads the stored token, validates required fields (date, actual hours, overtime, staff group, notes), and calls `submitReport()` with the token header. Validation hints and success toasts guide the user.
4. **Dependencies**: Requires `NEXT_PUBLIC_API_BASE_URL` or `NEXT_PUBLIC_API_PORT` for the backend origin. Default fallback is `http://localhost:8000`, so run `uvicorn main:app --reload` inside `backend/` while developing.

### 3.2 Public Dashboard
- Fetches analytics through `fetchAnalytics({ months, staffGroup })` (default 6 months).
- Uses Recharts (LineChart/AreaChart) for the neutral palette visualization, stretching full width (`app/public-dashboard/page.tsx#L18` onward).
- Tooltips define each metric; legend and axis labels follow the same copy as the backend data dictionary.
- “Reports per hospital” table uses a native `<details>` disclosure to stay collapsed by default while the chart occupies full width. Table rows key on `domain-month-group-index` to prevent duplicate React keys.

### 3.3 Calendar Planner
- **State container**: `CalendarProvider` (`components/calendar-context.tsx`) wires a reducer defined in `lib/calendar-reducer.ts`. State slices:
  - `templates`: reusable shifts with `id`, `label`, `startTime`, `durationMinutes`, and `color`.
  - `armedTemplateId`: selecting a template puts the UI into placement mode; editing widgets stay hidden when armed.
  - `instances`: placed shifts store `date`, `startTime`, computed `endTime`, color, template metadata, drag offsets, and move buttons for precise 5‑minute adjustments.
  - `trackingRecords`: mock compliance entries for review mode in `week-view.tsx`.
- **Interactions**:
  - Floating “+” button reveals template slots with two zones: edit (pencil icon) vs arm (crosshair icon). Editing opens a side sheet with name, color, start time, and hour/minute duration controls. Arming hides the editor and enables placement on the x (day) / y (time) grid.
  - Instances snap to 5-minute increments; reducer prevents overlaps.
  - Multi-day support: `placeShift` splits across midnight when `startTime + duration` exceeds 24h but maintains a single logical instance tracked by `date` + `endTime`.
  - Week view calculates chronological z-index using both `startTime` and `endTime` so stacked overlaps are deterministic.
- **Files to inspect**: `components/week-view.tsx`, `components/shift-template-panel.tsx`, `lib/calendar-utils.ts`, `lib/types.ts`.

## 4. Backend & Environment
- Backend stack remains in `/backend` (FastAPI, SQLModel). Use `backend/README.md` for setup, environment variables, and Docker instructions.
- `.env` samples live under `/backend/.env` and root `.env` (front-end). The frontend expects:
  - `NEXT_PUBLIC_API_BASE_URL` (or `NEXT_PUBLIC_API_PORT`) for the API origin;
  - optional `NEXT_PUBLIC_APP_NAME`, palette overrides, etc., if defined in `app/layout.tsx`.
- Allowed domains used by analytics are stored under `config/allowed_domains.txt`; ingestion/verification rely on the backend to enforce these.

## 5. Developer Workflow
1. **Install deps**: `pnpm install` (preferred). If npm is required, use `npm install --legacy-peer-deps` because `vaul@0.9.9` expects React ≤18.
2. **Run frontend**: `pnpm dev` (or `npm run dev`) from repo root; serves on `http://localhost:3000`.
3. **Run backend**: `cd backend && uvicorn main:app --reload` (make sure poetry/pip deps are installed). Align CORS + origin env vars.
4. **Lint/Test**: `pnpm lint`. Calendar reducer has unit-ready helpers in `lib/calendar-utils.ts` if future tests are added.
5. **Data**: Static seeds for the dashboard live in `data/` and `datasets/`; update backend analytics to change chart content.

## 6. References & Further Reading
- Frontend entry points: `app/page.tsx`, `app/verify/page.tsx`, `app/data-ingestion/page.tsx`, `app/public-dashboard/page.tsx`, `app/calendar/page.tsx`.
- Shared components: `components/verification-form.tsx`, `components/report-form.tsx`, `components/week-view.tsx`, `components/shift-template-panel.tsx`.
- API bindings: `lib/backend-api.ts`.
- Legacy backend docs: `backend/README.md`, `backend/app/api/*.py`.
- Product context & pending ideas: `to-do.md`.

## 7. Open Follow-ups / Opportunities
1. **Persistence for calendar data** – currently local-only; consider a backend endpoint for templates + instances tied to an org.
2. **Authentication / multi-tenant routing** – flows assume a single environment; add auth if multiple hospitals manage data simultaneously.
3. **Mobile & accessibility** – layouts are desktop-first; extend Tailwind breakpoints and keyboard interactions.
4. **Expanded analytics** – add filters (region, department) and expose definitions via a dedicated `/glossary` route for reuse.
5. **CI & testing** – integrate Playwright for E2E coverage across the verification → ingestion → dashboard journey.

Use this blueprint plus the referenced files to onboard quickly, extend the UI, or reconnect the FastAPI backend without rediscovering architecture decisions.***
