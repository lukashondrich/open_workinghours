# Open Working Hours

A privacy-first platform for healthcare workers to track and report working hours transparently while complying with GDPR.

## Components

| Component | Location | Status |
|-----------|----------|--------|
| Mobile App (React Native) | `mobile-app/` | Production (TestFlight) |
| Backend (FastAPI) | `backend/` | Production (Hetzner) |
| Website (Astro) | `website/` | Live ([openworkinghours.org](https://openworkinghours.org)) |

## Quick Start

### Mobile App

```bash
cd mobile-app
npm install
npm start           # Start Expo dev server
```

### Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload
```

### Website

```bash
cd website
npm install
npm run dev         # http://localhost:4321
```

## Documentation

See [`CLAUDE.md`](CLAUDE.md) for project overview, current state, and documentation index.

For architecture details, see:
- [`mobile-app/ARCHITECTURE.md`](mobile-app/ARCHITECTURE.md) - Mobile app
- [`backend/ARCHITECTURE.md`](backend/ARCHITECTURE.md) - Backend API
- [`blueprint.md`](blueprint.md) - System overview

## License

This project is licensed under the [MIT License](./LICENSE).
