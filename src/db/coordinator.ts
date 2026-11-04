import { AppError, databaseError } from '../domain/errors.ts';
import type { DatabaseConnection, SqlConnection } from './connection.ts';

/** Admission lock plus serialized transactions. Never confuse EXCLUSIVE with a WAL reader lock. */
export class DatabaseCoordinator {
  private tail: Promise<void> = Promise.resolve();
  private restoring = false;
  private readers = 0;
  private readersDrained: (() => void) | undefined;
  private readonly database: DatabaseConnection;
  constructor(database: DatabaseConnection) { this.database = database; }

  async read<T>(work: (database: SqlConnection) => Promise<T>): Promise<T> {
    if (this.restoring) throw new AppError('RESTORE_IN_PROGRESS');
    this.readers++;
    try { return await work(this.database); }
    catch (error) { throw databaseError(error); }
    finally { if (--this.readers === 0) this.readersDrained?.(); }
  }

  write<T>(work: (transaction: SqlConnection) => Promise<T>): Promise<T> {
    if (this.restoring) return Promise.reject(new AppError('RESTORE_IN_PROGRESS'));
    const operation = this.tail.then(async () => {
      const result: { current?: { value: T } } = {};
      let primaryError: unknown;
      try {
        await this.database.withExclusiveTransactionAsync(async transaction => {
          try { result.current = { value: await work(transaction) }; }
          catch (error) { primaryError = error; throw error; }
        });
      } catch (error) {
        // SQLite FULL can roll back automatically. SDK57 then issues ROLLBACK again,
        // which masks the cause with "no transaction is active". Retain the real failure.
        if (primaryError !== undefined && error instanceof Error && /cannot rollback.*no transaction is active/i.test(error.message)) throw databaseError(primaryError);
        throw error;
      }
      if (!result.current) throw new AppError('DATABASE_FAILURE');
      return result.current.value;
    }).catch((error: unknown) => { throw databaseError(error); });
    this.tail = operation.then(() => undefined, () => undefined);
    return operation;
  }

  /** Reject new work immediately, then drain admitted readers/writers before replacement. */
  async withRestoreLock<T>(work: () => Promise<T>): Promise<T> {
    if (this.restoring) throw new AppError('RESTORE_IN_PROGRESS');
    this.restoring = true;
    try {
      const drain = this.readers === 0 ? Promise.resolve() : new Promise<void>(resolve => { this.readersDrained = resolve; });
      await Promise.all([this.tail, drain]);
      const result = await work();
      this.restoring = false;
      return result;
    } finally {
      this.readersDrained = undefined;
      // A failed replacement retains maintenance admission. Recovery/reopen must prove safety.
    }
  }
}
