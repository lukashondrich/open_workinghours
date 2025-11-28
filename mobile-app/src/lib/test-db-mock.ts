// Simple in-memory database mock for testing
class MockDatabase {
  private tables: Map<string, any[]> = new Map();

  async execAsync(sql: string): Promise<void> {
    // Parse CREATE TABLE statements
    if (sql.includes('CREATE TABLE')) {
      const tableMatches = sql.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/g);
      if (tableMatches) {
        tableMatches.forEach(match => {
          const tableName = match.replace(/CREATE TABLE (?:IF NOT EXISTS )?/, '');
          if (!this.tables.has(tableName)) {
            this.tables.set(tableName, []);
          }
        });
      }
    }

    // Handle INSERT OR IGNORE for schema_version
    if (sql.includes('INSERT OR IGNORE INTO schema_version')) {
      const schemaTable = this.tables.get('schema_version') || [];
      if (schemaTable.length === 0) {
        schemaTable.push({ version: 1, applied_at: new Date().toISOString() });
        this.tables.set('schema_version', schemaTable);
      }
    }
  }

  async runAsync(sql: string, ...params: any[]): Promise<void> {
    if (sql.includes('INSERT INTO')) {
      const tableName = sql.match(/INSERT INTO (\w+)/)?.[1];
      if (tableName) {
        const table = this.tables.get(tableName) || [];

        // Check for duplicate primary key
        const columns = sql.match(/\(([^)]+)\)/)?.[1].split(',').map(c => c.trim());
        if (columns && columns[0] === 'id') {
          const existingRow = table.find((r: any) => r.id === params[0]);
          if (existingRow) {
            throw new Error('UNIQUE constraint failed');
          }
        }

        // Check foreign key constraint for tracking_sessions
        if (tableName === 'tracking_sessions' && columns) {
          const locationIdIndex = columns.indexOf('location_id');
          if (locationIdIndex >= 0) {
            const locationId = params[locationIdIndex];
            const locations = this.tables.get('user_locations') || [];
            const locationExists = locations.some((l: any) => l.id === locationId);
            if (!locationExists) {
              throw new Error('FOREIGN KEY constraint failed');
            }
          }
        }

        // Create a simple object from params based on table structure
        const row: any = {};

        if (columns) {
          columns.forEach((col, idx) => {
            row[col] = params[idx];
          });
        }

        if (tableName === 'tracking_sessions') {
          if (row.clock_out === undefined) {
            row.clock_out = null;
          }
          if (row.duration_minutes === undefined) {
            row.duration_minutes = null;
          }
        }

        table.push(row);
        this.tables.set(tableName, table);
      }
    } else if (sql.includes('UPDATE')) {
      const tableName = sql.match(/UPDATE (\w+)/)?.[1];
      if (tableName) {
        const table = this.tables.get(tableName) || [];
        const whereClause = sql.match(/WHERE (.+)/)?.[1];

        // Simple WHERE id = ? handling
        if (whereClause?.includes('id = ?')) {
          const id = params[params.length - 1];
          const row = table.find((r: any) => r.id === id);

          if (row) {
            // Update fields - map each param to the SET clause field
            const setClauseMatch = sql.match(/SET([\s\S]+?)WHERE/);
            const setClause = setClauseMatch?.[1]?.trim();
            if (setClause) {
              const fields = setClause.split(',').map(s => s.trim());
              fields.forEach((field, idx) => {
                const fieldName = field.split('=')[0].trim();
                row[fieldName] = params[idx];
              });
            }
          }
        }
      }
    } else if (sql.includes('DELETE FROM')) {
      const tableName = sql.match(/DELETE FROM (\w+)/)?.[1];
      if (tableName) {
        const table = this.tables.get(tableName) || [];
        const id = params[0];
        const filtered = table.filter((r: any) => r.id !== id);
        this.tables.set(tableName, filtered);
      }
    }
  }

  async getFirstAsync<T>(sql: string, ...params: any[]): Promise<T | null> {
    const tableName = sql.match(/FROM (\w+)/)?.[1];
    if (!tableName) return null;

    let table = [...(this.tables.get(tableName) || [])];

    if (sql.includes('WHERE')) {
      if (/\bid\s*=\s*\?/.test(sql) && params.length > 0) {
        const id = params[0];
        const found = table.find((r: any) => r.id === id);
        return found || null;
      }

      if (sql.includes('location_id = ?') && params.length > 0) {
        const locationId = params[0];
        table = table.filter((r: any) => r.location_id === locationId);
      }

      if (sql.includes('clock_out IS NULL')) {
        table = table.filter((r: any) => r.clock_out === null || r.clock_out === undefined);
      }

      // Handle ORDER BY DESC and LIMIT for getActiveSession
      if (sql.includes('ORDER BY') && sql.includes('DESC')) {
        table = [...table].reverse();
      }

      return table[0] || null;
    }

    return table[0] || null;
  }

  async getAllAsync<T>(sql: string, ...params: any[]): Promise<T[]> {
    if (sql.includes("sqlite_master")) {
      return Array.from(this.tables.keys()).map(name => ({ name })) as T[];
    }

    const tableName = sql.match(/FROM (\w+)/)?.[1];
    if (!tableName) return [];

    let table = [...(this.tables.get(tableName) || [])];

    // Simple WHERE filtering
    if (sql.includes('WHERE')) {
      if (sql.includes('location_id = ?') && params.length > 0) {
        const locationId = params[0];
        table = table.filter((r: any) => r.location_id === locationId);
      }

      if (sql.includes('is_active = 1')) {
        table = table.filter((r: any) => r.is_active === 1);
      }

      if (sql.includes('clock_out IS NULL')) {
        table = table.filter((r: any) => r.clock_out === null || r.clock_out === undefined);
      }
    }

    // Simple ORDER BY DESC
    if (sql.includes('ORDER BY') && sql.includes('DESC')) {
      table = [...table].reverse();
    }

    // Simple LIMIT
    if (sql.includes('LIMIT')) {
      const limit = params[params.length - 1];
      table = table.slice(0, limit);
    }

    return table as T[];
  }

  async closeAsync(): Promise<void> {
    this.tables.clear();
  }
}

export function createMockDatabase() {
  return new MockDatabase();
}
