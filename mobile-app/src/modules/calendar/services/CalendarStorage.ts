import * as SQLite from 'expo-sqlite';
import type { ShiftInstance, ShiftTemplate, TrackingRecord, ConfirmedDayStatus, AbsenceTemplate, AbsenceInstance, AbsenceType } from '@/lib/calendar/types';

class CalendarStorage {
  private db: SQLite.SQLiteDatabase | null = null;

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
  }

  private getDb() {
    if (!this.db) {
      throw new Error('CalendarStorage not initialized');
    }
    return this.db;
  }

  async loadTemplates(): Promise<Record<string, ShiftTemplate>> {
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
  }

  async loadInstances(): Promise<Record<string, ShiftInstance>> {
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
  }

  async loadTrackingRecords(): Promise<Record<string, TrackingRecord>> {
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
  }

  async loadConfirmedDays(): Promise<Record<string, ConfirmedDayStatus>> {
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
  }

  async replaceTemplates(templates: ShiftTemplate[]) {
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
  }

  async replaceInstances(instances: ShiftInstance[]) {
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
  }

  async replaceTrackingRecords(records: TrackingRecord[]) {
    const db = this.getDb();
    await db.runAsync('DELETE FROM tracking_records');
    for (const record of records) {
      await db.runAsync(
        `INSERT INTO tracking_records (id, date, start_time, duration, break_minutes) VALUES (?, ?, ?, ?, ?)`,
        record.id,
        record.date,
        record.startTime,
        record.duration,
        record.breakMinutes ?? 0,
      );
    }
  }

  async updateTrackingBreak(id: string, breakMinutes: number): Promise<void> {
    const db = this.getDb();
    await db.runAsync(
      'UPDATE tracking_records SET break_minutes = ? WHERE id = ?',
      breakMinutes,
      id
    );
  }

  async replaceConfirmedDays(days: Record<string, ConfirmedDayStatus>) {
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
  }

  async createAbsenceTemplate(
    template: Omit<AbsenceTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<AbsenceTemplate> {
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
  }

  async updateAbsenceTemplate(id: string, updates: Partial<AbsenceTemplate>): Promise<void> {
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
  }

  async deleteAbsenceTemplate(id: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync('DELETE FROM absence_templates WHERE id = ?', id);
  }

  // ========================================
  // Absence Instances CRUD
  // ========================================

  async loadAbsenceInstances(): Promise<Record<string, AbsenceInstance>> {
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
  }

  async getAbsenceInstancesForDate(date: string): Promise<AbsenceInstance[]> {
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
  }

  async getAbsenceInstancesForDateRange(startDate: string, endDate: string): Promise<AbsenceInstance[]> {
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
  }

  async createAbsenceInstance(
    instance: Omit<AbsenceInstance, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<AbsenceInstance> {
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

    return {
      id,
      ...instance,
      createdAt: now,
      updatedAt: now,
    };
  }

  async updateAbsenceInstance(id: string, updates: Partial<AbsenceInstance>): Promise<void> {
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
  }

  async deleteAbsenceInstance(id: string): Promise<void> {
    const db = this.getDb();
    await db.runAsync('DELETE FROM absence_instances WHERE id = ?', id);
  }

  async replaceAbsenceInstances(instances: AbsenceInstance[]) {
    const db = this.getDb();
    await db.runAsync('DELETE FROM absence_instances');
    for (const instance of instances) {
      await db.runAsync(
        `INSERT INTO absence_instances
         (id, template_id, type, date, start_time, end_time, is_full_day, name, color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        instance.id,
        instance.templateId,
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
  }
}

let calendarStorage: CalendarStorage | null = null;

export async function getCalendarStorage() {
  if (!calendarStorage) {
    calendarStorage = new CalendarStorage();
    await calendarStorage.initialize();
  }
  return calendarStorage;
}
