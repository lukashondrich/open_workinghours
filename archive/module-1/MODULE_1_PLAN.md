# Module 1: Geofencing & Basic Tracking
## Modular Development Sub-Plan

**Parent Document**: blueprint.md
**Dependencies**: None (standalone module)
**Timeline**: 2-3 weeks
**Risk Level**: HIGH (this is the critical unknown)
**Success Criteria**: Background geofencing works reliably on iOS and Android with acceptable battery usage

---

## 1. Module Overview

### 1.1 Purpose

Build a **minimal but complete** mobile app that proves geofencing works in production. This module validates the highest-risk assumption in the blueprint: that healthcare workers can rely on automatic location tracking.

**What's included:**
- Bare Expo app with minimal navigation
- Location permission flow
- Geofence setup (map + radius)
- Background location tracking
- Simple clock-in/out log
- Local SQLite storage
- **Comprehensive testing at every layer**

**What's excluded (for now):**
- Email verification (use hardcoded user)
- Calendar/planning features
- Differential privacy
- Submission to backend
- Complex UI/UX polish

### 1.2 Why This Module First?

```
Traditional approach (from TODO.md):
Week 1: Backend → Week 2: App foundation → Week 3: Privacy → Week 6: Geofencing
                                                                   ↑
                                                    Risk discovered late!

Modular approach:
Week 1: Geofencing prototype → validate or pivot early
Week 2: Add other features on proven foundation
```

**Benefits:**
1. **De-risk early**: If geofencing doesn't work, pivot to manual entry
2. **Faster feedback**: Test on real devices by day 3
3. **Motivating**: See real location tracking working (not just privacy math)
4. **Testable**: Small surface area, easy to test thoroughly
5. **Reusable**: This module becomes the core of the full app

---

## 2. Architecture

### 2.1 Module Structure

```
mobile-app/
├── src/
│   ├── modules/
│   │   └── geofencing/                    # ← THIS MODULE
│   │       ├── __tests__/                 # Tests co-located
│   │       │   ├── GeofenceService.test.ts
│   │       │   ├── TrackingManager.test.ts
│   │       │   ├── Database.test.ts
│   │       │   └── integration.test.ts
│   │       │
│   │       ├── components/                # UI components
│   │       │   ├── LocationPicker.tsx
│   │       │   ├── GeofenceMap.tsx
│   │       │   ├── TrackingStatus.tsx
│   │       │   └── TrackingLog.tsx
│   │       │
│   │       ├── services/                  # Business logic
│   │       │   ├── GeofenceService.ts     # Wraps expo-location
│   │       │   ├── TrackingManager.ts     # Clock in/out logic
│   │       │   └── Database.ts            # SQLite operations
│   │       │
│   │       ├── screens/                   # Screen components
│   │       │   ├── SetupScreen.tsx        # Geofence setup
│   │       │   ├── TrackingScreen.tsx     # Live status
│   │       │   └── LogScreen.tsx          # View history
│   │       │
│   │       ├── hooks/                     # React hooks
│   │       │   ├── useGeofence.ts
│   │       │   ├── useTracking.ts
│   │       │   └── useTrackingLog.ts
│   │       │
│   │       ├── types.ts                   # TypeScript types
│   │       └── constants.ts               # Config values
│   │
│   ├── lib/                               # Shared utilities
│   │   └── test-utils.tsx                 # Testing helpers
│   │
│   └── App.tsx                            # Root component
│
├── e2e/                                   # End-to-end tests
│   └── geofencing.e2e.ts                  # Detox tests
│
├── scripts/                               # Helper scripts
│   ├── test-on-device.sh                  # Deploy to device
│   └── simulate-location.ts               # Fake GPS for testing
│
├── app.json                               # Expo config
├── eas.json                               # EAS Build config
├── jest.config.js                         # Jest setup
├── package.json
└── README.md
```

### 2.2 Data Model (Minimal)

**SQLite Schema (v1.0):**

```sql
-- User locations (geofences)
CREATE TABLE user_locations (
  id TEXT PRIMARY KEY,                    -- UUID
  name TEXT NOT NULL,                     -- "UCSF Medical Center"
  latitude REAL NOT NULL,                 -- 37.7625
  longitude REAL NOT NULL,                -- -122.4577
  radius_meters INTEGER NOT NULL,         -- 200
  is_active INTEGER DEFAULT 1,            -- Boolean (SQLite)
  created_at TEXT NOT NULL,               -- ISO8601
  updated_at TEXT NOT NULL
);

-- Tracked sessions (clock in/out events)
CREATE TABLE tracking_sessions (
  id TEXT PRIMARY KEY,                    -- UUID
  location_id TEXT NOT NULL,              -- FK to user_locations
  clock_in TEXT NOT NULL,                 -- ISO8601 timestamp
  clock_out TEXT,                         -- ISO8601 or NULL if active
  duration_minutes INTEGER,               -- Computed on clock-out
  tracking_method TEXT NOT NULL,          -- "geofence_auto" | "manual"
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (location_id) REFERENCES user_locations(id)
);

-- Geofence events log (for debugging)
CREATE TABLE geofence_events (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  event_type TEXT NOT NULL,               -- "enter" | "exit"
  timestamp TEXT NOT NULL,
  latitude REAL,                          -- Optional (for debugging)
  longitude REAL,
  accuracy REAL,                          -- meters
  FOREIGN KEY (location_id) REFERENCES user_locations(id)
);

-- Schema version tracking
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
INSERT INTO schema_version (version, applied_at) VALUES (1, datetime('now'));
```

**TypeScript Types:**

```typescript
// src/modules/geofencing/types.ts

export interface UserLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TrackingSession {
  id: string;
  locationId: string;
  clockIn: string;              // ISO8601
  clockOut: string | null;
  durationMinutes: number | null;
  trackingMethod: 'geofence_auto' | 'manual';
  createdAt: string;
  updatedAt: string;
}

export interface GeofenceEvent {
  id: string;
  locationId: string;
  eventType: 'enter' | 'exit';
  timestamp: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

export interface GeofenceConfig {
  minRadius: number;            // 100m
  maxRadius: number;            // 1000m
  defaultRadius: number;        // 200m
  exitDwellTime: number;        // 5 minutes (in ms)
  notifyOnEnter: boolean;
  notifyOnExit: boolean;
}
```

### 2.3 Service Layer Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        React Components                         │
│  (SetupScreen, TrackingScreen, LocationPicker, etc.)           │
└────────────────────┬───────────────────────────────────────────┘
                     │ uses hooks
                     ▼
┌────────────────────────────────────────────────────────────────┐
│                        React Hooks Layer                        │
│  useGeofence() • useTracking() • useTrackingLog()              │
└────────────────────┬───────────────────────────────────────────┘
                     │ calls services
                     ▼
┌────────────────────────────────────────────────────────────────┐
│                        Service Layer                            │
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐ │
│  │ GeofenceService  │  │ TrackingManager  │  │   Database   │ │
│  │                  │  │                  │  │              │ │
│  │ • register()     │  │ • clockIn()      │  │ • insert()   │ │
│  │ • unregister()   │  │ • clockOut()     │  │ • query()    │ │
│  │ • getStatus()    │  │ • getActive()    │  │ • update()   │ │
│  │ • onEvent()      │  │ • getHistory()   │  │ • delete()   │ │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘ │
│           │                     │                    │         │
└───────────┼─────────────────────┼────────────────────┼─────────┘
            │                     │                    │
            ▼                     ▼                    ▼
┌─────────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   expo-location     │  │ Business Logic  │  │   expo-sqlite   │
│ expo-task-manager   │  │   (pure JS)     │  │                 │
└─────────────────────┘  └─────────────────┘  └─────────────────┘
```

**Key principle**: Services are **pure TypeScript** (no React), making them easy to unit test.

---

## 3. Implementation Plan (Test-Driven)

### Phase 1.1: Project Setup (Day 1)

**Tasks:**

1. **Initialize Expo project**
   ```bash
   cd /Users/user01/open_workinghours
   npx create-expo-app mobile-app --template blank-typescript
   cd mobile-app
   ```

2. **Install dependencies**
   ```bash
   npx expo install expo-location expo-task-manager expo-sqlite expo-notifications
   npx expo install react-native-maps
   npm install uuid date-fns
   npm install -D jest @testing-library/react-native @testing-library/jest-native
   npm install -D detox detox-expo-helpers
   ```

3. **Configure TypeScript**
   ```json
   // tsconfig.json
   {
     "extends": "expo/tsconfig.base",
     "compilerOptions": {
       "strict": true,
       "baseUrl": ".",
       "paths": {
         "@/*": ["src/*"],
         "@geofencing/*": ["src/modules/geofencing/*"]
       }
     }
   }
   ```

4. **Set up Jest**
   ```javascript
   // jest.config.js
   module.exports = {
     preset: 'jest-expo',
     setupFilesAfterEnv: ['<rootDir>/src/lib/test-setup.ts'],
     transformIgnorePatterns: [
       'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
     ],
     collectCoverageFrom: [
       'src/**/*.{ts,tsx}',
       '!src/**/*.d.ts',
       '!src/**/__tests__/**'
     ],
     coverageThresholds: {
       global: {
         statements: 80,
         branches: 75,
         functions: 80,
         lines: 80
       }
     }
   };
   ```

5. **Create folder structure**
   ```bash
   mkdir -p src/modules/geofencing/{__tests__,components,services,screens,hooks}
   mkdir -p src/lib
   mkdir -p e2e
   mkdir -p scripts
   ```

6. **Set up test utilities**
   ```typescript
   // src/lib/test-setup.ts
   import '@testing-library/jest-native/extend-expect';

   // Mock expo modules
   jest.mock('expo-location', () => ({
     requestForegroundPermissionsAsync: jest.fn(),
     requestBackgroundPermissionsAsync: jest.fn(),
     startGeofencingAsync: jest.fn(),
     stopGeofencingAsync: jest.fn(),
     hasStartedGeofencingAsync: jest.fn(),
   }));

   jest.mock('expo-sqlite', () => ({
     openDatabaseAsync: jest.fn(),
   }));

   jest.mock('expo-notifications', () => ({
     scheduleNotificationAsync: jest.fn(),
     requestPermissionsAsync: jest.fn(),
   }));
   ```

**Testing checklist:**
- [ ] `npm test` runs without errors
- [ ] TypeScript compiles with no errors
- [ ] `expo start` launches dev server
- [ ] Can scan QR code and see blank app on device

**Deliverable**: Working Expo app that runs on your phone (blank screen is fine)

---

### Phase 1.2: Database Layer (Days 2-3)

**Goal**: Build and test local storage before adding any geofencing logic.

#### Step 1: Write Database Service (TDD Approach)

**First, write the test:**

```typescript
// src/modules/geofencing/__tests__/Database.test.ts

import { Database } from '../services/Database';
import { v4 as uuidv4 } from 'uuid';

describe('Database', () => {
  let db: Database;

  beforeEach(async () => {
    // Use in-memory database for testing
    db = new Database(':memory:');
    await db.initialize();
  });

  afterEach(async () => {
    await db.close();
  });

  describe('Schema', () => {
    it('should create all tables', async () => {
      const tables = await db.getTables();
      expect(tables).toContain('user_locations');
      expect(tables).toContain('tracking_sessions');
      expect(tables).toContain('geofence_events');
      expect(tables).toContain('schema_version');
    });

    it('should have schema version 1', async () => {
      const version = await db.getSchemaVersion();
      expect(version).toBe(1);
    });
  });

  describe('UserLocations', () => {
    it('should insert a location', async () => {
      const location = {
        id: uuidv4(),
        name: 'Test Hospital',
        latitude: 37.7625,
        longitude: -122.4577,
        radiusMeters: 200,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.insertLocation(location);
      const result = await db.getLocation(location.id);

      expect(result).toMatchObject({
        id: location.id,
        name: 'Test Hospital',
        latitude: 37.7625,
        longitude: -122.4577,
        radiusMeters: 200,
      });
    });

    it('should update a location', async () => {
      const location = await createTestLocation(db);

      await db.updateLocation(location.id, { radiusMeters: 300 });
      const updated = await db.getLocation(location.id);

      expect(updated?.radiusMeters).toBe(300);
      expect(updated?.updatedAt).not.toBe(location.updatedAt);
    });

    it('should delete a location', async () => {
      const location = await createTestLocation(db);

      await db.deleteLocation(location.id);
      const result = await db.getLocation(location.id);

      expect(result).toBeNull();
    });

    it('should list all active locations', async () => {
      await createTestLocation(db, { name: 'Hospital 1', isActive: true });
      await createTestLocation(db, { name: 'Hospital 2', isActive: true });
      await createTestLocation(db, { name: 'Hospital 3', isActive: false });

      const active = await db.getActiveLocations();

      expect(active).toHaveLength(2);
      expect(active.map(l => l.name)).toEqual(['Hospital 1', 'Hospital 2']);
    });
  });

  describe('TrackingSessions', () => {
    it('should create a session on clock-in', async () => {
      const location = await createTestLocation(db);
      const clockIn = new Date().toISOString();

      const session = await db.clockIn(location.id, clockIn, 'geofence_auto');

      expect(session).toMatchObject({
        locationId: location.id,
        clockIn,
        clockOut: null,
        trackingMethod: 'geofence_auto',
      });
    });

    it('should update session on clock-out', async () => {
      const location = await createTestLocation(db);
      const clockIn = new Date('2025-01-15T08:00:00Z').toISOString();
      const session = await db.clockIn(location.id, clockIn, 'geofence_auto');

      const clockOut = new Date('2025-01-15T16:30:00Z').toISOString();
      await db.clockOut(session.id, clockOut);

      const updated = await db.getSession(session.id);
      expect(updated?.clockOut).toBe(clockOut);
      expect(updated?.durationMinutes).toBe(510); // 8.5 hours = 510 min
    });

    it('should return active session for location', async () => {
      const location = await createTestLocation(db);
      const session = await db.clockIn(location.id, new Date().toISOString(), 'manual');

      const active = await db.getActiveSession(location.id);

      expect(active?.id).toBe(session.id);
      expect(active?.clockOut).toBeNull();
    });

    it('should return null if no active session', async () => {
      const location = await createTestLocation(db);

      const active = await db.getActiveSession(location.id);

      expect(active).toBeNull();
    });

    it('should get session history', async () => {
      const location = await createTestLocation(db);

      // Create 3 completed sessions
      for (let i = 0; i < 3; i++) {
        const clockIn = new Date(`2025-01-${10 + i}T08:00:00Z`).toISOString();
        const clockOut = new Date(`2025-01-${10 + i}T16:00:00Z`).toISOString();
        const session = await db.clockIn(location.id, clockIn, 'geofence_auto');
        await db.clockOut(session.id, clockOut);
      }

      const history = await db.getSessionHistory(location.id, 10);

      expect(history).toHaveLength(3);
      expect(history[0].clockIn).toBe('2025-01-12T08:00:00.000Z'); // Most recent first
    });
  });

  describe('GeofenceEvents', () => {
    it('should log enter event', async () => {
      const location = await createTestLocation(db);
      const timestamp = new Date().toISOString();

      const event = await db.logGeofenceEvent({
        locationId: location.id,
        eventType: 'enter',
        timestamp,
        latitude: 37.7625,
        longitude: -122.4577,
        accuracy: 15,
      });

      expect(event.eventType).toBe('enter');
      expect(event.latitude).toBe(37.7625);
    });

    it('should retrieve events for location', async () => {
      const location = await createTestLocation(db);

      await db.logGeofenceEvent({
        locationId: location.id,
        eventType: 'enter',
        timestamp: new Date().toISOString(),
      });
      await db.logGeofenceEvent({
        locationId: location.id,
        eventType: 'exit',
        timestamp: new Date().toISOString(),
      });

      const events = await db.getGeofenceEvents(location.id, 10);

      expect(events).toHaveLength(2);
      expect(events[0].eventType).toBe('exit'); // Most recent first
      expect(events[1].eventType).toBe('enter');
    });
  });

  describe('Error Handling', () => {
    it('should throw on duplicate location ID', async () => {
      const location = await createTestLocation(db);

      await expect(
        db.insertLocation({ ...location, name: 'Different Name' })
      ).rejects.toThrow(/UNIQUE constraint/);
    });

    it('should throw on invalid foreign key', async () => {
      await expect(
        db.clockIn('invalid-location-id', new Date().toISOString(), 'manual')
      ).rejects.toThrow(/FOREIGN KEY constraint/);
    });
  });

  describe('Migrations', () => {
    it('should handle schema upgrades', async () => {
      // This will be important later
      // For now, just verify version tracking works
      const version = await db.getSchemaVersion();
      expect(version).toBe(1);
    });
  });
});

// Test helpers
async function createTestLocation(db: Database, overrides = {}) {
  const location = {
    id: uuidv4(),
    name: 'Test Hospital',
    latitude: 37.7625,
    longitude: -122.4577,
    radiusMeters: 200,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
  await db.insertLocation(location);
  return location;
}
```

**Then, implement the service:**

```typescript
// src/modules/geofencing/services/Database.ts

import * as SQLite from 'expo-sqlite';
import { UserLocation, TrackingSession, GeofenceEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class Database {
  private db: SQLite.SQLiteDatabase | null = null;
  private dbName: string;

  constructor(dbName: string = 'workinghours.db') {
    this.dbName = dbName;
  }

  async initialize(): Promise<void> {
    this.db = await SQLite.openDatabaseAsync(this.dbName);
    await this.createTables();
  }

  async close(): Promise<void> {
    await this.db?.closeAsync();
    this.db = null;
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_locations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        radius_meters INTEGER NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tracking_sessions (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL,
        clock_in TEXT NOT NULL,
        clock_out TEXT,
        duration_minutes INTEGER,
        tracking_method TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (location_id) REFERENCES user_locations(id)
      );

      CREATE TABLE IF NOT EXISTS geofence_events (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        accuracy REAL,
        FOREIGN KEY (location_id) REFERENCES user_locations(id)
      );

      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      INSERT OR IGNORE INTO schema_version (version, applied_at)
      VALUES (1, datetime('now'));
    `);
  }

  // Schema introspection
  async getTables(): Promise<string[]> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    );
    return result.map(r => r.name);
  }

  async getSchemaVersion(): Promise<number> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync<{ version: number }>(
      'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
    );
    return result?.version ?? 0;
  }

  // User Locations CRUD
  async insertLocation(location: UserLocation): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `INSERT INTO user_locations
       (id, name, latitude, longitude, radius_meters, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      location.id,
      location.name,
      location.latitude,
      location.longitude,
      location.radiusMeters,
      location.isActive ? 1 : 0,
      location.createdAt,
      location.updatedAt
    );
  }

  async getLocation(id: string): Promise<UserLocation | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync<any>(
      'SELECT * FROM user_locations WHERE id = ?',
      id
    );

    return result ? this.mapLocation(result) : null;
  }

  async getActiveLocations(): Promise<UserLocation[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync<any>(
      'SELECT * FROM user_locations WHERE is_active = 1 ORDER BY name'
    );

    return results.map(this.mapLocation);
  }

  async updateLocation(id: string, updates: Partial<UserLocation>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const setClauses: string[] = [];
    const values: any[] = [];

    if (updates.name !== undefined) {
      setClauses.push('name = ?');
      values.push(updates.name);
    }
    if (updates.radiusMeters !== undefined) {
      setClauses.push('radius_meters = ?');
      values.push(updates.radiusMeters);
    }
    if (updates.isActive !== undefined) {
      setClauses.push('is_active = ?');
      values.push(updates.isActive ? 1 : 0);
    }

    setClauses.push('updated_at = ?');
    values.push(new Date().toISOString());

    values.push(id);

    await this.db.runAsync(
      `UPDATE user_locations SET ${setClauses.join(', ')} WHERE id = ?`,
      ...values
    );
  }

  async deleteLocation(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync('DELETE FROM user_locations WHERE id = ?', id);
  }

  // Tracking Sessions
  async clockIn(
    locationId: string,
    clockIn: string,
    trackingMethod: 'geofence_auto' | 'manual'
  ): Promise<TrackingSession> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();
    const now = new Date().toISOString();

    await this.db.runAsync(
      `INSERT INTO tracking_sessions
       (id, location_id, clock_in, tracking_method, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      locationId,
      clockIn,
      trackingMethod,
      now,
      now
    );

    return {
      id,
      locationId,
      clockIn,
      clockOut: null,
      durationMinutes: null,
      trackingMethod,
      createdAt: now,
      updatedAt: now,
    };
  }

  async clockOut(sessionId: string, clockOut: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    // Get session to calculate duration
    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const clockInTime = new Date(session.clockIn).getTime();
    const clockOutTime = new Date(clockOut).getTime();
    const durationMinutes = Math.round((clockOutTime - clockInTime) / 1000 / 60);

    await this.db.runAsync(
      `UPDATE tracking_sessions
       SET clock_out = ?, duration_minutes = ?, updated_at = ?
       WHERE id = ?`,
      clockOut,
      durationMinutes,
      new Date().toISOString(),
      sessionId
    );
  }

  async getSession(id: string): Promise<TrackingSession | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync<any>(
      'SELECT * FROM tracking_sessions WHERE id = ?',
      id
    );

    return result ? this.mapSession(result) : null;
  }

  async getActiveSession(locationId: string): Promise<TrackingSession | null> {
    if (!this.db) throw new Error('Database not initialized');

    const result = await this.db.getFirstAsync<any>(
      `SELECT * FROM tracking_sessions
       WHERE location_id = ? AND clock_out IS NULL
       ORDER BY clock_in DESC LIMIT 1`,
      locationId
    );

    return result ? this.mapSession(result) : null;
  }

  async getSessionHistory(locationId: string, limit: number): Promise<TrackingSession[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync<any>(
      `SELECT * FROM tracking_sessions
       WHERE location_id = ?
       ORDER BY clock_in DESC
       LIMIT ?`,
      locationId,
      limit
    );

    return results.map(this.mapSession);
  }

  // Geofence Events
  async logGeofenceEvent(event: Omit<GeofenceEvent, 'id'>): Promise<GeofenceEvent> {
    if (!this.db) throw new Error('Database not initialized');

    const id = uuidv4();

    await this.db.runAsync(
      `INSERT INTO geofence_events
       (id, location_id, event_type, timestamp, latitude, longitude, accuracy)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      id,
      event.locationId,
      event.eventType,
      event.timestamp,
      event.latitude ?? null,
      event.longitude ?? null,
      event.accuracy ?? null
    );

    return { id, ...event };
  }

  async getGeofenceEvents(locationId: string, limit: number): Promise<GeofenceEvent[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync<any>(
      `SELECT * FROM geofence_events
       WHERE location_id = ?
       ORDER BY timestamp DESC
       LIMIT ?`,
      locationId,
      limit
    );

    return results.map(this.mapEvent);
  }

  // Mappers (SQLite to TypeScript)
  private mapLocation(row: any): UserLocation {
    return {
      id: row.id,
      name: row.name,
      latitude: row.latitude,
      longitude: row.longitude,
      radiusMeters: row.radius_meters,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapSession(row: any): TrackingSession {
    return {
      id: row.id,
      locationId: row.location_id,
      clockIn: row.clock_in,
      clockOut: row.clock_out,
      durationMinutes: row.duration_minutes,
      trackingMethod: row.tracking_method,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapEvent(row: any): GeofenceEvent {
    return {
      id: row.id,
      locationId: row.location_id,
      eventType: row.event_type,
      timestamp: row.timestamp,
      latitude: row.latitude,
      longitude: row.longitude,
      accuracy: row.accuracy,
    };
  }
}

// Singleton instance
let dbInstance: Database | null = null;

export async function getDatabase(): Promise<Database> {
  if (!dbInstance) {
    dbInstance = new Database();
    await dbInstance.initialize();
  }
  return dbInstance;
}
```

**Run tests:**

```bash
npm test -- Database.test.ts
```

**Testing checklist:**
- [ ] All 15+ database tests pass
- [ ] Test coverage >90% for Database.ts
- [ ] Can create/read/update/delete locations
- [ ] Can track clock-in/clock-out sessions
- [ ] Foreign key constraints work
- [ ] Schema version is tracked

**Deliverable**: Fully tested database layer with 90%+ coverage

---

### Phase 1.3: Geofence Service (Days 4-5)

**Goal**: Wrap expo-location with testable service layer.

#### Step 1: Write GeofenceService Tests

```typescript
// src/modules/geofencing/__tests__/GeofenceService.test.ts

import { GeofenceService } from '../services/GeofenceService';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

// Mock expo modules
jest.mock('expo-location');
jest.mock('expo-task-manager');

describe('GeofenceService', () => {
  let service: GeofenceService;

  beforeEach(() => {
    service = new GeofenceService();
    jest.clearAllMocks();
  });

  describe('Permission Handling', () => {
    it('should request foreground permissions', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await service.requestForegroundPermissions();

      expect(result).toBe(true);
      expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalled();
    });

    it('should return false if foreground permission denied', async () => {
      (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'denied',
      });

      const result = await service.requestForegroundPermissions();

      expect(result).toBe(false);
    });

    it('should request background permissions', async () => {
      (Location.requestBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await service.requestBackgroundPermissions();

      expect(result).toBe(true);
    });

    it('should check if has background permissions', async () => {
      (Location.getBackgroundPermissionsAsync as jest.Mock).mockResolvedValue({
        status: 'granted',
      });

      const result = await service.hasBackgroundPermissions();

      expect(result).toBe(true);
    });
  });

  describe('Geofence Registration', () => {
    const testLocation = {
      id: 'loc-123',
      name: 'Test Hospital',
      latitude: 37.7625,
      longitude: -122.4577,
      radiusMeters: 200,
      isActive: true,
      createdAt: '2025-01-15T10:00:00Z',
      updatedAt: '2025-01-15T10:00:00Z',
    };

    beforeEach(() => {
      (Location.hasStartedGeofencingAsync as jest.Mock).mockResolvedValue(false);
    });

    it('should register a geofence', async () => {
      await service.registerGeofence(testLocation);

      expect(Location.startGeofencingAsync).toHaveBeenCalledWith(
        'GEOFENCE_TASK',
        [
          {
            identifier: 'loc-123',
            latitude: 37.7625,
            longitude: -122.4577,
            radius: 200,
            notifyOnEnter: true,
            notifyOnExit: true,
          },
        ]
      );
    });

    it('should add to existing geofences if already started', async () => {
      (Location.hasStartedGeofencingAsync as jest.Mock).mockResolvedValue(true);

      await service.registerGeofence(testLocation);

      expect(Location.stopGeofencingAsync).toHaveBeenCalledWith('GEOFENCE_TASK');
      expect(Location.startGeofencingAsync).toHaveBeenCalled();
    });

    it('should unregister a geofence', async () => {
      // Register first
      await service.registerGeofence(testLocation);

      // Then unregister
      await service.unregisterGeofence('loc-123');

      // Should restart with empty list or stop completely
      expect(Location.stopGeofencingAsync).toHaveBeenCalled();
    });

    it('should get all registered geofences', async () => {
      await service.registerGeofence(testLocation);

      const geofences = service.getRegisteredGeofences();

      expect(geofences).toHaveLength(1);
      expect(geofences[0].identifier).toBe('loc-123');
    });
  });

  describe('Geofence Status', () => {
    it('should check if geofencing is active', async () => {
      (Location.hasStartedGeofencingAsync as jest.Mock).mockResolvedValue(true);

      const isActive = await service.isGeofencingActive();

      expect(isActive).toBe(true);
    });
  });

  describe('Task Definition', () => {
    it('should define background task', () => {
      const mockCallback = jest.fn();

      service.defineBackgroundTask(mockCallback);

      expect(TaskManager.defineTask).toHaveBeenCalledWith(
        'GEOFENCE_TASK',
        expect.any(Function)
      );
    });

    it('should handle task callback', async () => {
      let taskHandler: any;
      (TaskManager.defineTask as jest.Mock).mockImplementation((name, handler) => {
        taskHandler = handler;
      });

      const mockCallback = jest.fn();
      service.defineBackgroundTask(mockCallback);

      // Simulate geofence event
      const eventData = {
        eventType: Location.GeofencingEventType.Enter,
        region: {
          identifier: 'loc-123',
          latitude: 37.7625,
          longitude: -122.4577,
          radius: 200,
        },
      };

      await taskHandler({ data: { eventType: 1, region: eventData.region }, error: null });

      expect(mockCallback).toHaveBeenCalledWith({
        eventType: 'enter',
        locationId: 'loc-123',
        timestamp: expect.any(String),
      });
    });
  });
});
```

#### Step 2: Implement GeofenceService

```typescript
// src/modules/geofencing/services/GeofenceService.ts

import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { UserLocation } from '../types';

const GEOFENCE_TASK_NAME = 'GEOFENCE_TASK';

export interface GeofenceEventData {
  eventType: 'enter' | 'exit';
  locationId: string;
  timestamp: string;
  latitude?: number;
  longitude?: number;
}

export type GeofenceCallback = (event: GeofenceEventData) => void;

export class GeofenceService {
  private registeredGeofences: Map<string, Location.LocationRegion> = new Map();

  /**
   * Request foreground location permissions
   */
  async requestForegroundPermissions(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Request background location permissions (required for geofencing)
   */
  async requestBackgroundPermissions(): Promise<boolean> {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Check if app has background permissions
   */
  async hasBackgroundPermissions(): Promise<boolean> {
    const { status } = await Location.getBackgroundPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Check if app has foreground permissions
   */
  async hasForegroundPermissions(): Promise<boolean> {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  }

  /**
   * Register a geofence for a user location
   */
  async registerGeofence(location: UserLocation): Promise<void> {
    const region: Location.LocationRegion = {
      identifier: location.id,
      latitude: location.latitude,
      longitude: location.longitude,
      radius: location.radiusMeters,
      notifyOnEnter: true,
      notifyOnExit: true,
    };

    this.registeredGeofences.set(location.id, region);

    // If geofencing already started, need to restart with updated list
    const isActive = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
    if (isActive) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    }

    // Start with all registered geofences
    await Location.startGeofencingAsync(
      GEOFENCE_TASK_NAME,
      Array.from(this.registeredGeofences.values())
    );
  }

  /**
   * Unregister a geofence
   */
  async unregisterGeofence(locationId: string): Promise<void> {
    this.registeredGeofences.delete(locationId);

    // Restart with remaining geofences
    const isActive = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
    if (isActive) {
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    }

    if (this.registeredGeofences.size > 0) {
      await Location.startGeofencingAsync(
        GEOFENCE_TASK_NAME,
        Array.from(this.registeredGeofences.values())
      );
    }
  }

  /**
   * Stop all geofencing
   */
  async stopAll(): Promise<void> {
    await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    this.registeredGeofences.clear();
  }

  /**
   * Check if geofencing is currently active
   */
  async isGeofencingActive(): Promise<boolean> {
    return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
  }

  /**
   * Get list of registered geofences
   */
  getRegisteredGeofences(): Location.LocationRegion[] {
    return Array.from(this.registeredGeofences.values());
  }

  /**
   * Define the background task that handles geofence events
   * This should be called once at app startup
   */
  defineBackgroundTask(callback: GeofenceCallback): void {
    TaskManager.defineTask(GEOFENCE_TASK_NAME, async ({ data, error }) => {
      if (error) {
        console.error('[GeofenceService] Task error:', error);
        return;
      }

      if (data) {
        const { eventType, region } = data as {
          eventType: Location.GeofencingEventType;
          region: Location.LocationRegion;
        };

        const event: GeofenceEventData = {
          eventType: eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit',
          locationId: region.identifier,
          timestamp: new Date().toISOString(),
          latitude: region.latitude,
          longitude: region.longitude,
        };

        callback(event);
      }
    });
  }
}

// Singleton instance
let serviceInstance: GeofenceService | null = null;

export function getGeofenceService(): GeofenceService {
  if (!serviceInstance) {
    serviceInstance = new GeofenceService();
  }
  return serviceInstance;
}
```

**Testing checklist:**
- [ ] All geofence service tests pass
- [ ] Permission requests are tested
- [ ] Geofence registration logic is tested
- [ ] Background task definition is tested
- [ ] Test coverage >85%

**Deliverable**: Fully tested GeofenceService with mocked expo-location

---

### Phase 1.4: Tracking Manager (Day 6)

**Goal**: Business logic that connects geofence events to database storage.

```typescript
// src/modules/geofencing/services/TrackingManager.ts

import { Database } from './Database';
import { GeofenceEventData } from './GeofenceService';
import * as Notifications from 'expo-notifications';

export class TrackingManager {
  constructor(private db: Database) {}

  /**
   * Handle geofence enter event → auto clock-in
   */
  async handleGeofenceEnter(event: GeofenceEventData): Promise<void> {
    console.log('[TrackingManager] Enter event:', event);

    // Check if already clocked in
    const activeSession = await this.db.getActiveSession(event.locationId);
    if (activeSession) {
      console.log('[TrackingManager] Already clocked in, ignoring enter event');
      return;
    }

    // Clock in
    const session = await this.db.clockIn(
      event.locationId,
      event.timestamp,
      'geofence_auto'
    );

    // Log event
    await this.db.logGeofenceEvent({
      locationId: event.locationId,
      eventType: 'enter',
      timestamp: event.timestamp,
      latitude: event.latitude,
      longitude: event.longitude,
    });

    // Get location name for notification
    const location = await this.db.getLocation(event.locationId);
    const locationName = location?.name ?? 'Unknown Location';

    // Send notification
    await this.sendNotification(
      'Clocked In',
      `🟢 Clocked in at ${locationName}`,
      { sessionId: session.id }
    );
  }

  /**
   * Handle geofence exit event → auto clock-out (with hysteresis)
   */
  async handleGeofenceExit(event: GeofenceEventData): Promise<void> {
    console.log('[TrackingManager] Exit event:', event);

    // Get active session
    const activeSession = await this.db.getActiveSession(event.locationId);
    if (!activeSession) {
      console.log('[TrackingManager] No active session, ignoring exit event');
      return;
    }

    // TODO: Implement 5-minute hysteresis
    // For now, clock out immediately

    // Clock out
    await this.db.clockOut(activeSession.id, event.timestamp);

    // Log event
    await this.db.logGeofenceEvent({
      locationId: event.locationId,
      eventType: 'exit',
      timestamp: event.timestamp,
      latitude: event.latitude,
      longitude: event.longitude,
    });

    // Get updated session with duration
    const completedSession = await this.db.getSession(activeSession.id);
    const hours = completedSession?.durationMinutes
      ? (completedSession.durationMinutes / 60).toFixed(1)
      : '0';

    // Get location name
    const location = await this.db.getLocation(event.locationId);
    const locationName = location?.name ?? 'Unknown Location';

    // Send notification
    await this.sendNotification(
      'Clocked Out',
      `Clocked out from ${locationName}. Worked ${hours} hours.`,
      { sessionId: activeSession.id }
    );
  }

  /**
   * Manual clock-in
   */
  async clockIn(locationId: string): Promise<void> {
    const activeSession = await this.db.getActiveSession(locationId);
    if (activeSession) {
      throw new Error('Already clocked in at this location');
    }

    await this.db.clockIn(locationId, new Date().toISOString(), 'manual');
  }

  /**
   * Manual clock-out
   */
  async clockOut(locationId: string): Promise<void> {
    const activeSession = await this.db.getActiveSession(locationId);
    if (!activeSession) {
      throw new Error('No active session at this location');
    }

    await this.db.clockOut(activeSession.id, new Date().toISOString());
  }

  /**
   * Get active session for a location
   */
  async getActiveSession(locationId: string) {
    return await this.db.getActiveSession(locationId);
  }

  /**
   * Get tracking history
   */
  async getHistory(locationId: string, limit: number = 50) {
    return await this.db.getSessionHistory(locationId, limit);
  }

  /**
   * Send push notification
   */
  private async sendNotification(
    title: string,
    body: string,
    data: any = {}
  ): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: { title, body, data },
        trigger: null, // Send immediately
      });
    } catch (error) {
      console.error('[TrackingManager] Failed to send notification:', error);
    }
  }
}
```

**Test file** (I'll spare the full test, but key scenarios):

```typescript
// Key test cases:
describe('TrackingManager', () => {
  // ✅ Should clock in on geofence enter
  // ✅ Should ignore enter if already clocked in
  // ✅ Should clock out on geofence exit
  // ✅ Should ignore exit if not clocked in
  // ✅ Should calculate duration correctly
  // ✅ Should send notifications
  // ✅ Manual clock in/out should work
  // ✅ Should throw error if manual clock in twice
});
```

**Testing checklist:**
- [ ] All tracking manager tests pass
- [ ] Handles enter/exit events correctly
- [ ] Prevents duplicate clock-ins
- [ ] Calculates duration accurately
- [ ] Sends notifications (mocked)

**Deliverable**: TrackingManager with full test coverage

---

### Phase 1.5: UI Components (Days 7-10)

Now we build the screens. I'll provide outlines:

#### Screen 1: Setup Screen (Geofence Configuration)

```typescript
// src/modules/geofencing/screens/SetupScreen.tsx

import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import { useGeofence } from '../hooks/useGeofence';

export function SetupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [radius, setRadius] = useState(200);
  const [region, setRegion] = useState({
    latitude: 37.7749,
    longitude: -122.4194,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const { createLocation, requestPermissions } = useGeofence();

  const handleSave = async () => {
    await requestPermissions();
    await createLocation({
      name,
      latitude: region.latitude,
      longitude: region.longitude,
      radiusMeters: radius,
    });
    navigation.navigate('Tracking');
  };

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
      >
        <Marker coordinate={region} />
        <Circle
          center={region}
          radius={radius}
          strokeColor="rgba(0, 112, 255, 0.5)"
          fillColor="rgba(0, 112, 255, 0.2)"
        />
      </MapView>

      <View style={styles.controls}>
        <TextInput
          placeholder="Location name (e.g., UCSF Medical Center)"
          value={name}
          onChangeText={setName}
          style={styles.input}
        />

        <Text>Radius: {radius}m</Text>
        <Slider
          minimumValue={100}
          maximumValue={1000}
          step={50}
          value={radius}
          onValueChange={setRadius}
        />

        <Button title="Save Location" onPress={handleSave} disabled={!name} />
      </View>
    </View>
  );
}
```

#### Screen 2: Tracking Screen (Live Status)

```typescript
// src/modules/geofencing/screens/TrackingScreen.tsx

import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useTracking } from '../hooks/useTracking';

export function TrackingScreen() {
  const {
    activeSession,
    location,
    clockIn,
    clockOut,
    isLoading,
  } = useTracking();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{location?.name ?? 'No Location'}</Text>

      {activeSession ? (
        <View style={styles.active}>
          <Text style={styles.status}>🟢 Currently Working</Text>
          <Text style={styles.time}>
            Clocked in at {new Date(activeSession.clockIn).toLocaleTimeString()}
          </Text>
          <Text style={styles.duration}>
            Duration: {calculateDuration(activeSession.clockIn)} hours
          </Text>
          <Button
            title="Clock Out"
            onPress={clockOut}
            disabled={isLoading}
          />
        </View>
      ) : (
        <View style={styles.inactive}>
          <Text style={styles.status}>⚫ Not Working</Text>
          <Button
            title="Clock In"
            onPress={clockIn}
            disabled={isLoading}
          />
        </View>
      )}

      <Text style={styles.hint}>
        {activeSession
          ? 'Leave the geofence area to auto clock-out'
          : 'Enter the geofence area to auto clock-in'}
      </Text>
    </View>
  );
}

function calculateDuration(clockIn: string): string {
  const now = Date.now();
  const start = new Date(clockIn).getTime();
  const hours = ((now - start) / 1000 / 60 / 60).toFixed(1);
  return hours;
}
```

#### Screen 3: Log Screen (History)

```typescript
// src/modules/geofencing/screens/LogScreen.tsx

import React from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { useTrackingLog } from '../hooks/useTrackingLog';

export function LogScreen() {
  const { sessions, isLoading } = useTrackingLog();

  return (
    <FlatList
      data={sessions}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.item}>
          <Text style={styles.date}>
            {new Date(item.clockIn).toLocaleDateString()}
          </Text>
          <Text style={styles.time}>
            {new Date(item.clockIn).toLocaleTimeString()} -{' '}
            {item.clockOut ? new Date(item.clockOut).toLocaleTimeString() : 'Active'}
          </Text>
          <Text style={styles.duration}>
            {item.durationMinutes
              ? `${(item.durationMinutes / 60).toFixed(1)} hours`
              : 'In progress'}
          </Text>
          <Text style={styles.method}>
            {item.trackingMethod === 'geofence_auto' ? '📍 Auto' : '✋ Manual'}
          </Text>
        </View>
      )}
      ListEmptyComponent={
        <Text style={styles.empty}>No tracking history yet</Text>
      }
    />
  );
}
```

**Custom Hooks** (connect UI to services):

```typescript
// src/modules/geofencing/hooks/useGeofence.ts

import { useState, useEffect } from 'react';
import { getDatabase } from '../services/Database';
import { getGeofenceService } from '../services/GeofenceService';
import { v4 as uuidv4 } from 'uuid';

export function useGeofence() {
  const [locations, setLocations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const db = getDatabase();
  const geofenceService = getGeofenceService();

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    const locs = await db.getActiveLocations();
    setLocations(locs);
  };

  const createLocation = async (data) => {
    setIsLoading(true);
    try {
      const location = {
        id: uuidv4(),
        ...data,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.insertLocation(location);
      await geofenceService.registerGeofence(location);
      await loadLocations();
    } finally {
      setIsLoading(false);
    }
  };

  const requestPermissions = async () => {
    const foreground = await geofenceService.requestForegroundPermissions();
    if (!foreground) throw new Error('Foreground permission denied');

    const background = await geofenceService.requestBackgroundPermissions();
    if (!background) throw new Error('Background permission denied');
  };

  return {
    locations,
    createLocation,
    requestPermissions,
    isLoading,
  };
}
```

**Testing UI** (React Testing Library):

```typescript
// src/modules/geofencing/__tests__/SetupScreen.test.tsx

import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { SetupScreen } from '../screens/SetupScreen';

describe('SetupScreen', () => {
  it('should render map and controls', () => {
    const { getByPlaceholderText, getByText } = render(<SetupScreen />);

    expect(getByPlaceholderText(/Location name/)).toBeTruthy();
    expect(getByText(/Radius:/)).toBeTruthy();
  });

  it('should create location on save', async () => {
    const { getByPlaceholderText, getByText } = render(<SetupScreen />);

    fireEvent.changeText(getByPlaceholderText(/Location name/), 'Test Hospital');
    fireEvent.press(getByText('Save Location'));

    await waitFor(() => {
      // Verify navigation happened or location was created
    });
  });
});
```

---

### Phase 1.6: Integration & Device Testing (Days 11-14)

**Goal**: Assemble everything and test on real devices.

#### Step 1: Wire Up App.tsx

```typescript
// src/App.tsx

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';

import { SetupScreen } from './modules/geofencing/screens/SetupScreen';
import { TrackingScreen } from './modules/geofencing/screens/TrackingScreen';
import { LogScreen } from './modules/geofencing/screens/LogScreen';

import { getDatabase } from './modules/geofencing/services/Database';
import { getGeofenceService } from './modules/geofencing/services/GeofenceService';
import { TrackingManager } from './modules/geofencing/services/TrackingManager';

const Stack = createNativeStackNavigator();

export default function App() {
  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    // Initialize database
    const db = await getDatabase();

    // Initialize geofencing
    const geofenceService = getGeofenceService();
    const trackingManager = new TrackingManager(db);

    // Define background task
    geofenceService.defineBackgroundTask(async (event) => {
      console.log('[App] Geofence event:', event);

      if (event.eventType === 'enter') {
        await trackingManager.handleGeofenceEnter(event);
      } else {
        await trackingManager.handleGeofenceExit(event);
      }
    });

    // Request notification permissions
    await Notifications.requestPermissionsAsync();

    // Re-register any existing geofences
    const locations = await db.getActiveLocations();
    for (const location of locations) {
      await geofenceService.registerGeofence(location);
    }

    console.log('[App] Initialized successfully');
  };

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Setup">
        <Stack.Screen name="Setup" component={SetupScreen} />
        <Stack.Screen name="Tracking" component={TrackingScreen} />
        <Stack.Screen name="Log" component={LogScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

#### Step 2: Device Testing Protocol

**Create testing script:**

```bash
#!/bin/bash
# scripts/test-on-device.sh

echo "Building development client..."
npx expo run:ios  # or expo run:android

echo ""
echo "Testing checklist:"
echo "1. Grant location permissions (When In Use)"
echo "2. Set up a geofence near your current location"
echo "3. Walk outside the radius (trigger exit)"
echo "4. Walk back inside (trigger enter)"
echo "5. Check notifications"
echo "6. View tracking log"
echo "7. Kill app and repeat steps 3-4 (test background)"
echo "8. Check battery usage after 1 hour"
```

**Device Testing Checklist:**

```markdown
## iOS Device Testing

### Permissions
- [ ] Foreground permission requested correctly
- [ ] Background permission requested correctly
- [ ] Can revoke and re-grant permissions

### Geofencing
- [ ] Can set up geofence on map
- [ ] Geofence circle displays correct radius
- [ ] Enter event triggers clock-in (app in foreground)
- [ ] Exit event triggers clock-out (app in foreground)
- [ ] Enter event triggers clock-in (app in background)
- [ ] Exit event triggers clock-out (app in background)
- [ ] Enter event triggers clock-in (app killed)
- [ ] Notifications appear for clock-in/out

### Data Persistence
- [ ] Sessions saved to database
- [ ] History screen shows past sessions
- [ ] Duration calculated correctly
- [ ] Data survives app restart

### Edge Cases
- [ ] Multiple enter events (should not duplicate)
- [ ] Multiple exit events (should not crash)
- [ ] Rapid enter/exit (< 1 min apart)
- [ ] Phone restart (geofences re-registered?)

### Battery
- [ ] < 5% drain over 8 hours (background)
- [ ] No significant drain when in foreground

## Android Device Testing

### Permissions
- [ ] Location permission requested correctly
- [ ] Background location permission requested correctly
- [ ] Works with battery optimization enabled
- [ ] Works with battery optimization disabled

### Geofencing
- [ ] Same as iOS checklist

### Battery Optimization
- [ ] Test on Samsung (One UI)
- [ ] Test on Pixel (stock Android)
- [ ] Test on OnePlus (OxygenOS)

### Edge Cases
- [ ] Doze mode doesn't kill geofencing
- [ ] App works after device restart
```

#### Step 3: Automated E2E Tests (Detox)

```typescript
// e2e/geofencing.e2e.ts

import { device, expect, element, by } from 'detox';

describe('Geofencing Flow', () => {
  beforeAll(async () => {
    await device.launchApp({
      permissions: { location: 'always', notifications: 'YES' },
    });
  });

  it('should set up a geofence', async () => {
    // Enter location name
    await element(by.id('location-name-input')).typeText('Test Hospital');

    // Adjust radius (if testable)
    // await element(by.id('radius-slider')).swipe('right');

    // Save
    await element(by.text('Save Location')).tap();

    // Should navigate to tracking screen
    await expect(element(by.text('Test Hospital'))).toBeVisible();
  });

  it('should show inactive status initially', async () => {
    await expect(element(by.text('⚫ Not Working'))).toBeVisible();
  });

  it('should allow manual clock-in', async () => {
    await element(by.text('Clock In')).tap();

    await waitFor(element(by.text('🟢 Currently Working')))
      .toBeVisible()
      .withTimeout(2000);
  });

  it('should allow manual clock-out', async () => {
    await element(by.text('Clock Out')).tap();

    await waitFor(element(by.text('⚫ Not Working')))
      .toBeVisible()
      .withTimeout(2000);
  });

  it('should display history', async () => {
    await element(by.text('Log')).tap();

    await expect(element(by.id('tracking-log'))).toBeVisible();
    // Should have at least one entry
  });
});
```

---

## 4. Testing Strategy Summary

### 4.1 Test Pyramid

```
        ┌─────────────────┐
        │   E2E Tests     │  ~10 tests
        │   (Detox)       │  (Happy paths, critical flows)
        └────────┬────────┘
                 │
        ┌────────▼─────────┐
        │ Integration Tests│  ~20 tests
        │ (Hooks + Services)
        └────────┬─────────┘
                 │
        ┌────────▼────────────┐
        │    Unit Tests       │  ~60 tests
        │ (Services, Utils)   │  (All business logic)
        └─────────────────────┘
```

### 4.2 Coverage Goals

- **Unit tests**: 90% coverage (services, utilities)
- **Integration tests**: 75% coverage (hooks, components)
- **E2E tests**: Cover 5 critical user journeys

### 4.3 Test Commands

```json
// package.json scripts
{
  "test": "jest",
  "test:watch": "jest --watch",
  "test:coverage": "jest --coverage",
  "test:unit": "jest --testPathPattern=__tests__",
  "test:e2e:ios": "detox test --configuration ios.sim.debug",
  "test:e2e:android": "detox test --configuration android.emu.debug"
}
```

---

## 5. Success Criteria & Deliverables

### 5.1 Module Complete When:

- [ ] **All unit tests pass** (90%+ coverage on services)
- [ ] **Integration tests pass** (hooks work with services)
- [ ] **E2E tests pass** (happy path flows work)
- [ ] **Tested on 2+ iOS devices** (different iOS versions)
- [ ] **Tested on 2+ Android devices** (different manufacturers)
- [ ] **Background geofencing works** (app killed, still tracks)
- [ ] **Battery usage acceptable** (<5% drain over 8 hours)
- [ ] **Documentation complete** (README with setup instructions)

### 5.2 Deliverables

1. **Working mobile app** that:
   - Sets up geofences via map interface
   - Auto-tracks clock-in/out via geofencing
   - Allows manual clock-in/out as fallback
   - Stores data locally in SQLite
   - Shows tracking history

2. **Test suite** with:
   - 60+ unit tests
   - 20+ integration tests
   - 10+ E2E tests
   - 85%+ overall coverage

3. **Documentation**:
   - README.md with setup instructions
   - Testing guide
   - Known limitations

4. **Decision point**: Is geofencing reliable enough for production?
   - If YES: Proceed to next module (Calendar + Privacy)
   - If NO: Pivot to manual-entry-first approach

---

## 6. Next Modules (After This One)

### Module 2: Privacy Pipeline
- Differential privacy implementation
- Laplace noise generator
- Unit tests for noise distribution
- Integration with submission flow

### Module 3: Calendar & Planning
- Port calendar from web app
- Shift templates
- Shift instances
- Review mode

### Module 4: Submission & Backend Integration
- Submission queue
- Retry logic
- Backend API integration
- Analytics dashboard

### Module 5: Onboarding & Polish
- Email verification
- User onboarding flow
- Settings screens
- UI polish

---

## 7. Timeline

**Total: 2-3 weeks (full-time) or 4-6 weeks (part-time)**

| Phase | Days | Milestone |
|-------|------|-----------|
| 1.1 Setup | 1 | Expo app running on device |
| 1.2 Database | 2 | SQLite tests passing |
| 1.3 Geofence Service | 2 | Service tests passing |
| 1.4 Tracking Manager | 1 | Manager tests passing |
| 1.5 UI | 3 | All screens implemented |
| 1.6 Integration | 4 | Device testing complete |

---

## 8. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Geofencing unreliable on iOS | Implement manual-first UI, geofencing as enhancement |
| Background tracking killed by OS | Add persistent notification (Android), test with battery optimization |
| Battery drain too high | Reduce geofence accuracy, increase radius, add user controls |
| SQLite performance issues | Add indexes, use transactions, profile with large datasets |
| Permission denied by user | Graceful degradation to manual mode |

---

## 9. Questions to Answer

By the end of this module, you'll know:

1. **Does background geofencing work reliably?**
2. **What's the battery impact?**
3. **Do users need manual mode, or is auto enough?**
4. **Is SQLite fast enough for local storage?**
5. **Can we achieve 5-minute exit hysteresis?**

These answers inform the rest of the development plan.

---

**Start here. Build this module first. Test thoroughly. Then decide on the rest.**
