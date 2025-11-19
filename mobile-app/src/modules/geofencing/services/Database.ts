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

    return results.map(r => this.mapSession(r));
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
