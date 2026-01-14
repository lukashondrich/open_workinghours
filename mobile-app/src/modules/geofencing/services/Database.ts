import * as SQLite from 'expo-sqlite';
import {
  UserLocation,
  TrackingSession,
  GeofenceEvent,
  DailyActual,
  WeeklySubmissionRecord,
  DailySubmissionRecord,
  SubmissionStatus,
} from '../types';
import * as Crypto from 'expo-crypto';

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

      CREATE TABLE IF NOT EXISTS daily_actuals (
        id TEXT PRIMARY KEY,
        date TEXT UNIQUE NOT NULL,
        planned_minutes INTEGER NOT NULL,
        actual_minutes INTEGER NOT NULL,
        source TEXT NOT NULL,
        confirmed_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS weekly_submission_queue (
        id TEXT PRIMARY KEY,
        week_start TEXT NOT NULL,
        week_end TEXT NOT NULL,
        planned_minutes_true INTEGER NOT NULL,
        actual_minutes_true INTEGER NOT NULL,
        planned_minutes_noisy INTEGER NOT NULL,
        actual_minutes_noisy INTEGER NOT NULL,
        epsilon REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS weekly_submission_items (
        submission_id TEXT NOT NULL,
        day_id TEXT NOT NULL,
        PRIMARY KEY (submission_id, day_id),
        FOREIGN KEY (submission_id) REFERENCES weekly_submission_queue(id) ON DELETE CASCADE,
        FOREIGN KEY (day_id) REFERENCES daily_actuals(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS daily_submission_queue (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        planned_hours REAL NOT NULL,
        actual_hours REAL NOT NULL,
        source TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        submitted_at TEXT,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_daily_submission_status
        ON daily_submission_queue(status);

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

  async getSessionsBetween(startIso: string, endIso: string): Promise<TrackingSession[]> {
    if (!this.db) throw new Error('Database not initialized');

    const results = await this.db.getAllAsync<any>(
      `SELECT * FROM tracking_sessions
       WHERE clock_in < ? AND (clock_out IS NULL OR clock_out > ?)
       ORDER BY clock_in ASC`,
      endIso,
      startIso
    );

    return results.map((row) => this.mapSession(row));
  }

  async getDailyActualsByDates(dates: string[]): Promise<DailyActual[]> {
    if (!this.db) throw new Error('Database not initialized');
    if (dates.length === 0) return [];

    const placeholders = dates.map(() => '?').join(', ');
    const rows = await this.db.getAllAsync<any>(
      `SELECT * FROM daily_actuals WHERE date IN (${placeholders}) ORDER BY date ASC`,
      ...dates,
    );
    return rows.map((row) => this.mapDailyActual(row));
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

    return results.map(r => this.mapLocation(r));
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

    const id = Crypto.randomUUID();
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

  async updateSession(
    sessionId: string,
    updates: { clockIn?: string; clockOut?: string }
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const session = await this.getSession(sessionId);
    if (!session) throw new Error('Session not found');

    const newClockIn = updates.clockIn ?? session.clockIn;
    const newClockOut = updates.clockOut ?? session.clockOut;

    let durationMinutes = session.durationMinutes;
    if (newClockOut) {
      const clockInTime = new Date(newClockIn).getTime();
      const clockOutTime = new Date(newClockOut).getTime();
      durationMinutes = Math.round((clockOutTime - clockInTime) / 1000 / 60);
    }

    await this.db.runAsync(
      `UPDATE tracking_sessions
       SET clock_in = ?, clock_out = ?, duration_minutes = ?, updated_at = ?
       WHERE id = ?`,
      newClockIn,
      newClockOut,
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

    return results.map(r => this.mapSession(r));
  }

  async getAllSessions(): Promise<TrackingSession[]> {
    if (!this.db) throw new Error('Database not initialized');
    const results = await this.db.getAllAsync<any>('SELECT * FROM tracking_sessions ORDER BY clock_in DESC');
    return results.map((row) => this.mapSession(row));
  }

  async deleteSession(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync('DELETE FROM tracking_sessions WHERE id = ?', id);
  }

  // Geofence Events
  async logGeofenceEvent(event: Omit<GeofenceEvent, 'id'>): Promise<GeofenceEvent> {
    if (!this.db) throw new Error('Database not initialized');

    const id = Crypto.randomUUID();

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

    return results.map(r => this.mapEvent(r));
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

  private mapWeeklySubmission(row: any): WeeklySubmissionRecord {
    return {
      id: row.id,
      weekStart: row.week_start,
      weekEnd: row.week_end,
      plannedMinutesTrue: row.planned_minutes_true,
      actualMinutesTrue: row.actual_minutes_true,
      plannedMinutesNoisy: row.planned_minutes_noisy,
      actualMinutesNoisy: row.actual_minutes_noisy,
      epsilon: row.epsilon,
      status: row.status as SubmissionStatus,
      lastError: row.last_error,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapDailyActual(row: any): DailyActual {
    return {
      id: row.id,
      date: row.date,
      plannedMinutes: row.planned_minutes,
      actualMinutes: row.actual_minutes,
      source: row.source as DailyActual['source'],
      confirmedAt: row.confirmed_at,
      updatedAt: row.updated_at,
    };
  }

  async upsertDailyActual(record: DailyActual): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `INSERT INTO daily_actuals (id, date, planned_minutes, actual_minutes, source, confirmed_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         planned_minutes = excluded.planned_minutes,
         actual_minutes = excluded.actual_minutes,
         source = excluded.source,
         confirmed_at = excluded.confirmed_at,
         updated_at = excluded.updated_at,
         id = excluded.id`,
      record.id,
      record.date,
      record.plannedMinutes,
      record.actualMinutes,
      record.source,
      record.confirmedAt,
      record.updatedAt
    );
  }

  async getDailyActual(date: string): Promise<DailyActual | null> {
    if (!this.db) throw new Error('Database not initialized');
    const row = await this.db.getFirstAsync<any>('SELECT * FROM daily_actuals WHERE date = ?', date);
    return row ? this.mapDailyActual(row) : null;
  }

  async insertWeeklySubmission(record: WeeklySubmissionRecord, dayIds: string[]): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.execAsync('BEGIN TRANSACTION');
    try {
      await this.db.runAsync(
        `INSERT INTO weekly_submission_queue
         (id, week_start, week_end, planned_minutes_true, actual_minutes_true,
          planned_minutes_noisy, actual_minutes_noisy, epsilon, status, last_error, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        record.id,
        record.weekStart,
        record.weekEnd,
        record.plannedMinutesTrue,
        record.actualMinutesTrue,
        record.plannedMinutesNoisy,
        record.actualMinutesNoisy,
        record.epsilon,
        record.status,
        record.lastError,
        record.createdAt,
        record.updatedAt,
      );

      for (const dayId of dayIds) {
        await this.db.runAsync(
          `INSERT INTO weekly_submission_items (submission_id, day_id) VALUES (?, ?)`,
          record.id,
          dayId,
        );
      }

      await this.db.execAsync('COMMIT');
    } catch (error) {
      await this.db.execAsync('ROLLBACK');
      throw error;
    }
  }

  async getWeeklySubmissions(status?: SubmissionStatus): Promise<WeeklySubmissionRecord[]> {
    if (!this.db) throw new Error('Database not initialized');
    const query = status
      ? 'SELECT * FROM weekly_submission_queue WHERE status = ? ORDER BY created_at ASC'
      : 'SELECT * FROM weekly_submission_queue ORDER BY created_at ASC';
    const rows = status
      ? await this.db.getAllAsync<any>(query, status)
      : await this.db.getAllAsync<any>(query);
    return rows.map((row) => this.mapWeeklySubmission(row));
  }

  async getWeeklySubmissionByWeek(weekStart: string): Promise<WeeklySubmissionRecord | null> {
    if (!this.db) throw new Error('Database not initialized');
    const row = await this.db.getFirstAsync<any>(
      `SELECT * FROM weekly_submission_queue
       WHERE week_start = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      weekStart,
    );
    return row ? this.mapWeeklySubmission(row) : null;
  }

  async updateWeeklySubmissionStatus(id: string, status: SubmissionStatus, lastError: string | null = null) {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync(
      `UPDATE weekly_submission_queue
       SET status = ?, last_error = ?, updated_at = ?
       WHERE id = ?`,
      status,
      lastError,
      new Date().toISOString(),
      id,
    );
  }

  async deleteWeeklySubmission(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync('DELETE FROM weekly_submission_queue WHERE id = ?', id);
  }

  // ============================================================================
  // Daily Submission Queue (v2.0 - authenticated submissions)
  // ============================================================================

  private mapDailySubmission(row: any): DailySubmissionRecord {
    return {
      id: row.id,
      date: row.date,
      plannedHours: row.planned_hours,
      actualHours: row.actual_hours,
      source: row.source as 'geofence' | 'manual' | 'mixed',
      status: row.status as SubmissionStatus,
      createdAt: row.created_at,
      submittedAt: row.submitted_at,
      errorMessage: row.error_message,
    };
  }

  async enqueueDailySubmission(record: DailySubmissionRecord): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `INSERT INTO daily_submission_queue (
        id, date, planned_hours, actual_hours, source,
        status, created_at, submitted_at, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      record.id,
      record.date,
      record.plannedHours,
      record.actualHours,
      record.source,
      record.status,
      record.createdAt,
      record.submittedAt,
      record.errorMessage
    );
  }

  async getDailySubmissionQueue(status?: SubmissionStatus): Promise<DailySubmissionRecord[]> {
    if (!this.db) throw new Error('Database not initialized');

    const query = status
      ? 'SELECT * FROM daily_submission_queue WHERE status = ? ORDER BY date DESC'
      : 'SELECT * FROM daily_submission_queue ORDER BY date DESC';

    const rows = status
      ? await this.db.getAllAsync<any>(query, status)
      : await this.db.getAllAsync<any>(query);

    return rows.map((row) => this.mapDailySubmission(row));
  }

  async updateDailySubmissionStatus(
    id: string,
    status: SubmissionStatus,
    submittedAt?: string,
    errorMessage?: string
  ): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.runAsync(
      `UPDATE daily_submission_queue
       SET status = ?, submitted_at = ?, error_message = ?
       WHERE id = ?`,
      status,
      submittedAt || null,
      errorMessage || null,
      id
    );
  }

  async deleteDailySubmission(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.runAsync('DELETE FROM daily_submission_queue WHERE id = ?', id);
  }

  async deleteAllData(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    await this.db.execAsync('BEGIN TRANSACTION');
    try {
      await this.db.runAsync('DELETE FROM weekly_submission_items');
      await this.db.runAsync('DELETE FROM weekly_submission_queue');
      await this.db.runAsync('DELETE FROM daily_actuals');
      await this.db.runAsync('DELETE FROM geofence_events');
      await this.db.runAsync('DELETE FROM tracking_sessions');
      await this.db.runAsync('DELETE FROM user_locations');
      await this.db.execAsync('COMMIT');
    } catch (error) {
      await this.db.execAsync('ROLLBACK');
      throw error;
    }
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
