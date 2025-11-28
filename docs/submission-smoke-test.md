# Weekly Submission Smoke Test

This checklist validates the end-to-end Module 2 flow using the Expo app and local FastAPI backend.

## Prerequisites
- Node/Expo toolchain for the mobile app.
- Python 3.11+ for the backend (the helper script will create a venv).
- LAN IP accessible by your simulator/phone.

## Steps
1. **Start backend (SQLite mode)**
   ```bash
   ./scripts/start-backend.sh
   ```
   Keep this terminal open; the server listens on `http://0.0.0.0:8000`.

2. **Expose the backend URL to Expo**
   - Find your LAN IP: `ipconfig getifaddr en0` (macOS) or equivalent.
   - Set `mobile-app/.env`:
     ```bash
     EXPO_PUBLIC_SUBMISSION_BASE_URL=http://<LAN_IP>:8000
     ```

3. **Launch Expo**
   ```bash
   cd mobile-app
   npx expo start -c
   ```
   Open the app on simulator/physical device.

4. **Confirm a full week**
   - In Calendar → Week view, confirm all 7 days (using Review mode).
   - The Weekly Submission card should show “Ready to submit”.

5. **Submit week**
   - Tap “Submit Week”.
   - Expect toast + status change to “Sent to backend”.
   - Backend terminal should log `POST /submissions/weekly 201`.

6. **Verify storage**
   - Visit `http://<LAN_IP>:8000/submissions/weekly?limit=5` or run:
     ```bash
     cd backend
     sqlite3 dev.db "SELECT * FROM weekly_submissions ORDER BY created_at DESC LIMIT 5;"
     ```
   - Confirm the new row matches the week you submitted (dates and true totals).

7. **Reset (optional)**
   - In the app, unlock the week if you need to edit/resubmit.
   - Stop the backend with `Ctrl+C` when finished.

If any step fails, note the error toast and backend logs before re-running the test.
