# Work History Screen Implementation Plan

**Created:** 2026-01-22
**Status:** Planning
**Updated:** 2026-01-22 (simplified after review)

---

## Overview

Replace the placeholder `LogScreen` with a work history screen displaying session history for a specific location:
- Flat list of sessions grouped by date (no expand/collapse)
- Preset date range filters (Week / Month / All)
- CSV export

### Entry Point

`TrackingScreen` → "View History" button → `LogScreen` with `locationId` param.

---

## UI Design

```
┌─────────────────────────────────────────────────────────────┐
│  [←]  Work History                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📍 Hospital Name                                           │
│                                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                     │
│  │   Week   │ │  Month   │ │   All    │   ← Preset tabs     │
│  └──────────┘ └──────────┘ └──────────┘                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  42h 30m  ·  12 sessions                                ││ ← Summary
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ─── Wednesday, Jan 22 ───────────────────────────────────  │ ← Date header
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  08:15 – 12:30                              4h 15m      ││
│  │  🤖 Automatic                                           ││
│  └─────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────┐│
│  │  13:00 – ongoing                            2h 30m      ││ ← Active session
│  │  ✋ Manual  ·  🟢 Active                                ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ─── Tuesday, Jan 21 ─────────────────────────────────────  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  07:00 – 15:30                              8h 30m      ││
│  │  🤖 Automatic                                           ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  ... more sessions ...                                      │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [📤 Export CSV]                                            │
└─────────────────────────────────────────────────────────────┘
```

### States

1. **Loading** - Spinner
2. **Empty** - "No sessions recorded" + hint
3. **Data** - Session list with headers
4. **Exporting** - Button shows loading indicator

---

## Data Model

### Existing Types (no changes)

```typescript
interface TrackingSession {
  id: string;
  locationId: string;
  clockIn: string;              // ISO8601
  clockOut: string | null;      // null = ongoing
  durationMinutes: number | null;
  trackingMethod: 'geofence_auto' | 'manual';
  state: SessionState;          // 'active' | 'pending_exit' | 'completed'
  // ...
}
```

### Screen State

```typescript
type DatePreset = 'week' | 'month' | 'all';

// Simple useState calls, no complex state object needed
const [loading, setLoading] = useState(true);
const [sessions, setSessions] = useState<TrackingSession[]>([]);
const [preset, setPreset] = useState<DatePreset>('week');
const [exporting, setExporting] = useState(false);
```

### Derived Data (computed, not stored)

```typescript
// Group sessions by date for SectionList
interface DayGroup {
  date: string;  // YYYY-MM-DD (section key)
  data: TrackingSession[];
}

// Computed in render
const sections: DayGroup[] = groupSessionsByDate(sessions);
const totalMinutes = sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0);
```

---

## Database Query

### New Method

Add to `Database.ts`:

```typescript
/**
 * Get sessions for a location within a date range.
 * Includes both completed and active sessions.
 */
async getSessionsInRange(
  locationId: string,
  startDate: string | null,  // null = no lower bound
  endDate: string | null     // null = no upper bound (today)
): Promise<TrackingSession[]> {
  // Build query dynamically based on which bounds are provided
  // Include active sessions (state IN ('active', 'pending_exit', 'completed'))
  // ORDER BY clock_in DESC
}
```

### Date Range Logic

```typescript
function getDateBounds(preset: DatePreset): { start: string | null; end: string } {
  const today = new Date();
  const end = formatDate(today); // YYYY-MM-DD

  switch (preset) {
    case 'week':
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { start: formatDate(weekAgo), end };
    case 'month':
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return { start: formatDate(monthAgo), end };
    case 'all':
      return { start: null, end };
  }
}
```

---

## Component Structure

**Keep it simple - two files:**

```
src/modules/geofencing/screens/
└── LogScreen.tsx              # Main screen (rewrite existing placeholder)

src/modules/geofencing/utils/
└── exportHistory.ts           # CSV generation + sharing logic
```

Everything else is inline in `LogScreen.tsx`:
- `SessionCard` - inline component for session display
- `DateHeader` - inline component for section headers
- Summary stats computed in render

---

## Export (CSV Only)

### Format

```csv
Date,Day,Clock In,Clock Out,Duration (hours),Method,Status
2026-01-22,Wednesday,08:15,12:30,4.25,Automatic,Completed
2026-01-22,Wednesday,13:00,,2.50,Manual,Active
2026-01-21,Tuesday,07:00,15:30,8.50,Automatic,Completed
```

### Implementation

```typescript
// src/modules/geofencing/utils/exportHistory.ts

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function exportSessionsToCSV(
  sessions: TrackingSession[],
  locationName: string
): Promise<void> {
  const csv = generateCSV(sessions);
  const filename = `work-history-${sanitize(locationName)}.csv`;
  const uri = FileSystem.documentDirectory + filename;

  await FileSystem.writeAsStringAsync(uri, csv);
  await Sharing.shareAsync(uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });
}

function generateCSV(sessions: TrackingSession[]): string {
  const header = 'Date,Day,Clock In,Clock Out,Duration (hours),Method,Status';
  const rows = sessions.map(s => {
    const date = formatDate(s.clockIn);
    const day = formatDayName(s.clockIn);
    const clockIn = formatTime(s.clockIn);
    const clockOut = s.clockOut ? formatTime(s.clockOut) : '';
    const hours = s.durationMinutes ? (s.durationMinutes / 60).toFixed(2) : '';
    const method = s.trackingMethod === 'geofence_auto' ? 'Automatic' : 'Manual';
    const status = s.state === 'completed' ? 'Completed' : 'Active';
    return `${date},${day},${clockIn},${clockOut},${hours},${method},${status}`;
  });
  return [header, ...rows].join('\n');
}
```

---

## i18n Strings

### English (`en.ts`)

```typescript
log: {
  // Remove old placeholder strings, add:
  noSessions: 'No Sessions Recorded',
  noSessionsHint: 'Sessions tracked at this location will appear here',

  // Filters
  week: 'Week',
  month: 'Month',
  all: 'All',

  // Summary
  totalTime: '{{hours}} total',
  sessionCount: '{{count}} sessions',
  sessionCountOne: '1 session',

  // Session display
  automatic: 'Automatic',
  manual: 'Manual',
  active: 'Active',
  ongoing: 'ongoing',

  // Export
  exportCSV: 'Export CSV',
  exportFailed: 'Export failed',

  // Errors
  loadFailed: 'Failed to load history',
}
```

### German (`de.ts`)

```typescript
log: {
  noSessions: 'Keine Sitzungen erfasst',
  noSessionsHint: 'An diesem Standort erfasste Sitzungen werden hier angezeigt',

  week: 'Woche',
  month: 'Monat',
  all: 'Alle',

  totalTime: '{{hours}} gesamt',
  sessionCount: '{{count}} Sitzungen',
  sessionCountOne: '1 Sitzung',

  automatic: 'Automatisch',
  manual: 'Manuell',
  active: 'Aktiv',
  ongoing: 'laufend',

  exportCSV: 'CSV exportieren',
  exportFailed: 'Export fehlgeschlagen',

  loadFailed: 'Verlauf konnte nicht geladen werden',
}
```

---

## Edge Cases

| Case | Handling |
|------|----------|
| Session spans midnight | Assign to clock-in date |
| Active session | Show with "ongoing" text, live duration, green badge |
| Location deleted | Screen checks if location exists, shows error if not |
| Empty range | Show empty state with appropriate message |
| Export with 0 sessions | Disable export button |

---

## Implementation Steps

### Step 1: Database Query
- Add `getSessionsInRange()` to `Database.ts`
- Include all session states (active + completed)

### Step 2: Basic Screen
- Rewrite `LogScreen.tsx`
- Fetch location + sessions on mount
- Display SectionList with date headers
- Show session cards with times, duration, method

### Step 3: Date Filtering
- Add preset tabs (Week/Month/All)
- Re-fetch sessions on tab change
- Show summary stats

### Step 4: Export
- Create `exportHistory.ts` utility
- Add export button to screen
- Handle loading/error states

### Step 5: i18n
- Add strings to `en.ts` and `de.ts`
- Wire up all text

### Step 6: Polish
- Pull-to-refresh
- Empty state design
- Error handling

---

## File Changes

| File | Change |
|------|--------|
| `Database.ts` | Add `getSessionsInRange()` |
| `LogScreen.tsx` | Rewrite (replace placeholder) |
| `exportHistory.ts` | Create (new) |
| `en.ts` | Update `log` section |
| `de.ts` | Update `log` section |

**Total: 5 files** (down from 12 in original plan)

---

## Dependencies

Verify these exist in `package.json`:
- `expo-file-system` ✓ (used by Report Issue feature)
- `expo-sharing` ✓ (used by Report Issue feature)

No new dependencies needed.

---

## Future Enhancements (Not MVP)

- Custom date range picker
- PDF export
- Session editing/deletion from this screen
- Search/filter by method type
- Pagination for very long histories

---

## Success Criteria

- [ ] Sessions display in flat list grouped by date
- [ ] Filter by Week/Month/All works
- [ ] Summary shows total hours and session count
- [ ] Active sessions show with "ongoing" indicator
- [ ] CSV export works via share sheet
- [ ] Empty state displays correctly
- [ ] Works in English and German
- [ ] Pull-to-refresh works
