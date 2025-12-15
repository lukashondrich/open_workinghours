# Admin Dashboard Setup

Simple web dashboard for monitoring Open Working Hours backend.

## Access

**URL:** `https://api.openworkinghours.org/admin`

**Default Credentials:**
- Username: `admin`
- Password: `changeme123`

⚠️ **IMPORTANT:** Change the default password before deploying to production!

## Setting a Custom Password

### Option 1: Environment Variable (Recommended)

Add to your `.env.production` file on Hetzner:

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password-here
```

Then update `backend/app/routers/admin.py` to read from environment:

```python
import os

ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "changeme123")
```

### Option 2: Direct Edit (Quick & Dirty for MVP)

Edit `backend/app/routers/admin.py` directly:

```python
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "your-password-here"  # Change this!
```

⚠️ Don't commit this to Git if using Option 2!

## Features

- **Total Users:** Number of registered users
- **Work Events:** Total submissions
- **Last 24h:** Activity in last 24 hours
- **Stats Groups:** K-anonymous aggregated groups
- **Recent Events:** Last 10 work event submissions

## Mobile Friendly

The dashboard is optimized for mobile devices. You can check it from your phone while on the go.

## Auto-Refresh

Dashboard auto-refreshes every 30 seconds to show latest data.

## Security

- Protected with HTTP Basic Auth over HTTPS
- Only shows aggregated data (no personal info)
- Simple password protection suitable for MVP testing

## Deploying

After updating the code:

```bash
ssh deploy@api.openworkinghours.org
cd ~/open_workinghours/backend
git pull origin main
docker compose up -d --build backend
```

Then visit: `https://api.openworkinghours.org/admin`
