# Phase 3: Deployment Guide - Hetzner + Docker

**Status:** ✅ Complete
**Created:** 2025-12-09
**Completed:** 2025-12-11
**Target:** Production deployment (backend + mobile app)
**Difficulty:** Beginner-friendly with step-by-step instructions

---

## Overview

We'll deploy your backend to Hetzner using Docker, which makes everything easier and more portable. Here's what we'll do:

```
┌─────────────────────────────────────────────────────────────┐
│                   DEPLOYMENT ARCHITECTURE                    │
└─────────────────────────────────────────────────────────────┘

Domain: openworkinghours.org
    │
    ├─ api.openworkinghours.org  → Backend API (FastAPI)
    │      │
    │      └─ Hetzner Cloud Server (Germany)
    │         ├─ Docker Container: FastAPI backend
    │         ├─ Docker Container: PostgreSQL database
    │         └─ Nginx (reverse proxy + SSL)
    │
    └─ mail.openworkinghours.org → Email (Brevo SMTP)
```

---

## Part 0: Domain Basics (5 minutes read)

### What is a Domain?

Think of a domain like a phone book entry:
- **Domain name**: `openworkinghours.org` (easy to remember)
- **IP address**: `78.47.123.456` (hard to remember)

When someone types `api.openworkinghours.org` in their browser, DNS (Domain Name System) looks up the IP address of your Hetzner server and connects to it.

### Subdomains

You can create unlimited subdomains for free:
- `api.openworkinghours.org` → Your backend API
- `mail.openworkinghours.org` → Email service (already configured)
- `dashboard.openworkinghours.org` → Your Next.js dashboard (optional)

### DNS Records (we'll set these up)

**A Record**: Points a domain to an IP address
- Example: `api.openworkinghours.org` → `78.47.123.456`

**CNAME Record**: Points a domain to another domain
- Example: `www.openworkinghours.org` → `openworkinghours.org`

---

## Part 1: Server Setup (30 minutes)

### Step 1.1: Create Hetzner Cloud Server

1. **Log in to Hetzner Cloud Console**
   - Go to: https://console.hetzner.cloud/

2. **Create a new project** (if you haven't already)
   - Click "New Project"
   - Name: "Open Working Hours"

3. **Add a server**
   - Click "Add Server"
   - **Location**: Choose `Falkenstein` or `Nuremberg` (Germany - GDPR compliant)
   - **Image**: Ubuntu 24.04 (latest)
   - **Type**:
     - Start with **CPX11** (2 vCPU, 2GB RAM) - €4.15/month
     - Can upgrade later if needed
   - **Networking**:
     - ✅ Enable IPv4
     - ✅ Enable IPv6
   - **SSH Key**:
     - Click "Add SSH Key"
     - We'll generate one in the next step
   - **Name**: `owh-backend-prod`

4. **Generate SSH key on your Mac**
   ```bash
   # On your Mac terminal
   ssh-keygen -t ed25519 -C "your-email@example.com"

   # Press Enter to save to default location (~/.ssh/id_ed25519)
   # Enter a passphrase (optional but recommended)

   # Copy the public key
   cat ~/.ssh/id_ed25519.pub
   ```

5. **Add the public key to Hetzner**
   - Paste the output from `cat ~/.ssh/id_ed25519.pub`
   - Click "Add SSH Key"

6. **Create the server**
   - Click "Create & Buy Now"
   - Wait ~1 minute for server to be created
   - **IMPORTANT**: Note down the server IP address (e.g., `78.47.123.456`)

### Step 1.2: Connect to Your Server

```bash
# Replace with your actual server IP
ssh root@78.47.123.456

# Type "yes" when asked about authenticity
# You should now be connected to your server!
```

**You'll see**: `root@owh-backend-prod:~#`

---

## Part 2: Server Configuration (20 minutes)

### Step 2.1: Basic Security Setup

```bash
# Update system packages
apt update && apt upgrade -y

# Create a non-root user (more secure)
adduser deploy
# Enter a password and press Enter through the prompts

# Add user to sudo group
usermod -aG sudo deploy

# Copy SSH key to new user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Test login with new user (open a NEW terminal window)
ssh deploy@78.47.123.456
# Should work without password!

# Disable root SSH login (in the NEW terminal as deploy user)
sudo nano /etc/ssh/sshd_config
# Find: PermitRootLogin yes
# Change to: PermitRootLogin no
# Save: Ctrl+O, Enter, Ctrl+X

sudo systemctl restart sshd
```

### Step 2.2: Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker deploy

# Log out and back in for group changes
exit
ssh deploy@78.47.123.456

# Test Docker
docker --version
# Should show: Docker version 24.x.x
```

### Step 2.3: Install Docker Compose

```bash
# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Test
docker compose version
# Should show: Docker Compose version v2.x.x
```

---

## Part 3: Domain Configuration (15 minutes)

### Step 3.1: Configure DNS Records

You need to add DNS records for your domain. This is done through your domain registrar (where you bought `openworkinghours.org`).

**Common registrars**: Namecheap, GoDaddy, Cloudflare, Google Domains, etc.

1. **Log in to your domain registrar**
2. **Find DNS settings** (usually called "DNS Management", "DNS Settings", or "Nameservers")
3. **Add these A records**:

   | Type | Name | Value | TTL |
   |------|------|-------|-----|
   | A | api | `78.47.123.456` (your server IP) | 3600 |
   | A | @ | `78.47.123.456` (your server IP) | 3600 |

   - `@` means the root domain (`openworkinghours.org`)
   - `api` creates the subdomain (`api.openworkinghours.org`)

4. **Save changes**
5. **Wait 5-10 minutes** for DNS to propagate

**Test DNS propagation:**
```bash
# On your Mac
dig api.openworkinghours.org

# Should show your server IP in the ANSWER SECTION
```

---

## Part 4: Backend Deployment (45 minutes)

### Step 4.1: Prepare Backend Files Locally

First, let's create Docker configuration files in your backend directory.

**File 1: `backend/Dockerfile`**
```dockerfile
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run migrations and start server
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**File 2: `backend/docker-compose.yml`**
```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    container_name: owh-postgres
    environment:
      POSTGRES_USER: owh
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: owh
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - owh-network
    restart: unless-stopped

  backend:
    build: .
    container_name: owh-backend
    environment:
      ENVIRONMENT: production
      DATABASE__URL: postgresql+psycopg://owh:${DB_PASSWORD}@db:5432/owh
      SECURITY__SECRET_KEY: ${SECRET_KEY}
      SECURITY__EMAIL_HASH_SECRET: ${EMAIL_HASH_SECRET}
      SECURITY__TOKEN_EXP_HOURS: 720
      EMAIL__FROM_ADDRESS: verify@mail.openworkinghours.org
      EMAIL__SMTP_HOST: smtp-relay.brevo.com
      EMAIL__SMTP_PORT: 587
      EMAIL__SMTP_USERNAME: ${SMTP_USERNAME}
      EMAIL__SMTP_PASSWORD: ${SMTP_PASSWORD}
      EMAIL__USE_TLS: true
      ALLOWED_EMAIL_DOMAINS_FILE: /app/config/allowed_domains.txt
    ports:
      - "8000:8000"
    depends_on:
      - db
    networks:
      - owh-network
    restart: unless-stopped

volumes:
  postgres_data:

networks:
  owh-network:
    driver: bridge
```

**File 3: `backend/.env.production`** (we'll create this on the server)

### Step 4.2: Push Code to Server

```bash
# On your Mac - in the backend directory
cd /Users/user01/open_workinghours/backend

# Create a tarball of the backend
tar -czf backend.tar.gz \
  --exclude='.venv' \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='dev.db' \
  --exclude='.env' \
  .

# Copy to server
scp backend.tar.gz deploy@78.47.123.456:~/

# SSH to server
ssh deploy@78.47.123.456

# Extract files
mkdir -p ~/open_workinghours/backend
cd ~/open_workinghours/backend
tar -xzf ~/backend.tar.gz
rm ~/backend.tar.gz
```

### Step 4.3: Configure Environment Variables on Server

```bash
# On the server (via SSH)
cd ~/open_workinghours/backend

# Generate secure secrets
SECRET_KEY=$(openssl rand -base64 64 | tr -d '\n')
EMAIL_HASH_SECRET=$(openssl rand -base64 64 | tr -d '\n')
DB_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')

# Create .env.production file
cat > .env.production <<EOF
DB_PASSWORD=${DB_PASSWORD}
SECRET_KEY=${SECRET_KEY}
EMAIL_HASH_SECRET=${EMAIL_HASH_SECRET}
SMTP_USERNAME=YOUR_BREVO_SMTP_USERNAME
SMTP_PASSWORD=YOUR_BREVO_SMTP_PASSWORD
EOF

# Secure the file
chmod 600 .env.production

# Show the file (verify it looks correct)
cat .env.production
```

### Step 4.4: Build and Start Docker Containers

```bash
# Still on the server
cd ~/open_workinghours/backend

# Load environment variables
export $(cat .env.production | xargs)

# Build and start containers
docker compose up -d

# Check if containers are running
docker ps

# You should see 2 containers:
# - owh-postgres
# - owh-backend

# Check logs
docker logs owh-backend --tail 50

# You should see: "Uvicorn running on http://0.0.0.0:8000"
```

### Step 4.5: Test Backend Locally on Server

```bash
# Test health check
curl http://localhost:8000/health

# Should return: {"status":"ok"}

# Test verification endpoint
curl -X POST http://localhost:8000/verification/request \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Should return: {"message":"..."}
```

---

## Part 5: Nginx + SSL Setup (30 minutes)

### Step 5.1: Install Nginx

```bash
# On the server
sudo apt update
sudo apt install nginx -y

# Check status
sudo systemctl status nginx
# Should show: active (running)
```

### Step 5.2: Configure Nginx for Backend

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/owh-backend

# Paste this configuration:
```

```nginx
server {
    listen 80;
    server_name api.openworkinghours.org;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Save: Ctrl+O, Enter, Ctrl+X

# Enable the site
sudo ln -s /etc/nginx/sites-available/owh-backend /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

### Step 5.3: Install SSL Certificate (HTTPS)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Get SSL certificate
sudo certbot --nginx -d api.openworkinghours.org

# Follow prompts:
# - Enter your email
# - Agree to terms (Y)
# - Share email with EFF (your choice)
# - Redirect HTTP to HTTPS? (2 = Yes, recommended)

# Certificate is automatically renewed every 90 days
```

### Step 5.4: Test HTTPS Endpoint

```bash
# On your Mac (not on the server)
curl https://api.openworkinghours.org/health

# Should return: {"status":"ok"}

# Test verification endpoint
curl -X POST https://api.openworkinghours.org/verification/request \
  -H "Content-Type: application/json" \
  -d '{"email":"your-real-email@hospital.de"}'

# Check your email for verification code!
```

---

## Part 6: Mobile App Update (20 minutes)

### Step 6.1: Update Backend URL

Edit `mobile-app/app.json`:

```json
{
  "expo": {
    "extra": {
      "authBaseUrl": "https://api.openworkinghours.org",
      "workEventsBaseUrl": "https://api.openworkinghours.org/work-events"
    },
    "version": "2.0.0",
    "ios": {
      "buildNumber": "9"
    }
  }
}
```

### Step 6.2: Test with Local App

```bash
# On your Mac
cd /Users/user01/open_workinghours/mobile-app

# Start Expo
npx expo start

# Open in simulator
# Test registration flow with production backend
```

### Step 6.3: Build for TestFlight

```bash
# Build iOS app
eas build --platform ios --profile production

# Wait ~10-15 minutes for build to complete

# Submit to TestFlight
eas submit --platform ios

# Build will appear in TestFlight within ~1 hour
```

---

## Part 7: Monitoring & Maintenance

### Daily Operations

**View backend logs:**
```bash
ssh deploy@78.47.123.456
docker logs owh-backend --tail 100 -f
```

**Restart backend:**
```bash
ssh deploy@78.47.123.456
cd ~/open_workinghours/backend
docker compose restart backend
```

**Update backend code:**
```bash
# On your Mac
cd /Users/user01/open_workinghours/backend
tar -czf backend.tar.gz --exclude='.venv' --exclude='__pycache__' .
scp backend.tar.gz deploy@78.47.123.456:~/

# On server
ssh deploy@78.47.123.456
cd ~/open_workinghours/backend
docker compose down
tar -xzf ~/backend.tar.gz
export $(cat .env.production | xargs)
docker compose up -d --build
```

**Database backup:**
```bash
# On server
docker exec owh-postgres pg_dump -U owh owh > backup_$(date +%Y%m%d).sql

# Download to your Mac
scp deploy@78.47.123.456:~/backup_*.sql ~/Downloads/
```

---

## Troubleshooting

### Issue: DNS not resolving

**Check:**
```bash
dig api.openworkinghours.org
```

**Fix**: Wait 5-10 more minutes, DNS takes time to propagate.

### Issue: Can't connect to server

**Check:**
```bash
# Test if server is reachable
ping 78.47.123.456

# Test if SSH port is open
nc -zv 78.47.123.456 22
```

**Fix**: Check Hetzner Cloud firewall settings.

### Issue: Docker containers not starting

**Check:**
```bash
docker logs owh-backend
docker logs owh-postgres
```

**Fix**: Check environment variables in `.env.production`.

### Issue: SSL certificate failed

**Check:**
```bash
sudo certbot certificates
```

**Fix**: Make sure DNS is propagating first (`dig api.openworkinghours.org`).

---

## Cost Estimate

| Service | Cost | Notes |
|---------|------|-------|
| Hetzner CPX11 Server | €4.15/month | 2 vCPU, 2GB RAM |
| Domain (.org) | ~€10/year | One-time + renewal |
| SSL Certificate | FREE | Let's Encrypt |
| EAS Build | $29/month | For TestFlight builds |
| **Total** | **~€5/month + $29/month** | Can cancel EAS after launch |

---

## Security Checklist

- [x] Root SSH login disabled
- [x] Non-root user created
- [x] SSH key authentication only
- [x] Firewall enabled (default on Hetzner)
- [x] HTTPS with SSL certificate
- [x] Environment variables secured
- [x] Database password secured
- [x] Regular backups scheduled

---

## Next Steps

After deployment:
1. Test all endpoints from mobile app
2. Submit TestFlight Build #9
3. Monitor logs for errors
4. Set up database backups (cron job)
5. Schedule aggregation job (Phase 3 remaining task)

---

**Last Updated:** 2025-12-09
**Status:** Ready to start
**Estimated Time:** ~2-3 hours (first time)
