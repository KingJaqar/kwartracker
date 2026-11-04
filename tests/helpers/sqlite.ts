import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { DatabaseConnection, SqlConnection, SqlValue } from '../../src/db/connection.ts';

/** Host SQLite exercises real commit/rollback, FKs, file restarts and process termination. */
export class TestDatabase implements DatabaseConnection {
  readonly raw: DatabaseSync;
  constructor(path = ':memory:') { this.raw = new DatabaseSync(path); this.raw.exec('PRAGMA foreign_keys=ON'); }
  async execAsync(sql: string) { this.raw.exec(sql); }
  async runAsync(sql: string, ...params: SqlValue[]) {
    const result = this.raw.prepare(sql).run(...params as SQLInputValue[]);
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }
  async getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null> { return (this.raw.prepare(sql).get(...params as SQLInputValue[]) as T | undefined) ?? null; }
  async getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]> { return this.raw.prepare(sql).all(...params as SQLInputValue[]) as T[]; }
  async withExclusiveTransactionAsync(work: (transaction: SqlConnection) => Promise<void>) {
    this.raw.exec('BEGIN EXCLUSIVE');
    try { await work(this); this.raw.exec('COMMIT'); }
    catch (error) { this.raw.exec('ROLLBACK'); throw error; }
  }
  async closeAsync() { this.raw.close(); }
}
