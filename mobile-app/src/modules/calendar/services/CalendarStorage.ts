import * as SQLite from 'expo-sqlite';
import type { ShiftInstance, ShiftTemplate, TrackingRecord, ConfirmedDayStatus, AbsenceTemplate, AbsenceInstance, AbsenceType, DayNote } from '@/lib/calendar/types';
import { scheduleEvents } from '@/lib/events/scheduleEvents';
import type {
  DeviceCalendarMappingRecord,
  DeviceCalendarStateRecord,
  DeviceCalendarTargetMode,
  ManagedCalendarEntityType,
} from './CalendarExportTypes';

export class CalendarStorage {
  private db: SQLite.SQLiteDatabase | null = null;
  // Android expo-sqlite can reject prepared statements when public calls overlap on one handle.
  private operationQueue: Promise<void> = Promise.resolve();

  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const nextOperation = this.operationQueue.then(operation);
    this.operationQueue = nextOperation.then(
      () => undefined,
      () => undefined
    );
    return nextOperation;
  }

  async initialize() {
    if (this.db) return;
    this.db = await SQLite.openDatabaseAsync('calendar.db');
    await this.db.execAsync('PRAGMA foreign_keys = ON;');
    await this.createTables();
    await this.runMigrations();
  }

  private async createTables() {
    const db = this.getDb();
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS shift_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        duration INTEGER NOT NULL,
        color TEXT NOT NULL,
        break_minutes INTEGER DEFAULT 0
      );`
    );
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS shift_instances (
        id TEXT PRIMARY KEY,
        template_id TEXT,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        duration INTEGER NOT NULL,
        end_time TEXT NOT NULL,
        color TEXT NOT NULL,
        name TEXT NOT NULL
      );`
    );
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS tracking_records (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        duration INTEGER NOT NULL,
        break_minutes INTEGER DEFAULT 0
      );`
    );
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS confirmed_days (
        date TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        confirmed_at TEXT,
        locked_submission_id TEXT,
        notes TEXT
      );`
    );
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );`
    );
  }

  private async getSchemaVersion(): Promise<number> {
    const db = this.getDb();
    const result = await db.getFirstAsync<{ version: number }>(
      'SELECT version FROM schema_version ORDER BY version DESC LIMIT 1'
    );
    return result?.version ?? 0;
  }

  private async setSchemaVersion(version: number) {
    const db = this.getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO schema_version (version, applied_at) VALUES (?, ?)',
      version,
      new Date().toISOString()
    );
  }

  private async runMigrations() {
    const db = this.getDb();
    const currentVersion = await this.getSchemaVersion();

    // Migration 1: Add break_minutes columns
    if (currentVersion < 1) {
      console.log('[CalendarStorage] Running migration 1: Adding break_minutes columns');
      try {
        // Check if column exists in shift_templates
        const templateCols = await db.getAllAsync<{ name: string }>(
          "PRAGMA table_info(shift_templates)"
        );
        if (!templateCols.some(col => col.name === 'break_minutes')) {
          await db.execAsync('ALTER TABLE shift_templates ADD COLUMN break_minutes INTEGER DEFAULT 0');
        }

        // Check if column exists in tracking_records
        const trackingCols = await db.getAllAsync<{ name: string }>(
          "PRAGMA table_info(tracking_records)"
        );
        if (!trackingCols.some(col => col.name === 'break_minutes')) {
          await db.execAsync('ALTER TABLE tracking_records ADD COLUMN break_minutes INTEGER DEFAULT 0');
        }

        await this.setSchemaVersion(1);
        console.log('[CalendarStorage] Migration 1 complete');
      } catch (error) {
        console.error('[CalendarStorage] Migration 1 failed:', error);
        throw error;
      }
    }

    // Migration 2: Add absence tables
    if (currentVersion < 2) {
      console.log('[CalendarStorage] Running migration 2: Adding absence tables');
      try {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS absence_templates (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL CHECK (type IN ('vacation', 'sick')),
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            start_time TEXT,
            end_time TEXT,
            is_full_day INTEGER DEFAULT 1,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
        `);

        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS absence_instances (
            id TEXT PRIMARY KEY,
            template_id TEXT,
            type TEXT NOT NULL CHECK (type IN ('vacation', 'sick')),
            date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            is_full_day INTEGER DEFAULT 1,
            name TEXT NOT NULL,
            color TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (template_id) REFERENCES absence_templates(id) ON DELETE SET NULL
          );
        `);

        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_absence_instances_date ON absence_instances(date);
        `);

        await this.setSchemaVersion(2);
        console.log('[CalendarStorage] Migration 2 complete');

        // Seed default absence templates
        await this.seedDefaultAbsenceTemplates();
      } catch (error) {
        console.error('[CalendarStorage] Migration 2 failed:', error);
        throw error;
      }
    }

    // Migration 3: Clean up half-day absence templates (legacy data)
    if (currentVersion < 3) {
      console.log('[CalendarStorage] Running migration 3: Cleaning up half-day absence templates');
      try {
        // Delete any absence templates with 'half' in ID (seeded defaults from older versions)
        await db.execAsync(`DELETE FROM absence_templates WHERE id LIKE '%half%'`);

        await this.setSchemaVersion(3);
        console.log('[CalendarStorage] Migration 3 complete');
      } catch (error) {
        console.error('[CalendarStorage] Migration 3 failed:', error);
        throw error;
      }
    }

    if (currentVersion < 4) {
      console.log('[CalendarStorage] Running migration 4: Adding device calendar export tables');
      try {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS device_calendar_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            enabled INTEGER NOT NULL DEFAULT 0,
            calendar_id TEXT,
            target_source_id TEXT,
            target_mode TEXT,
            last_full_sync_at TEXT,
            last_sync_error TEXT,
            updated_at TEXT NOT NULL
          );
        `);

        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS device_calendar_mappings (
            app_id TEXT PRIMARY KEY,
            native_event_id TEXT NOT NULL UNIQUE,
            entity_type TEXT NOT NULL CHECK (entity_type IN ('shift', 'absence')),
            fingerprint TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
        `);

        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_shift_instances_date ON shift_instances(date);
        `);

        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_device_calendar_mappings_entity_type
          ON device_calendar_mappings(entity_type);
        `);

        await this.setSchemaVersion(4);
        console.log('[CalendarStorage] Migration 4 complete');
      } catch (error) {
        console.error('[CalendarStorage] Migration 4 failed:', error);
        throw error;
      }
    }

    // Migration 5: Add day_notes table
    if (currentVersion < 5) {
      console.log('[CalendarStorage] Running migration 5: Adding day_notes table');
      try {
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS day_notes (
            id TEXT PRIMARY KEY,
            date TEXT UNIQUE NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
        `);

        await db.execAsync(`
          CREATE INDEX IF NOT EXISTS idx_day_notes_date ON day_notes(date);
        `);

        await this.setSchemaVersion(5);
        console.log('[CalendarStorage] Migration 5 complete');
      } catch (error) {
        console.error('[CalendarStorage] Migration 5 failed:', error);
        throw error;
      }
    }
  }

  private getDb() {
    if (!this.db) {
      throw new Error('CalendarStorage not initialized');
    }
    return this.db;
  }

  async loadTemplates(): Promise<Record<string, ShiftTemplate>> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const rows = await db.getAllAsync<any>('SELECT * FROM shift_templates');
      const templates: Record<string, ShiftTemplate> = {};
      rows.forEach((row) => {
        templates[row.id] = {
          id: row.id,
          name: row.name,
          startTime: row.start_time,
          duration: row.duration,
          color: row.color,
          breakMinutes: row.break_minutes ?? 0,
        };
      });
      return templates;
    });
  }

  async loadInstances(): Promise<Record<string, ShiftInstance>> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const rows = await db.getAllAsync<any>('SELECT * FROM shift_instances');
      const instances: Record<string, ShiftInstance> = {};
      rows.forEach((row) => {
        instances[row.id] = {
          id: row.id,
          templateId: row.template_id,
          date: row.date,
          startTime: row.start_time,
          duration: row.duration,
          endTime: row.end_time,
          color: row.color,
          name: row.name,
        };
      });
      return instances;
    });
  }

  async loadTrackingRecords(): Promise<Record<string, TrackingRecord>> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const rows = await db.getAllAsync<any>('SELECT * FROM tracking_records');
      const records: Record<string, TrackingRecord> = {};
      rows.forEach((row) => {
        records[row.id] = {
          id: row.id,
          date: row.date,
          startTime: row.start_time,
          duration: row.duration,
          breakMinutes: row.break_minutes ?? 0,
        };
      });
      return records;
    });
  }

  async loadConfirmedDays(): Promise<Record<string, ConfirmedDayStatus>> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const rows = await db.getAllAsync<any>('SELECT * FROM confirmed_days');
      const confirmed: Record<string, ConfirmedDayStatus> = {};
      rows.forEach((row) => {
        confirmed[row.date] = {
          status: row.status ?? 'pending',
          confirmedAt: row.confirmed_at,
          lockedSubmissionId: row.locked_submission_id,
        };
      });
      return confirmed;
    });
  }

  async replaceTemplates(templates: ShiftTemplate[]) {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      await db.runAsync('DELETE FROM shift_templates');
      for (const template of templates) {
        await db.runAsync(
          `INSERT INTO shift_templates (id, name, start_time, duration, color, break_minutes) VALUES (?, ?, ?, ?, ?, ?)`,
          template.id,
          template.name,
          template.startTime,
          template.duration,
          template.color,
          template.breakMinutes ?? 0,
        );
      }
    });
  }

  async saveShiftTemplate(template: ShiftTemplate): Promise<void> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      await db.runAsync(
        `INSERT OR REPLACE INTO shift_templates (id, name, start_time, duration, color, break_minutes) VALUES (?, ?, ?, ?, ?, ?)`,
        template.id,
        template.name,
        template.startTime,
        template.duration,
        template.color,
        template.breakMinutes ?? 0,
      );
    });
  }

  async replaceInstances(instances: ShiftInstance[]) {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      await db.runAsync('DELETE FROM shift_instances');
      for (const instance of instances) {
        await db.runAsync(
          `INSERT INTO shift_instances (id, template_id, date, start_time, duration, end_time, color, name)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          instance.id,
          instance.templateId,
          instance.date,
          instance.startTime,
          instance.duration,
          instance.endTime,
          instance.color,
          instance.name,
        );
      }
      scheduleEvents.emit('schedule-changed', {
        source: 'shifts',
        occurredAt: new Date().toISOString(),
      });
    });
  }

  async getShiftInstancesForDateRange(startDate: string, endDate: string): Promise<ShiftInstance[]> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const rows = await db.getAllAsync<any>(
        'SELECT * FROM shift_instances WHERE date >= ? AND date <= ? ORDER BY date, start_time',
        startDate,
        endDate
      );
      return rows.map((row) => ({
        id: row.id,
        templateId: row.template_id,
        date: row.date,
        startTime: row.start_time,
        duration: row.duration,
        endTime: row.end_time,
        color: row.color,
        name: row.name,
      }));
    });
  }

  async replaceTrackingRecords(records: TrackingRecord[]) {
    // Use INSERT OR REPLACE (upsert) instead of DELETE + INSERT
    // This is safe for concurrent calls - no race conditions
    // Old records from other weeks stay in the table but get overwritten when loaded again
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      for (const record of records) {
        await db.runAsync(
          `INSERT OR REPLACE INTO tracking_records (id, date, start_time, duration, break_minutes) VALUES (?, ?, ?, ?, ?)`,
          record.id,
          record.date,
          record.startTime,
          record.duration,
          record.breakMinutes ?? 0,
        );
      }
    });
  }

  async updateTrackingBreak(id: string, breakMinutes: number): Promise<void> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      await db.runAsync(
        'UPDATE tracking_records SET break_minutes = ? WHERE id = ?',
        breakMinutes,
        id
      );
    });
  }

  /**
   * Revert a single day to 'pending' directly in storage. Used by the un-confirm
   * side-effect to make `confirmed_days` consistent BEFORE the
   * `confirmed-days-updated` event fires — otherwise the provider's own event
   * listener could reload stale 'confirmed' state before the async persist effect
   * has written 'pending'. UPDATE (not upsert) preserves the row's notes; if the
   * row is somehow absent it no-ops, which loadConfirmedDays already treats as
   * pending.
   */
  async markDayUnconfirmed(date: string) {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      await db.runAsync(
        `UPDATE confirmed_days SET status = 'pending', confirmed_at = NULL, locked_submission_id = NULL WHERE date = ?`,
        date,
      );
    });
  }

  async replaceConfirmedDays(days: Record<string, ConfirmedDayStatus>) {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      await db.runAsync('DELETE FROM confirmed_days');
      for (const [date, meta] of Object.entries(days)) {
        await db.runAsync(
          `INSERT INTO confirmed_days (date, status, confirmed_at, locked_submission_id, notes)
           VALUES (?, ?, ?, ?, NULL)`,
          date,
          meta.status,
          meta.confirmedAt ?? null,
          meta.lockedSubmissionId ?? null,
        );
      }
    });
  }

  // ========================================
  // Absence Templates CRUD
  // ========================================

  private async seedDefaultAbsenceTemplates() {
    const db = this.getDb();
    const now = new Date().toISOString();

    // Only full-day templates - users can adjust times via drag handles after placing
    const defaults: Array<{
      id: string;
      type: AbsenceType;
      name: string;
      color: string;
      startTime: string | null;
      endTime: string | null;
      isFullDay: boolean;
    }> = [
      {
        id: 'vacation-full-day',
        type: 'vacation',
        name: 'Vacation',
        color: '#D1D5DB', // muted gray
        startTime: null,
        endTime: null,
        isFullDay: true,
      },
      {
        id: 'sick-full-day',
        type: 'sick',
        name: 'Sick Day',
        color: '#FDE68A', // muted amber
        startTime: null,
        endTime: null,
        isFullDay: true,
      },
    ];

    for (const template of defaults) {
      await db.runAsync(
        `INSERT OR IGNORE INTO absence_templates
         (id, type, name, color, start_time, end_time, is_full_day, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        template.id,
        template.type,
        template.name,
        template.color,
        template.startTime,
        template.endTime,
        template.isFullDay ? 1 : 0,
        now,
        now
      );
    }
    console.log('[CalendarStorage] Seeded default absence templates');
  }

  async loadAbsenceTemplates(): Promise<Record<string, AbsenceTemplate>> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const rows = await db.getAllAsync<any>('SELECT * FROM absence_templates');
      const templates: Record<string, AbsenceTemplate> = {};
      rows.forEach((row) => {
        templates[row.id] = {
          id: row.id,
          type: row.type as AbsenceType,
          name: row.name,
          color: row.color,
          startTime: row.start_time,
          endTime: row.end_time,
          isFullDay: row.is_full_day === 1,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });
      return templates;
    });
  }

  async createAbsenceTemplate(
    template: Omit<AbsenceTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<AbsenceTemplate> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const id = `absence-template-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      await db.runAsync(
        `INSERT INTO absence_templates
         (id, type, name, color, start_time, end_time, is_full_day, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        template.type,
        template.name,
        template.color,
        template.startTime,
        template.endTime,
        template.isFullDay ? 1 : 0,
        now,
        now
      );

      return {
        id,
        ...template,
        createdAt: now,
        updatedAt: now,
      };
    });
  }

  async updateAbsenceTemplate(id: string, updates: Partial<AbsenceTemplate>): Promise<void> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const now = new Date().toISOString();

      const setClauses: string[] = ['updated_at = ?'];
      const values: any[] = [now];

      if (updates.type !== undefined) {
        setClauses.push('type = ?');
        values.push(updates.type);
      }
      if (updates.name !== undefined) {
        setClauses.push('name = ?');
        values.push(updates.name);
      }
      if (updates.color !== undefined) {
        setClauses.push('color = ?');
        values.push(updates.color);
      }
      if (updates.startTime !== undefined) {
        setClauses.push('start_time = ?');
        values.push(updates.startTime);
      }
      if (updates.endTime !== undefined) {
        setClauses.push('end_time = ?');
        values.push(updates.endTime);
      }
      if (updates.isFullDay !== undefined) {
        setClauses.push('is_full_day = ?');
        values.push(updates.isFullDay ? 1 : 0);
      }

      values.push(id);
      await db.runAsync(
        `UPDATE absence_templates SET ${setClauses.join(', ')} WHERE id = ?`,
        ...values
      );
    });
  }

  async deleteAbsenceTemplate(id: string): Promise<void> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      await db.runAsync('DELETE FROM absence_templates WHERE id = ?', id);
    });
  }

  async replaceAbsenceTemplates(templates: AbsenceTemplate[]): Promise<void> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      await db.runAsync('DELETE FROM absence_templates');
      const now = new Date().toISOString();
      for (const template of templates) {
        await db.runAsync(
          `INSERT INTO absence_templates
           (id, type, name, color, start_time, end_time, is_full_day, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          template.id,
          template.type,
          template.name,
          template.color,
          template.startTime,
          template.endTime,
          template.isFullDay ? 1 : 0,
          template.createdAt || now,
          template.updatedAt || now
        );
      }
    });
  }

  // ========================================
  // Absence Instances CRUD
  // ========================================

  async loadAbsenceInstances(): Promise<Record<string, AbsenceInstance>> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const rows = await db.getAllAsync<any>('SELECT * FROM absence_instances');
      const instances: Record<string, AbsenceInstance> = {};
      rows.forEach((row) => {
        instances[row.id] = {
          id: row.id,
          templateId: row.template_id,
          type: row.type as AbsenceType,
          date: row.date,
          startTime: row.start_time,
          endTime: row.end_time,
          isFullDay: row.is_full_day === 1,
          name: row.name,
          color: row.color,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });
      return instances;
    });
  }

  async getAbsenceInstancesForDate(date: string): Promise<AbsenceInstance[]> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const rows = await db.getAllAsync<any>(
        'SELECT * FROM absence_instances WHERE date = ?',
        date
      );
      return rows.map((row) => ({
        id: row.id,
        templateId: row.template_id,
        type: row.type as AbsenceType,
        date: row.date,
        startTime: row.start_time,
        endTime: row.end_time,
        isFullDay: row.is_full_day === 1,
        name: row.name,
        color: row.color,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    });
  }

  async getAbsenceInstancesForDateRange(startDate: string, endDate: string): Promise<AbsenceInstance[]> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const rows = await db.getAllAsync<any>(
        'SELECT * FROM absence_instances WHERE date >= ? AND date <= ? ORDER BY date, start_time',
        startDate,
        endDate
      );
      return rows.map((row) => ({
        id: row.id,
        templateId: row.template_id,
        type: row.type as AbsenceType,
        date: row.date,
        startTime: row.start_time,
        endTime: row.end_time,
        isFullDay: row.is_full_day === 1,
        name: row.name,
        color: row.color,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    });
  }

  async createAbsenceInstance(
    instance: Omit<AbsenceInstance, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<AbsenceInstance> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const id = `absence-instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date().toISOString();

      await db.runAsync(
        `INSERT INTO absence_instances
         (id, template_id, type, date, start_time, end_time, is_full_day, name, color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        instance.templateId,
        instance.type,
        instance.date,
        instance.startTime,
        instance.endTime,
        instance.isFullDay ? 1 : 0,
        instance.name,
        instance.color,
        now,
        now
      );

      const created = {
        id,
        ...instance,
        createdAt: now,
        updatedAt: now,
      };

      scheduleEvents.emit('schedule-changed', {
        source: 'absences',
        occurredAt: now,
      });

      return created;
    });
  }

  async updateAbsenceInstance(id: string, updates: Partial<AbsenceInstance>): Promise<void> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const now = new Date().toISOString();

      const setClauses: string[] = ['updated_at = ?'];
      const values: any[] = [now];

      if (updates.templateId !== undefined) {
        setClauses.push('template_id = ?');
        values.push(updates.templateId);
      }
      if (updates.type !== undefined) {
        setClauses.push('type = ?');
        values.push(updates.type);
      }
      if (updates.date !== undefined) {
        setClauses.push('date = ?');
        values.push(updates.date);
      }
      if (updates.startTime !== undefined) {
        setClauses.push('start_time = ?');
        values.push(updates.startTime);
      }
      if (updates.endTime !== undefined) {
        setClauses.push('end_time = ?');
        values.push(updates.endTime);
      }
      if (updates.isFullDay !== undefined) {
        setClauses.push('is_full_day = ?');
        values.push(updates.isFullDay ? 1 : 0);
      }
      if (updates.name !== undefined) {
        setClauses.push('name = ?');
        values.push(updates.name);
      }
      if (updates.color !== undefined) {
        setClauses.push('color = ?');
        values.push(updates.color);
      }

      values.push(id);
      await db.runAsync(
        `UPDATE absence_instances SET ${setClauses.join(', ')} WHERE id = ?`,
        ...values
      );
      scheduleEvents.emit('schedule-changed', {
        source: 'absences',
        occurredAt: now,
      });
    });
  }

  async deleteAbsenceInstance(id: string): Promise<void> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      await db.runAsync('DELETE FROM absence_instances WHERE id = ?', id);
      scheduleEvents.emit('schedule-changed', {
        source: 'absences',
        occurredAt: new Date().toISOString(),
      });
    });
  }

  async replaceAbsenceInstances(instances: AbsenceInstance[]) {
    return this.enqueueOperation(async () => {
      const db = this.getDb();

      // Get valid template IDs to check FK constraint
      const templateRows = await db.getAllAsync<{ id: string }>('SELECT id FROM absence_templates');
      const validTemplateIds = new Set(templateRows.map(r => r.id));

      await db.runAsync('DELETE FROM absence_instances');
      for (const instance of instances) {
        // Set templateId to null if template doesn't exist (FK constraint)
        const templateId = instance.templateId && validTemplateIds.has(instance.templateId)
          ? instance.templateId
          : null;

        await db.runAsync(
          `INSERT INTO absence_instances
           (id, template_id, type, date, start_time, end_time, is_full_day, name, color, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          instance.id,
          templateId,
          instance.type,
          instance.date,
          instance.startTime,
          instance.endTime,
          instance.isFullDay ? 1 : 0,
          instance.name,
          instance.color,
          instance.createdAt,
          instance.updatedAt
        );
      }
      scheduleEvents.emit('schedule-changed', {
        source: 'absences',
        occurredAt: new Date().toISOString(),
      });
    });
  }

  // ========================================
  // Day Notes CRUD
  // ========================================

  async loadDayNotes(): Promise<Record<string, DayNote>> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const rows = await db.getAllAsync<any>('SELECT * FROM day_notes');
      const notes: Record<string, DayNote> = {};
      rows.forEach((row) => {
        notes[row.date] = {
          id: row.id,
          date: row.date,
          content: row.content,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        };
      });
      return notes;
    });
  }

  async saveDayNote(note: DayNote): Promise<void> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      await db.runAsync(
        `INSERT OR REPLACE INTO day_notes (id, date, content, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        note.id,
        note.date,
        note.content,
        note.createdAt,
        note.updatedAt
      );
    });
  }

  async replaceDayNotes(notes: DayNote[]): Promise<void> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      await db.runAsync('DELETE FROM day_notes');
      for (const note of notes) {
        await db.runAsync(
          `INSERT OR REPLACE INTO day_notes (id, date, content, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          note.id,
          note.date,
          note.content,
          note.createdAt,
          note.updatedAt
        );
      }
    });
  }

  async deleteDayNote(date: string): Promise<void> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      await db.runAsync('DELETE FROM day_notes WHERE date = ?', date);
    });
  }

  async loadDeviceCalendarState(): Promise<DeviceCalendarStateRecord | null> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const row = await db.getFirstAsync<any>('SELECT * FROM device_calendar_state WHERE id = 1');

      if (!row) {
        return null;
      }

      return {
        enabled: row.enabled === 1,
        calendarId: row.calendar_id ?? null,
        targetSourceId: row.target_source_id ?? null,
        targetMode: (row.target_mode as DeviceCalendarTargetMode | null) ?? null,
        lastFullSyncAt: row.last_full_sync_at ?? null,
        lastSyncError: row.last_sync_error ?? null,
        updatedAt: row.updated_at,
      };
    });
  }

  async saveDeviceCalendarState(state: {
    enabled: boolean;
    calendarId?: string | null;
    targetSourceId?: string | null;
    targetMode?: DeviceCalendarTargetMode | null;
    lastFullSyncAt?: string | null;
    lastSyncError?: string | null;
  }): Promise<void> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const now = new Date().toISOString();

      await db.runAsync(
        `INSERT OR REPLACE INTO device_calendar_state
         (id, enabled, calendar_id, target_source_id, target_mode, last_full_sync_at, last_sync_error, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        1,
        state.enabled ? 1 : 0,
        state.calendarId ?? null,
        state.targetSourceId ?? null,
        state.targetMode ?? null,
        state.lastFullSyncAt ?? null,
        state.lastSyncError ?? null,
        now
      );
    });
  }

  async clearDeviceCalendarState(): Promise<void> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      await db.runAsync('DELETE FROM device_calendar_state WHERE id = ?', 1);
    });
  }

  async loadDeviceCalendarMapping(appId: string): Promise<DeviceCalendarMappingRecord | null> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const row = await db.getFirstAsync<any>(
        'SELECT * FROM device_calendar_mappings WHERE app_id = ?',
        appId
      );

      if (!row) {
        return null;
      }

      return {
        appId: row.app_id,
        nativeEventId: row.native_event_id,
        entityType: row.entity_type as ManagedCalendarEntityType,
        fingerprint: row.fingerprint,
        updatedAt: row.updated_at,
      };
    });
  }

  async loadDeviceCalendarMappings(): Promise<Record<string, DeviceCalendarMappingRecord>> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      const rows = await db.getAllAsync<any>('SELECT * FROM device_calendar_mappings');
      const mappings: Record<string, DeviceCalendarMappingRecord> = {};

      rows.forEach((row) => {
        mappings[row.app_id] = {
          appId: row.app_id,
          nativeEventId: row.native_event_id,
          entityType: row.entity_type as ManagedCalendarEntityType,
          fingerprint: row.fingerprint,
          updatedAt: row.updated_at,
        };
      });

      return mappings;
    });
  }

  async saveDeviceCalendarMapping(mapping: {
    appId: string;
    nativeEventId: string;
    entityType: ManagedCalendarEntityType;
    fingerprint: string;
  }): Promise<void> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      await db.runAsync(
        `INSERT OR REPLACE INTO device_calendar_mappings
         (app_id, native_event_id, entity_type, fingerprint, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        mapping.appId,
        mapping.nativeEventId,
        mapping.entityType,
        mapping.fingerprint,
        new Date().toISOString()
      );
    });
  }

  async deleteDeviceCalendarMapping(appId: string): Promise<void> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      await db.runAsync('DELETE FROM device_calendar_mappings WHERE app_id = ?', appId);
    });
  }

  async deleteAllDeviceCalendarMappings(): Promise<void> {
    return this.enqueueOperation(async () => {
      const db = this.getDb();
      await db.runAsync('DELETE FROM device_calendar_mappings');
    });
  }
}

let calendarStorage: CalendarStorage | null = null;
let calendarStoragePromise: Promise<CalendarStorage> | null = null;

export async function getCalendarStorage() {
  if (calendarStorage) {
    return calendarStorage;
  }

  if (!calendarStoragePromise) {
    calendarStoragePromise = (async () => {
      const instance = new CalendarStorage();
      await instance.initialize();
      calendarStorage = instance;
      return instance;
    })().catch((error) => {
      calendarStoragePromise = null;
      throw error;
    });
  }

  return calendarStoragePromise;
}
