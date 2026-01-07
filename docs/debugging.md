# Debugging Guide

**Last Updated:** 2026-01-07

This guide covers debugging techniques for the Open Working Hours project.

---

## Mobile App Debugging

### Tools

| Tool | Purpose | When to Use |
|------|---------|-------------|
| Xcode Console | View device logs | Real device testing |
| iOS Simulator | Quick iteration | UI development |
| React Native Debugger | JS debugging | Logic issues |
| Flipper | Network, layout | API debugging |

### Connecting to Device Logs

```
1. Connect iPhone via USB
2. Open Xcode → Window → Devices and Simulators
3. Select device → Open Console
4. Filter by app name or search for specific logs
```

### Simulator vs Device

| Feature | Simulator | Device |
|---------|-----------|--------|
| Geofencing | Does NOT work | Works |
| Background tasks | Limited | Works |
| Haptics | No feedback | Works |
| Performance | Faster | Real-world |

**Rule:** Test geofencing and background tasks on real device only.

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `uuid` not found | Browser API in RN | Use `expo-crypto` instead |
| Google Maps error | Missing API key | Use native maps (react-native-maps) |
| Background location fails | iOS restrictions | Check permissions, test on device |
| Build fails on M1 | CocoaPods arch issue | `arch -x86_64 pod install` |

### Debug Logging

Add console logs with prefixes for easy filtering:

```typescript
console.log('[GeofenceService]', 'Entering region:', regionId);
console.log('[AuthService]', 'Token refreshed');
console.log('[CalendarReducer]', 'Action:', action.type);
```

Filter in Xcode Console: `[GeofenceService]`

---

## Backend Debugging

### Local Development

```bash
cd backend

# Activate virtual environment
source .venv/bin/activate

# Run with auto-reload
uvicorn app.main:app --reload --port 8000

# Run tests
pytest -v

# Run specific test
pytest tests/test_work_events.py -v
```

### Production Logs

```bash
# SSH to server
ssh deploy@owh-backend-prod

# View backend logs
docker logs owh-backend --tail 100

# Follow logs in real-time
docker logs owh-backend -f

# View aggregation logs
tail -f /home/deploy/aggregation.log

# View nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Database Queries

```bash
# Connect to PostgreSQL
docker exec -it owh-postgres psql -U postgres -d openworkinghours

# Useful queries
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM work_events;
SELECT * FROM users ORDER BY created_at DESC LIMIT 5;
```

### Admin Dashboard

Access at: `https://api.openworkinghours.org/admin`

Requires `ADMIN_PASSWORD` from environment.

---

## Common Debugging Scenarios

### "Email verification not working"

1. Check SMTP credentials in `.env`
2. Check backend logs for email errors
3. Verify Brevo account is active
4. Test with `curl` to `/auth/request-code`

### "Geofencing not triggering"

1. Confirm testing on REAL device (not simulator)
2. Check location permissions (Always Allow)
3. Verify location is saved in SQLite
4. Check TrackingManager logs in Xcode Console
5. Walk completely outside geofence radius (100m+)

### "Data not syncing"

1. Check network connectivity
2. Verify JWT token is valid (not expired)
3. Check backend logs for 401/403 errors
4. Verify user is authenticated (`authState.isAuthenticated`)

### "Calendar zoom jumpy"

1. This is a known limitation without react-native-reanimated
2. Current implementation uses refs to minimize jumpiness
3. Zoom behavior is "acceptable" but not 60fps smooth

---

## Performance Profiling

### React Native

```bash
# Enable performance monitor
# Shake device → Show Perf Monitor

# Profile with Flipper
# Install Flipper → Connect device → React DevTools
```

### Backend

```bash
# Profile endpoint
time curl https://api.openworkinghours.org/health

# Check slow queries in PostgreSQL
docker exec -it owh-postgres psql -U postgres -d openworkinghours
\timing on
SELECT * FROM work_events WHERE user_id = '...' ORDER BY date DESC;
```

---

## Known Gotchas

Things that have tripped us up - save yourself time:

### Mobile App

| Gotcha | Details | Solution |
|--------|---------|----------|
| **Don't use react-native-reanimated** | Crashes on zoom with Expo SDK 51 + new architecture | Use ref-based approach (see `WeekView.tsx`) |
| **Geofencing needs real device** | Simulator doesn't trigger location events | Always test geofencing on physical iPhone |
| **iOS 18 week arrows** | `SET_WEEK` with date calculation had closure issues | Use `PREV_WEEK`/`NEXT_WEEK` actions instead |
| **5-min exit hysteresis** | Clock-out waits 5 min after leaving geofence | By design - prevents false clock-outs |
| **Sessions < 5 min discarded** | Short sessions are noise, auto-deleted | By design - user sees "Session Discarded" notification |
| **buildNumber must increment** | TestFlight rejects duplicate build numbers | Always bump in `app.json` before `eas build` |

### Backend

| Gotcha | Details | Solution |
|--------|---------|----------|
| **docker-compose.yml in backend/** | Not in project root | `cd backend` before `docker compose` commands |
| **SECRET_KEY not SECURITY__SECRET_KEY** | docker-compose maps env vars | Use simple names in `.env` |
| **--no-cache on rebuild** | Docker caches Python code | Always `docker compose build --no-cache backend` |
| **Can't submit today/future dates** | Backend rejects with 400 | Only past days can be confirmed |

### General

| Gotcha | Details | Solution |
|--------|---------|----------|
| **Next.js dashboard is deprecated** | Code in root but unused | Ignore it, use Astro website instead |
| **Don't use uuid package** | Browser API, not RN compatible | Use `expo-crypto` for UUIDs |

---

## Getting Help

1. Check this guide first (especially Known Gotchas above)
2. Search existing issues in the codebase
3. Check backend logs and mobile console
4. Create a bug report via Settings → Report Issue
5. Return to `CLAUDE.md` for doc navigation
