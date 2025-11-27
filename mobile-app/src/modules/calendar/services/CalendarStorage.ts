import * as SQLite from 'expo-sqlite';
import type { ShiftInstance, ShiftTemplate, TrackingRecord } from '@/lib/calendar/types';

class CalendarStorage {
  private db: SQLite.SQLiteDatabase | null = null;

  async initialize() {
    if (this.db) return;
    this.db = await SQLite.openDatabaseAsync('calendar.db');
    await this.db.execAsync('PRAGMA foreign_keys = ON;');
    await this.db.execAsync(
      `CREATE TABLE IF NOT EXISTS shift_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        start_time TEXT NOT NULL,
        duration INTEGER NOT NULL,
        color TEXT NOT NULL
      );`
    );
    await this.db.execAsync(
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
    await this.db.execAsync(
      `CREATE TABLE IF NOT EXISTS tracking_records (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        duration INTEGER NOT NULL
      );`
    );
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
      };
    });
    return records;
  }

  async replaceTemplates(templates: ShiftTemplate[]) {
    const db = this.getDb();
    await db.runAsync('DELETE FROM shift_templates');
    for (const template of templates) {
      await db.runAsync(
        `INSERT INTO shift_templates (id, name, start_time, duration, color) VALUES (?, ?, ?, ?, ?)`,
        template.id,
        template.name,
        template.startTime,
        template.duration,
        template.color,
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
        `INSERT INTO tracking_records (id, date, start_time, duration) VALUES (?, ?, ?, ?)`,
        record.id,
        record.date,
        record.startTime,
        record.duration,
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
