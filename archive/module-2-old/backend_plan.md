# Backend Plan – Module 2 Weekly Submissions

## Goals
1. Expose a `POST /submissions/weekly` endpoint the mobile app can hit locally.
2. Persist incoming submissions in PostgreSQL (or SQLite for dev) with minimal schema.
3. Provide a lightweight `GET /submissions/weekly` (dev-only) to verify data.
4. Ensure CORS is configured so Expo/mobile clients on the LAN can call the API.

## Tasks
1. **API Models & Router**
   - Define Pydantic models for request/response.
   - Create `backend/app/routers/submissions.py` with `POST /submissions/weekly`.
   - Include router in `main.py`.

2. **Database Schema**
   - Add `WeeklySubmission` SQLAlchemy model/table with fields:
     ```
     id UUID (PK)
     week_start DATE
     week_end DATE
     planned_hours NUMERIC
     actual_hours NUMERIC
     client_version TEXT
     created_at TIMESTAMP
     ```
   - For now, use existing migration framework (or inline table creation if migrations pending).

3. **Persistence & Response**
   - In the POST handler, insert the record and return `{ "id": uuid, "received_at": created_at }`.
   - Add `GET /submissions/weekly` (dev) to list the latest 10 rows for verification.

4. **CORS + Config**
   - Ensure FastAPI app adds `CORSMiddleware` allowing `http://192.168.1.161:19000` (Expo) or use `*` for local dev.
   - Document the environment variable (`EXPO_PUBLIC_SUBMISSION_BASE_URL`) & startup steps in README.

5. **Testing**
   - Manual curl test and optional pytest covering POST validation.

---

## Database MVP Plan

### Goals
- Provide a minimal persistence layer the backend can start with (no external dependencies if Postgres isn’t available).
- Allow smooth transition to PostgreSQL once infrastructure is ready.

### MVP Strategy
1. **SQLite fallback for local dev**
   - Update `DATABASE_URL` logic to default to `sqlite:///./dev.db` when no Postgres URL is provided.
   - Ensure Alembic or `Base.metadata.create_all` still works for SQLite.
2. **PostgreSQL configuration**
   - Document `.env` template for Postgres (host, port, username, password).
   - Provide instructions for running a local Postgres via Docker (`docker-compose up db`) or Homebrew.
3. **Migration path**
   - Keep models compatible with both engines (avoid unsupported types).
   - Once Postgres is ready, run Alembic migrations to create the `weekly_submissions` table there.

### Future Enhancements
- Set up dedicated Alembic migrations for every schema change.
- Introduce connection pooling + health checks.
- Add background queue for submissions if we later separate storage from API.
