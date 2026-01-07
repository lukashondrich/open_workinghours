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
