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

## Placeholders to Fill

Before going live, replace the following:

### Content Placeholders
- **Team page:** Founder name, bio, photo, proof points
- **Team page:** Advisor names, titles, photos, contributions
- **Imprint:** Full legal name, address
- **Privacy Policy:** Full legal name, address, date, hosting provider details

### Asset Placeholders
- **Screenshots:** Replace 6 screenshot placeholders on `/product`
- **Diagrams:** Commission or generate the technical diagrams described in placeholder boxes
- **Team photos:** Add founder and advisor photos

### Diagram Specifications

The site includes placeholder boxes with detailed descriptions for technical diagrams. These should be created in a "blueprint" style (light blue technical drawing on grid background). See each placeholder for specific requirements:

1. **System Overview** (index page) - Data flow from app to dashboard
2. **Dashboard Mockup** (product page) - Bar chart preview
3. **Data Flow Diagram** (privacy page) - Three-layer privacy architecture

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
