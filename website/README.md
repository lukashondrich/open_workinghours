# Open Working Hours - Website

Public-facing project dossier website for outreach to unions, professional associations, and interest groups.

## Tech Stack

- **Framework:** Astro 5
- **Styling:** Tailwind CSS 4
- **Fonts:** Inter (Google Fonts)

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Project Dossier - overview for stakeholders |
| `/product` | Demo & screenshots |
| `/privacy` | Privacy principles (high-level trust page) |
| `/team` | Team & advisors |
| `/imprint` | German Impressum (legal) |
| `/privacy-policy` | GDPR privacy policy |
| `/dashboard` | Public dashboard - coverage map, progress, contact form (EN) |
| `/de/dashboard` | Public dashboard (DE) |

## Development

```bash
cd website
npm install
npm run dev     # Start dev server at localhost:4321
npm run build   # Build static site to ./dist
npm run preview # Preview built site
```

## Deployment

This is a static site that can be deployed anywhere:

### Vercel (Recommended)
1. Connect repo to Vercel
2. Set root directory to `website`
3. Build command: `npm run build`
4. Output directory: `dist`

### Netlify
1. Connect repo to Netlify
2. Set base directory to `website`
3. Build command: `npm run build`
4. Publish directory: `website/dist`

### Manual
```bash
npm run build
# Upload contents of ./dist to any static host
```

## Content Status

All primary content is complete as of 2026-01-07:

| Item | Status |
|------|--------|
| Founder name, bio, photo | ✅ Complete |
| Imprint (legal info) | ✅ Complete |
| Privacy Policy | ✅ Complete |
| App screenshots (6) | ✅ Complete |
| Data flow diagram | ✅ Complete |
| Dashboard screenshot | ✅ Complete |

### Pending (when confirmed)
- Advisor names, titles, photos, contributions

## Configuration

### Email Address
Update the contact email in `src/layouts/Layout.astro`:
```astro
<a href="mailto:contact@openworkinghours.org">contact@openworkinghours.org</a>
```

### Site Metadata
Update default description in `src/layouts/Layout.astro`:
```astro
const { description = 'Your description here' } = Astro.props;
```

## Design System

### Colors
- **Primary:** Blue (`#2563eb` / `blue-600`)
- **Text:** Gray-800 for body, Gray-900 for headings
- **Background:** White

### Typography
- **Font:** Inter
- **Headings:** Semibold
- **Body:** Regular, 1.6 line-height

### Components
- `DiagramPlaceholder` - Blueprint-style placeholder for technical diagrams
- `ScreenshotPlaceholder` - Phone-shaped placeholder for app screenshots

---

## Public Dashboard

The `/dashboard` page provides a public-facing view of project progress.

### Features
- **Interactive Map**: D3.js choropleth map of Germany with zoom/pan, hospital dots, tooltips
- **Progress Strip**: Contributor count, shifts confirmed, state coverage
- **Trust Section**: K-anonymity explanation, privacy bullet points
- **Contact Form**: Institution inquiry form (unions, researchers, press)
- **Bilingual**: EN (`/dashboard`) and DE (`/de/dashboard`)

### Map Implementation

The dashboard uses a self-hosted D3.js interactive map with:
- 16 German states with coverage status coloring (grey/amber/green)
- 1,220 hospital locations as interactive dots
- Hover tooltips showing hospital names
- Zoom controls (+/-, reset) and mouse wheel/drag
- Bilingual labels via `locale` prop (`en` or `de`)
- No external runtime dependencies (all data bundled)

**Files:**
- `src/components/InteractiveMap/InteractiveMap.tsx` - React/D3 component
- `src/components/InteractiveMap/germany-states.json` - GeoJSON (97KB)
- `src/components/InteractiveMap/hospitals.json` - Hospital coordinates

See `docs/INTERACTIVE_MAP_PLAN.md` for full specification.

### Navigation & Cross-Linking

**Nav order:** Dossier → Product → Dashboard (Live) → Privacy → Team

**Cross-links to Dashboard:**
- Homepage hero: "See current coverage across Germany →"
- Product page: "View live coverage map →" (replaced static screenshot)

The "Live" badge on Dashboard indicates real-time data from the backend API.

### Backend Integration

The dashboard fetches data from these backend endpoints:
- `GET /dashboard/coverage` - Per-state contributor counts
- `GET /dashboard/activity` - 30-day rolling activity stats
- `POST /dashboard/contact` - Institution contact form submission

### Pending Items
- Contact form email notification to admin (not yet implemented)
- `contact@openworkinghours.org` email setup
- App Store link (placeholder until available)
