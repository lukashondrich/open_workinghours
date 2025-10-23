# Open Working Hours Prototype

Prototype stack for an anonymised physician working-hours reporting platform.

## Services

- **frontend** – Next.js React client for email verification and report submission.
- **backend** – FastAPI service providing verification and reporting endpoints.
- **postgres** – Primary data store.

## Quick start

1. Copy `.env` template and customise secrets:

   ```bash
   cp backend/.env.example backend/.env
   # edit backend/.env with strong secrets
   ```

2. Add authorised hospital domains to `config/allowed_domains.txt` (one per line).

3. Launch the stack:

   ```bash
   docker compose up --build
   ```

   - API available at <http://localhost:8000/docs>
   - Frontend available at <http://localhost:3000> (`/dashboard` exposes aggregated analytics)

4. Verification flow (prototype):

- Submit a hospital email. Backend stores only a hashed email and sends (or logs) a one-time code.
- Confirm the code to receive a long-lived affiliation token (stored in the browser).
- Use the token to submit reports (date, hours, role, optional notes). Notes are lightly scrubbed for obvious PII.

## Planner preview (frontend)

- Visit <http://localhost:3000/planner> for the interactive shift-planning prototype geared towards rapid tester feedback.
- Define custom shift types with fixed durations, optional pauses, and midnight-crossing rules.
- Klicken Sie in das Wochenraster (oder nutzen Sie das barrierearme Formular), um Schichten zu platzieren; Start-/Endzeiten werden auf das Raster geschnappt und Überschneidungen verhindert.
- Edit placed shifts inline: adjust start, duration, assigned type, or delete; cross-midnight limits and default break clean-up are enforced.
- Calendar offers week/day views with break markers and per-day scheduled vs. overtime totals. All data persists only in browser memory for now.

## Backend configuration

Environment variables (see `backend/.env.example`):

- `DATABASE__URL` – SQLAlchemy DSN.
- `SECURITY__SECRET_KEY` – 32+ char secret for JWT tokens.
- `SECURITY__EMAIL_HASH_SECRET` – 32+ char secret for hashing emails/codes.
- `ALLOWED_EMAIL_DOMAINS_FILE` – path to file with permitted hospital domains.
- Optional SMTP settings under `EMAIL__*` to send real verification emails. Without SMTP, verification codes are logged to stdout.

## Development notes

- Database tables auto-create on application start (`app/database.py`). Add Alembic migrations before production use.
- Reports now capture hospital domain, staff group (three bands), tatsächliche Stunden, Überstunden, Datum und optionale Hinweise – es werden keine personenbezogenen Felder wie E-Mail oder IP gespeichert.
- Notes field has a simple regex scrubber; extend with NLP/PII detection for production.
- `/analytics` provides hospital/staff-group level monthly aggregates with bootstrap CIs plus differential-privacy noise and automatic small-n suppression.

## Next steps

1. Add rate limiting (e.g. Redis) for `/verification/request`.
2. Implement materialised views + dashboard consumption of aggregated data.
3. Harden verification emails (signed links, throttling, HTML template).
4. Complete DPIA & legal review before handling real data.
