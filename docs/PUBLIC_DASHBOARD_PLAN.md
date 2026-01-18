# Public Dashboard Plan

**Created:** 2026-01-17
**Status:** Phase 1 In Progress
**Last Updated:** 2026-01-18
**Author:** Planning session with Claude

---

## 1. Purpose & Goals

### Primary Goals
1. **Credibility**: Make the project look real and trustworthy to unions and healthcare workers
2. **Conversion**: Drive app downloads and contributor signups
3. **Virality**: Create shareable content that spreads organically
4. **Transparency**: Be honest about project stage and data limitations

### Target Audiences
| Audience | Primary Need | Key Message |
|----------|--------------|-------------|
| Healthcare workers | "Is this safe? Is it real?" | Privacy-first, your employer can't see |
| Unions / Marburger Bund | "Is this credible? Methodology?" | Scientific approach, k-anonymity, open |
| Press / Public | "What's the story?" | Healthcare overwork is hidden, we're fixing that |

### Current Constraints
- **1-3 users** - No stats will meet k=11 threshold
- **Hospital dataset available** - 1,220 hospitals with coordinates
- **Existing stats endpoints** - `/stats/summary`, `/stats/by-state-specialty`

---

## 2. Design Principles

Based on research into data visualization best practices:

### Trust Principles (from CHI 2025 "Trustworthy by Design")
- Present data clearly - no visual tricks
- Polish your design - professional aesthetic builds trust
- Leverage familiarity - use recognizable chart types
- Educate where necessary - explain methodology visibly
- Cite credible sources - attribution matters

### Shareability Principles (from r/dataisbeautiful)
- Eye-catching but not misleading
- Detail rewards engagement
- Narrative storytelling
- Clear attribution of source and creator

### Aesthetic Guidelines
- **Color palette**: Extend existing teal accent with grey (no data), amber (building), green (threshold met)
- **Typography**: Clean, readable, generous whitespace
- **Animations**: Subtle only (hover states, scroll transitions)
- **Mobile-first**: Healthcare workers often on mobile

---

## 3. Visual Direction Options

### Option A: "The Observatory"
**Aesthetic**: Clean, scientific, observatory-like. Our World in Data meets medical journal.

| Aspect | Approach |
|--------|----------|
| Background | White/light |
| Colors | Muted tones, single teal accent |
| Feel | Clinical, trustworthy, academic |
| Shareable | Static chart cards with headline + source |

**Pros**: Maximum credibility for institutional audiences
**Cons**: Less viral potential, may feel cold

### Option B: "The Movement Tracker"
**Aesthetic**: Warm, human, progress-oriented. Crowdfunding meets data journalism.

| Aspect | Approach |
|--------|----------|
| Background | Light with warm accents |
| Colors | Progress gradient (grey → amber → green) |
| Feel | Community, momentum, participation |
| Shareable | Animated "X away from unlocking" cards |

**Pros**: Emotional resonance, clear CTAs
**Cons**: Risk of feeling manipulative if overdone

### Option C: "The Transparent Dossier"
**Aesthetic**: Documentary, investigative, editorial. NYT meets policy brief.

| Aspect | Approach |
|--------|----------|
| Background | Editorial white with accent sections |
| Colors | Restrained, journalistic |
| Feel | Investigative, serious, authoritative |
| Shareable | Key insight cards with quotes |

**Pros**: Aligns with existing dossier site, journalistic credibility
**Cons**: More complex, requires strong copy

### Recommended: Hybrid A + C
- **Structure**: Single-page with clear sections (not scrollytelling)
- **Aesthetic**: Clean, scientific (Option A)
- **Tone**: Transparent, documentary (Option C)
- **Progress framing**: Honest, not gamified (avoid Option B manipulation risk)

---

## 4. Page Structure

### Section 1: Hero
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Mapping Healthcare Working Hours                          │
│   Across Germany                                            │
│                                                             │
│   Independent evidence for better working conditions.       │
│   Privacy-first. Community-powered.                         │
│                                                             │
│   [Download App]  [Learn How It Works]                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Section 2: Coverage Map
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Coverage Status                                           │
│                                                             │
│   ┌─────────────────────────────────┐                       │
│   │                                 │                       │
│   │     [Germany Map]               │    Legend:            │
│   │     - States colored by status  │    ░ No data yet      │
│   │     - Hospital points clustered │    ▒ Building (1-10)  │
│   │                                 │    █ Available (11+)  │
│   │                                 │                       │
│   └─────────────────────────────────┘                       │
│                                                             │
│   Click a state to see details                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Map Implementation Options:**

| Option | Pros | Cons | Effort |
|--------|------|------|--------|
| Datawrapper embed | Quick, professional, responsive | Less customization, external dependency | Low |
| Custom SVG + CSS | Full control, no dependencies | Manual work, limited interactivity | Medium |
| D3.js / MapLibre | Maximum flexibility, animations | Complex, larger bundle | High |
| Leaflet + GeoJSON | Good interactivity, well-documented | Requires tile server or static tiles | Medium |

**Recommended**: Datawrapper for MVP (can upgrade later)

### Section 3: Progress Strip
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Current Status (Last 30 Days)                             │
│                                                             │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│   │ Contributors │  │ Shifts       │  │ Coverage     │      │
│   │              │  │ Confirmed    │  │              │      │
│   │     3        │  │     42       │  │    1/16      │      │
│   │              │  │              │  │   states     │      │
│   └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│   Privacy threshold: Statistics only shown when             │
│   11+ contributors in a group                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Section 4: What Becomes Possible
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   What We'll Reveal                                         │
│   When regions reach the privacy threshold                  │
│                                                             │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│   │ [Blurred]   │  │ [Blurred]   │  │ [Blurred]   │         │
│   │             │  │             │  │             │         │
│   │  Overtime   │  │  Planned    │  │  Regional   │         │
│   │  Trends     │  │  vs Actual  │  │  Comparison │         │
│   │             │  │             │  │             │         │
│   │ 🔒 11+ needed│  │ 🔒 11+ needed│  │ 🔒 11+ needed│        │
│   └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│   Help unlock insights for your region                      │
│   [Download App]                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Section 5: Trust & Method
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   How We Protect Your Data                                  │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │  [Visual: 11 people icons → 1 statistic icon]       │   │
│   │                                                     │   │
│   │  K-Anonymity: Nothing published unless 11+          │   │
│   │  contributors are in the group                      │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   ✓ Your employer cannot access your data                   │
│   ✓ GPS coordinates never leave your device                 │
│   ✓ Email stored as hash only                               │
│   ✓ Data stored in Germany (EU)                             │
│   ✓ Delete anytime (GDPR Art. 17)                           │
│                                                             │
│   [Read Privacy Policy]  [View Methodology]                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Section 6: For Institutions
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   For Unions & Professional Associations                    │
│                                                             │
│   Open Working Hours provides independent, aggregated       │
│   evidence for collective bargaining and policy advocacy.   │
│                                                             │
│   • Methodology designed with privacy experts               │
│   • K-anonymity standard (EMA/Health Canada threshold)      │
│   • Differential privacy (Laplace noise)                    │
│   • Open source infrastructure                              │
│                                                             │
│   [Request a Briefing]                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Section 7: Share & Join
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   Help Build Transparency                                   │
│                                                             │
│   [Download on App Store]                                   │
│                                                             │
│   Share this page:                                          │
│   [WhatsApp] [Twitter/X] [LinkedIn] [Copy Link]             │
│                                                             │
│   Invite a colleague:                                       │
│   [Generate invite link]                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. Freemium Model

### The Core Tension
- Too much gated → visitors don't see value → don't convert
- Too little gated → no incentive to sign up

### Recommendation: Stage-Based Gating

#### Phase 1: Sparse Data (Current - <100 users nationally)
Almost everything public. Goal is credibility and downloads.

| Content | Access | Rationale |
|---------|--------|-----------|
| Coverage map | Public | Shows project is real |
| Progress counters | Public | Shows momentum |
| Methodology | Public | Builds trust |
| Hospital reference layer | Public | Looks complete |
| "What becomes possible" | Public | Creates desire |
| Contact form | Public | Unions need access |

**Gated (requires app account):**
| Content | Access | Rationale |
|---------|--------|-----------|
| "Follow a region" notifications | App account | Light incentive |
| Personal contribution stats | App account | Obvious |

#### Phase 2: Growing Data (100-500 users, some regions hit threshold)
Start introducing depth gating.

| Content | Access | Rationale |
|---------|--------|-----------|
| National-level stats | Public | Headline grabber |
| Regional stats (when available) | Public | Still building |
| Filters (state, specialty) | Login | Depth incentive |
| Time range selection | Login | Depth incentive |
| Comparison views | Login | Premium feel |
| Data export | Login | Serious users |

#### Phase 3: Mature Data (500+ users, multiple regions)
Full freemium model.

| Content | Access | Rationale |
|---------|--------|-----------|
| National headline stats | Public | Always shareable |
| Coverage map (status only) | Public | Entry point |
| Regional detail view | Login | Incentive |
| All filters | Login | Core value |
| Historical trends | Login | Premium |
| Export / API access | Login | Power users |

### Login Options

| Option | Pros | Cons |
|--------|------|------|
| A) Reuse app email auth | Single identity, simple | Web users must download app |
| B) Web-only email auth | Lower friction | Two auth systems |
| C) App-exclusive depth | Strong download incentive | Loses pure web users |

**Recommended for Phase 1**: Option C (app-exclusive depth)
- Public preview on web drives to app download
- All "logged in" features are in the app
- Simplest to implement (no web auth needed)

**Later migration**: Add web login (Option B) when dashboard has real depth

---

## 6. Referral Tracking

### Goals
- Measure virality (how many invites convert)
- Reward active promoters (gamification, future)
- Understand acquisition channels

### Implementation Options

| Option | Complexity | Features |
|--------|------------|----------|
| UTM parameters only | Low | Channel tracking, no individual attribution |
| Referral codes | Medium | Individual attribution, shareable links |
| Full referral system | High | Rewards, leaderboards, invite trees |

**Recommended for MVP**: Referral codes (medium complexity)

### Referral Code Flow
```
1. User in app taps "Invite colleague"
2. App generates unique code: OWH-XXXX (linked to user_id)
3. Share link: openworkinghours.org/join?ref=OWH-XXXX
4. New user downloads app, enters code during registration
5. Backend records: inviter_id, invitee_id, timestamp
6. Future: Show "You've invited X colleagues" in app
```

### New Backend Components Needed
```sql
-- Referral codes table
referral_codes (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  code TEXT UNIQUE,        -- "OWH-XXXX"
  created_at TIMESTAMP,
  expires_at TIMESTAMP     -- Optional expiry
)

-- Referral tracking table
referrals (
  id UUID PRIMARY KEY,
  referrer_id UUID REFERENCES users(id),
  referee_id UUID REFERENCES users(id),
  code_used TEXT,
  created_at TIMESTAMP
)
```

### New Endpoints
```
POST /referral/generate     → { code: "OWH-XXXX", link: "..." }
POST /auth/register         → Accept optional referral_code param
GET  /referral/stats        → { invites_sent: X, invites_converted: Y }
```

---

## 7. New Backend Endpoints for Dashboard

### Public Endpoints (no auth)

#### GET /stats/coverage
Returns per-state coverage status for the map.

```json
{
  "updated_at": "2026-01-13T00:00:00Z",  // Weekly precision only (privacy)
  "states": [
    {
      "state_code": "BY",
      "state_name": "Bayern",
      "status": "building",           // "none" | "building" | "available"
      "contributors_range": "1-10",   // Range, not exact (privacy)
      "threshold": 11
    },
    ...
  ],
  "national": {
    "contributors_range": "1-10",
    "status": "building"
  }
}
```

**Privacy considerations:**
- Return ranges, not exact counts when below threshold
- Update timestamp at weekly precision only (prevent timing attacks)
- No state shown as "available" until ≥7 days at threshold (dwell time)

#### GET /stats/activity
Returns 30-day rolling activity for progress strip.

```json
{
  "period": "30d",
  "contributors_active": "1-10",      // Range
  "shifts_confirmed": 42,             // Can be exact (not identifying)
  "states_building": 3,
  "states_available": 0
}
```

### Authenticated Endpoints (future, Phase 2+)

#### GET /stats/filtered
Returns filtered stats (requires login).

```
GET /stats/filtered?state=BY&specialty=surgery&period=2026-01
```

Only returns data for buckets meeting k-anonymity threshold.

---

## 8. Contact Form for Institutions

### Fields
```
Name:           [_______________]
Organization:   [_______________]
Role:           [_______________]  (dropdown: Union rep, Researcher, Press, Other)
Email:          [_______________]
Message:        [_______________]
                [_______________]
                [_______________]

[ ] I agree to the privacy policy

[Submit Request]
```

### Backend Handling Options

| Option | Pros | Cons |
|--------|------|------|
| Email forwarding (Brevo) | Simple, immediate | No tracking |
| Store in DB + email alert | Trackable, can follow up | More infrastructure |
| Third-party form (Typeform, etc.) | Quick, nice UX | External dependency |

**Recommended**: Store in DB + email alert to owner

### New Table
```sql
institution_inquiries (
  id UUID PRIMARY KEY,
  name TEXT,
  organization TEXT,
  role TEXT,
  email TEXT,
  message TEXT,
  created_at TIMESTAMP,
  responded_at TIMESTAMP,    -- Track follow-up
  notes TEXT                 -- Internal notes
)
```

### New Endpoint
```
POST /contact/institution
→ Stores inquiry, sends email alert to admin
```

---

## 9. Technical Architecture

### Option A: Astro + React Islands (Recommended)

Keep dashboard on main website for SEO benefits.

```
website/
├── src/
│   ├── pages/
│   │   └── dashboard.astro          # Dashboard page
│   ├── components/
│   │   ├── dashboard/
│   │   │   ├── CoverageMap.tsx      # React island
│   │   │   ├── ProgressStrip.tsx    # React island
│   │   │   ├── UnlockPreview.tsx    # Static or React
│   │   │   ├── TrustBlock.astro     # Static Astro
│   │   │   ├── InstitutionForm.tsx  # React island
│   │   │   └── ShareSection.astro   # Static Astro
```

**Pros**: Single domain, SEO, existing infrastructure
**Cons**: Need to add React to Astro site

### Option B: Separate Dashboard App

```
dashboard/                           # New Next.js/Vite app
├── src/
│   ├── pages/
│   │   └── index.tsx
│   ├── components/
│   │   └── ...
```

Deploy to `dashboard.openworkinghours.org`

**Pros**: Cleaner separation, more flexibility
**Cons**: Separate deployment, domain fragmentation

### Recommended: Option A (Astro + React Islands)

Astro supports React components as "islands" - interactive components in an otherwise static page. This gives us:
- Static rendering for SEO
- Interactive map and forms where needed
- Single deployment (Vercel)
- Shared styling with rest of site

---

## 10. Datawrapper Integration

### For the Choropleth Map

Datawrapper can create an embeddable Germany map with:
- State-level coloring
- Custom tooltips
- Responsive design
- Accessible (screen reader friendly)

### Workflow
1. Create map in Datawrapper with static data
2. Embed via iframe or JS embed code
3. Update data via Datawrapper API when stats change

### Datawrapper API Integration
```python
# Backend: Update Datawrapper chart when stats change
import requests

def update_datawrapper_map(coverage_data):
    chart_id = "YOUR_CHART_ID"
    api_token = os.environ["DATAWRAPPER_API_TOKEN"]

    # Update data
    requests.put(
        f"https://api.datawrapper.de/v3/charts/{chart_id}/data",
        headers={"Authorization": f"Bearer {api_token}"},
        data=coverage_csv_string
    )

    # Publish
    requests.post(
        f"https://api.datawrapper.de/v3/charts/{chart_id}/publish",
        headers={"Authorization": f"Bearer {api_token}"}
    )
```

### Alternative: Static Datawrapper + Overlay

Create base map in Datawrapper, then overlay dynamic elements with CSS/JS:
- Datawrapper handles base map styling
- Custom JS adds hover states, click handlers
- Simpler than full API integration

---

## 11. Open Graph / Social Sharing

### Meta Tags for Dashboard Page
```html
<meta property="og:title" content="Healthcare Working Hours in Germany" />
<meta property="og:description" content="Independent, privacy-preserving data on healthcare working conditions. Join X contributors." />
<meta property="og:image" content="https://openworkinghours.org/og/dashboard.png" />
<meta property="og:url" content="https://openworkinghours.org/dashboard" />
<meta property="og:type" content="website" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Healthcare Working Hours in Germany" />
<meta name="twitter:description" content="Independent, privacy-preserving data on healthcare working conditions." />
<meta name="twitter:image" content="https://openworkinghours.org/og/dashboard.png" />
```

### Dynamic OG Image Generation

For shareable "insight cards", generate images dynamically:

| Option | Pros | Cons |
|--------|------|------|
| Vercel OG | Easy with Next.js/Vercel | Requires Edge runtime |
| Satori + Resvg | Works anywhere | More setup |
| Pre-generated static | Simplest | Can't personalize |
| Cloudinary | Powerful, templates | External service |

**Recommended for MVP**: Pre-generated static images
**Future**: Vercel OG for dynamic cards ("Bayern needs 8 more contributors!")

---

## 12. Timing Attack Mitigations

### Concern
If update timestamps are visible and exact, observers might infer when specific people joined by watching when buckets appear or change.

### Mitigations Implemented

1. **Weekly display precision**
   - Aggregation runs daily internally
   - Public API returns `updated_at` at weekly precision only
   - "Data from the week of January 13"

2. **Range-based counts**
   - Don't show exact counts below threshold
   - Show "1-10" instead of "3"

3. **Minimum dwell time**
   - Bucket must have ≥11 users for ≥7 days before status changes to "available"
   - Prevents "it just crossed threshold" inference

4. **No per-user activity timestamps**
   - Activity stats are aggregates only
   - No "most recent contribution" timestamp exposed

### Privacy Policy Update Needed
Current policy says "daily aggregation at 3 AM". Update to reflect:
- Daily internal processing
- Weekly public visibility
- Dwell time before publication

---

## 13. Implementation Phases

### Phase 1: MVP Dashboard

**Prerequisites (YOU):**
- [ ] Set up `contact@openworkinghours.org` email
- [x] Create Datawrapper account (free tier works)
- [ ] Provide App Store / TestFlight link when ready

**Backend:**
- [x] Add `GET /dashboard/coverage` endpoint (public, returns state coverage status)
- [x] Add `GET /dashboard/activity` endpoint (public, returns 30-day activity)
- [x] Add `POST /dashboard/contact` endpoint
- [x] Add `institution_inquiries` table + migration
- [ ] Email notification on new inquiry

**Frontend (Astro + React):**
- [x] Create `/dashboard` page (EN)
- [x] Create `/de/dashboard` page (DE)
- [x] Hero section with CTAs
- [x] Coverage map (inline SVG + Datawrapper embed)
- [x] Progress strip component
- [x] "What becomes possible" preview section
- [x] Trust & method block
- [x] Institution section + contact form
- [x] Share section with social links
- [ ] OG meta tags for social sharing

**Content (EN + DE):**
- [x] Dashboard headline and subhead
- [x] Progress strip labels
- [x] "What becomes possible" descriptions
- [x] Trust block bullet points
- [x] Institution pitch copy
- [x] Contact form labels
- [x] Share section copy

**Design:**
- [ ] Create OG image (1200x630)
- [ ] Design "unlocks at 11+" preview mockups (can be blurred real charts)
- [ ] K-anonymity visual (11 people → 1 statistic)

**Datawrapper Integration:**
- [x] Created Datawrapper account and API token
- [x] Backend service (`app/services/datawrapper.py`) for API integration
- [x] Map update endpoint (`POST /dashboard/map-update`)
- [x] Embed info endpoint (`GET /dashboard/map-embed`)
- [ ] Determine minimum required API permissions (currently using all permissions)

**Notes (2026-01-18):**
- Endpoints use `/dashboard/*` prefix (not `/stats/*` as originally planned)
- Both inline SVG map and Datawrapper embed exist; may consolidate later
- Contact form stores to DB but doesn't send email notification yet

### Phase 2: Referral System + Polish

**Backend:**
- [ ] Add `referral_codes` table
- [ ] Add `referrals` tracking table
- [ ] Add `POST /referral/generate` endpoint
- [ ] Modify registration to accept `referral_code` param
- [ ] Add `GET /referral/stats` endpoint

**Mobile App:**
- [ ] Add "Invite colleague" button in settings or status screen
- [ ] Generate shareable referral link
- [ ] Show "You've invited X colleagues" stat

**Dashboard Enhancements:**
- [ ] Animated counters (subtle)
- [ ] Map hover interactions
- [ ] Mobile responsiveness polish

### Phase 3: Full Dashboard (when data exists, 100+ users)

**Backend:**
- [ ] Add `GET /stats/filtered` endpoint (authenticated)
- [ ] Implement per-filter k-anonymity checks

**Frontend:**
- [ ] Add web login (reuse email auth flow)
- [ ] Filter UI (state, specialty, time range)
- [ ] Comparison views (region vs national)
- [ ] Historical trend charts

---

## 14. Decisions Made (2026-01-17)

| Question | Decision |
|----------|----------|
| Bilingual? | **Yes, EN + DE from start** |
| App Store link | **Pending** - use placeholder, update when available |
| Institution contact email | `contact@openworkinghours.org` (needs setup) |
| Map implementation | **Datawrapper** (create account) or alternative |
| Referral system | **Phase 2** - not MVP |
| Timeline | **Near-term implementation** |
| Scrollytelling | **No** - single-page with sections |
| Animations | **Subtle only** (hover, transitions) |

---

## 15. Open Issues / TODOs

### Before Implementation

- [ ] **Set up contact@openworkinghours.org email** - Required for institution contact form
- [ ] **Create Datawrapper account** - Or decide on alternative (see below)
- [ ] **App Store / TestFlight link** - Update CTAs when available
- [ ] **OG image creation** - Design shareable social image

### Datawrapper Alternatives

If you prefer not to use Datawrapper, alternatives include:

| Option | Pros | Cons |
|--------|------|------|
| **Datawrapper** (recommended) | Professional, easy, responsive | Account required, external dependency |
| **Simple SVG + CSS** | No dependencies, full control | More manual work, less interactive |
| **Flourish** | Beautiful, animated | Similar to Datawrapper |
| **Chart.js + custom SVG** | Open source, flexible | More development time |

**Recommendation**: Create Datawrapper free account - it's the fastest path to a professional map.

---

## 16. References

### Research Sources
- [Trustworthy by Design (CHI 2025)](https://dl.acm.org/doi/10.1145/3706598.3713824)
- [r/dataisbeautiful community](https://en.wikipedia.org/wiki/R/dataisbeautiful)
- [Our World in Data redesign](https://ourworldindata.org/redesigning-our-interactive-data-visualizations)
- [NYT scrollytelling approach](https://www.storybench.org/scrollytelling-innovation-new-york-times-journalists-on-climate-change-visualization-and-intense-teamwork/)
- [Datawrapper choropleth maps](https://www.datawrapper.de/maps/choropleth-map)

### Internal References
- `privacy_architecture.md` - K-anonymity design
- `backend/ARCHITECTURE.md` - Existing stats endpoints
- `datasets/german_hospitals/` - Hospital reference data
- `website/` - Existing Astro site structure

---

## Appendix A: Color Palette

Using existing brand colors from `mobile-app/src/theme/colors.ts` and `website/src/styles/global.css`:

| Use | Color | Hex | Source |
|-----|-------|-----|--------|
| **Primary (Hospital Teal)** | Teal | `#2E8B6B` | Logo color |
| Primary Light | Teal-50 | `#E6F5F1` | Backgrounds |
| Primary Dark | Teal-800 | `#1A5741` | Hover states |
| **Coverage: None** | Stone-400 | `#A8A29E` | No contributors |
| **Coverage: Building** | Amber-500 | `#F59E0B` | 1-10 contributors |
| **Coverage: Available** | Success/Teal | `#2E8B6B` | 11+ contributors |
| **Background** | Stone-50 | `#FAFAF9` | Page background |
| **Text Primary** | Stone-900 | `#1C1917` | Headings |
| **Text Secondary** | Stone-600 | `#57534E` | Body text |
| **Warning** | Amber-600 | `#F57C00` | Alerts |
| **Error** | Red | `#D32F2F` | Errors |

### Logo Files
- Main logo: `/logo_for_mvp.png` (teal rounded square with clock + plus icon)
- Website favicon: `/website/public/favicon.svg`
- App icon: `/mobile-app/assets/icon.png`

### Typography
- Font family: Inter (via Tailwind)
- See `mobile-app/src/theme/typography.ts` for full scale

---

## Appendix B: Wireframe Sketches

(To be added - low-fidelity sketches of each section)

---

*This document captures the planning session of 2026-01-17. Update as decisions are made.*
