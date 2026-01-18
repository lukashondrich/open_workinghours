# Interactive Map Plan

**Created:** 2026-01-18
**Status:** Phase 1 In Progress
**Approach:** D3.js + GeoJSON (self-contained, no external runtime dependencies)

---

## 1. Vision

An interactive choropleth map of Germany showing:
- **State-level coverage status** (grey/amber/green)
- **Hospital locations as dots** (~1,220 hospitals)
- **Hover tooltips** with contextual information
- **Click-to-zoom** drill-down to Landkreise (districts)
- **Smooth animations** for zoom/pan transitions

---

## 2. Phases

### Phase 1: Foundation (Current)
- [ ] D3.js integration in Astro
- [ ] Germany states choropleth (replace current SVG)
- [ ] Hospital dots overlay
- [ ] Basic hover tooltip (hospital name)
- [ ] Zoom/pan controls

### Phase 2: Drill-Down
- [ ] Click state → zoom in
- [ ] Load Landkreise boundaries on zoom
- [ ] Landkreise visual styling (borders, no data yet)

### Phase 3: Full Interactivity
- [ ] Landkreise choropleth (when data available)
- [ ] Rich tooltips with stats
- [ ] Mobile touch support
- [ ] Performance optimization

---

## 3. Phase 1 Specifications

### 3.1 Visual Design

```
┌─────────────────────────────────────────────────────────────┐
│  Coverage Status                                            │
│  See which regions are building toward the privacy threshold│
│                                                             │
│  ┌─────────────────────────────────────┐  ┌──────────────┐ │
│  │                                     │  │ CONTRIBUTORS │ │
│  │     [Zoom +] [Zoom -] [Reset]       │  │     --       │ │
│  │                                     │  ├──────────────┤ │
│  │         • •    •                    │  │ SHIFTS       │ │
│  │       •  ████  • •                  │  │     --       │ │
│  │      • ████████ •      ← States     │  ├──────────────┤ │
│  │       █████████████•      colored   │  │ STATES       │ │
│  │      ████████████████ •   by status │  │     --       │ │
│  │       ███████████ • •               │  └──────────────┘ │
│  │         ███████                     │                   │
│  │            •    ← Hospital dots     │                   │
│  │                                     │                   │
│  └─────────────────────────────────────┘                   │
│                                                             │
│  Legend: ○ Hospital  ░ No data  ▒ Building  █ Available    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Acceptance Criteria - Phase 1

| ID | Criterion | Verification |
|----|-----------|--------------|
| P1-01 | Map renders Germany with 16 state boundaries | Visual check |
| P1-02 | States colored by coverage status (grey/amber/green) | Visual check |
| P1-03 | ~1,220 hospital dots visible on map | Count dots in screenshot |
| P1-04 | Hospital dots are small, subtle (not overwhelming) | Visual check |
| P1-05 | Hover on hospital shows tooltip with name | Playwright hover test |
| P1-06 | Zoom in/out buttons work | Playwright click test |
| P1-07 | Mouse wheel zoom works | Manual verification |
| P1-08 | Pan by drag works | Manual verification |
| P1-09 | Reset button returns to initial view | Playwright click test |
| P1-10 | No external runtime API calls | Network tab check |
| P1-11 | Renders correctly on mobile width (375px) | Playwright viewport test |
| P1-12 | Page loads in < 3 seconds | Playwright timing |

### 3.3 Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Library | D3.js v7 | Self-contained, powerful, widely used |
| Map projection | Mercator or Albers | Standard for Germany |
| GeoJSON source | Natural Earth / GADM | Open data, good quality |
| Hospital data | Local CSV → JSON | Already have coordinates |
| Tooltip library | D3 native or Tippy.js | TBD based on complexity |
| Bundle strategy | Astro + Vite | Already in stack |

### 3.4 Data Requirements

| Data | Source | Format | Status |
|------|--------|--------|--------|
| Germany states | TopoJSON/GeoJSON | ~50KB | Need to add |
| Hospital locations | `datasets/german_hospitals/output/german_hospitals.csv` | CSV→JSON | Available |
| Coverage status | Backend API `/dashboard/coverage` | JSON | Available |

### 3.5 File Structure

```
website/
├── src/
│   ├── components/
│   │   └── InteractiveMap/
│   │       ├── InteractiveMap.tsx    # React component (D3 inside)
│   │       ├── germany-states.json   # GeoJSON
│   │       ├── hospitals.json        # Hospital coordinates
│   │       └── styles.css            # Map-specific styles
│   └── pages/
│       └── dashboard.astro           # Updated to use new component
```

---

## 4. Color Palette

| Status | Color | Hex | Usage |
|--------|-------|-----|-------|
| No data | Stone-300 | `#D6D3D1` | States with 0 contributors |
| Building | Amber-400 | `#FBBF24` | States with 1-10 contributors |
| Available | Teal-600 | `#0D9488` | States with 11+ contributors |
| Hospital dot | Teal-700 | `#0F766E` | Hospital markers |
| Hospital dot hover | Teal-500 | `#14B8A6` | Hover state |
| Border | Stone-400 | `#A8A29E` | State boundaries |

---

## 5. Iteration Checkpoints

| Checkpoint | Description | Verify With |
|------------|-------------|-------------|
| CP-1 | D3 renders empty map container | Screenshot |
| CP-2 | Germany states visible (any color) | Screenshot |
| CP-3 | States colored by mock data | Screenshot |
| CP-4 | Hospital dots visible | Screenshot |
| CP-5 | Hover tooltip works | Screenshot + manual |
| CP-6 | Zoom/pan works | Manual |
| CP-7 | Full Phase 1 complete | All P1-* criteria |

---

## 6. Decisions (2026-01-18)

| Question | Decision |
|----------|----------|
| Tooltip content | Hospital name only |
| Dot sizing | Fixed size |
| Mobile zoom | Buttons only (no pinch-to-zoom) |
| Animation | None for now |

---

## 7. References

- [D3.js Documentation](https://d3js.org/)
- [Germany GeoJSON](https://github.com/isellsoap/deutschern-landkreise-geojson)
- [D3 Choropleth Tutorial](https://observablehq.com/@d3/choropleth)
- Hospital data: `datasets/german_hospitals/output/german_hospitals.csv`
