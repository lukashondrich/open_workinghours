# Ticket: Hospital Directory — Maintenance Loop & Deferred Improvements

**Priority:** Low (recurring chore + backlog options)
**Context:** v2.1.2 (2026-07-23) shipped the OSM-rebuilt directory (+914 hospitals) and the
"Meine Klinik ist nicht dabei" free-text fallback. This ticket captures the ongoing loop
and the deliberately deferred options.

## Recurring loop (check ~monthly, or after onboarding waves)

1. **Find hospitals users typed that we don't have:**
   ```sql
   SELECT hospital_id, state_code, created_at FROM users
   WHERE hospital_ref_id IS NULL AND hospital_id != 'not_specified';
   ```
   (Run on prod via the usual admin path. These are real users waiting for their hospital.)
2. Add them to `datasets/german_hospitals/output/german_hospitals.csv` — **append-only,
   new ids above the max, never touch existing rows** (see `datasets/german_hospitals/README.md`).
   Or re-run `augment_hospitals_from_osm.py` (idempotent) if OSM has caught up.
3. `python3 scripts/convert-hospitals-csv.py` → regenerate mobile JSONs → next app release.
4. Backend: git pull + rebuild + `docker compose up -d` (CSV is volume-mounted).
5. Optionally message affected users that their hospital is now selectable in the profile.

## Deferred options (decide when the loop gets annoying)

- **API-backed picker**: mobile queries `GET /taxonomy/hospitals` (endpoint exists, zero UI
  consumers today) instead of bundled JSONs → directory fixes become a backend redeploy,
  no App Store release. Keep bundles as offline fallback. ~1 day.
- **City backfill**: ~37% of the OSM-added entries have no `city` (blank subtitle in the
  picker). Reverse-geocode from coords or postcode mapping. Cosmetic.
- **expo-updates (OTA)**: would make ALL JS/data fixes shippable without review, not just
  hospitals. Bigger operational decision; revisit alongside the Android launch.
- **Admin dashboard card** for the unmapped-hospitals query, so step 1 doesn't require SQL.

## Notes

- ID contract is the sacred invariant: users store `hospital_ref_id`; both backend loader
  and converter read the explicit CSV `id` column. Deleting/reordering rows corrupts
  user→hospital mappings silently.
- `/taxonomy/hospitals` was empty in prod until 2026-07 (CSV outside Docker build context —
  now volume-mounted in `backend/docker-compose.yml`). If it ever returns `[]` again,
  check the mount and the startup warning log first.
