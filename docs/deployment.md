# Deployment Guide

**Last Updated:** 2026-01-07

This guide covers deploying the Open Working Hours backend to production.

---

## Architecture Overview

```
Domain: openworkinghours.org
    │
    ├─ api.openworkinghours.org  → Backend API (FastAPI)
    │      │
    │      └─ Hetzner Cloud Server (Germany)
    │         ├─ Docker Container: FastAPI backend
    │         ├─ Docker Container: PostgreSQL database
    │         └─ Nginx (reverse proxy + SSL)
    │
    └─ openworkinghours.org      → Astro Website (Vercel)
```

---

## Prerequisites

- Hetzner Cloud account
- Domain with DNS access
- SSH key pair
- Brevo account (for SMTP)

---

## Docker Deployment (Hetzner)

**IMPORTANT:** The `docker-compose.yml` is in `backend/`, not the project root.

### Deployment Process

```bash
# SSH to Hetzner server
ssh deploy@owh-backend-prod

# Navigate to BACKEND directory (where docker-compose.yml lives)
cd ~/open_workinghours/backend

# Pull latest changes
git pull origin main

# Stop containers
docker compose down

# Rebuild backend image (REQUIRED for code changes)
docker compose build --no-cache backend

# Start containers
docker compose up -d

# Verify both containers are running (not "Restarting")
docker ps

# Check logs if issues
docker logs owh-backend --tail 30
```

### Why `--no-cache` is Important

- Docker caches layers during builds
- Without `--no-cache`, Python code changes may not be picked up
- The flag forces a complete rebuild with latest code

---

## Environment Variables

The `backend/.env` file requires specific variable names:

```bash
# These are MAPPED by docker-compose (use simple names, NOT SECURITY__ prefix)
SECRET_KEY=your-64-char-secret
EMAIL_HASH_SECRET=your-64-char-secret

# These are passed directly (keep the prefix)
EMAIL__SMTP_USERNAME=...
EMAIL__SMTP_PASSWORD=...
ADMIN_PASSWORD=...

# Demo account for Apple App Review (keep secret!)
DEMO__EMAIL=<your-demo-email>
DEMO__CODE=<your-6-digit-code>
```

---

## Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Port 8000 already in use | Old containers from wrong folder | `docker ps -a`, stop old containers |
| SECRET_KEY validation error | .env has `SECURITY__SECRET_KEY` | Use `SECRET_KEY` (docker-compose maps it) |
| Container keeps restarting | Check logs | `docker logs owh-backend --tail 50` |
| DB password auth failed | Volume has old password | `docker volume rm backend_postgres_data` |
| Leading spaces in .env | Copy/paste issue | `sed -i 's/^[[:space:]]*//' .env` |

---

## SSL/HTTPS Setup

SSL is managed by Nginx with Let's Encrypt certificates. Certificates auto-renew via certbot.

---

## Monitoring

### Quick Status Check

```bash
# Check if containers are running
docker ps

# Check backend logs
docker logs owh-backend --tail 50

# Check aggregation log
tail -50 /home/deploy/aggregation.log
```

### Aggregation Cron Job

The k-anonymity aggregation runs daily at 3 AM UTC:

```bash
# View cron job
crontab -l

# Check aggregation log
cat /home/deploy/aggregation.log
```

---

## Mobile App (TestFlight)

### Build Process

```bash
cd mobile-app

# Increment build number in app.json
# Current: 30, always increment for new uploads

# Build with EAS
eas build --platform ios --profile production

# Submit to TestFlight
eas submit --platform ios
```

### Common Issues

- **Apple Developer Portal auth errors**: Usually temporary, retry after 5-10 minutes
- **Build number conflict**: Always increment `buildNumber` in `app.json`
- **TestFlight updates**: Users must manually tap "Update"

---

## Website (Vercel)

The Astro website auto-deploys from `main` branch:

- **Root Directory**: `website`
- **Build Command**: `npm run build`
- **Output**: `dist/`

The `.vercelignore` excludes `mobile-app/` to prevent unnecessary rebuilds.
