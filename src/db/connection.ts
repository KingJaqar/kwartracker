export type SqlValue = string | number | null | Uint8Array;
export interface SqlConnection {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SqlValue[]): Promise<{ changes: number; lastInsertRowId: number }>;
  getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
}
export interface DatabaseConnection extends SqlConnection {
  withExclusiveTransactionAsync(task: (transaction: SqlConnection) => Promise<void>): Promise<void>;
  closeAsync(): Promise<void>;
}
