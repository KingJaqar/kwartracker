import type { DatabaseConnection } from '../../src/db/connection.ts';
import type { PortableData } from '../../src/domain/portable.ts';

/** Synthetic test/probe loader only. This is not a restore adapter or a product write path. */
export async function loadFixture(database: DatabaseConnection, data: PortableData, checkpoint?: (count: number) => void) {
  let count = 0;
  await database.withExclusiveTransactionAsync(async transaction => {
    await transaction.execAsync('PRAGMA defer_foreign_keys=ON; DELETE FROM PreferencesPortable;');
    for (const [table, rows] of Object.entries(data)) {
      let columns: string[] = [];
      let bindings: (string | number | null)[] = [];
      let batchRows = 0;
      const flush = async () => {
        if (batchRows === 0) return;
        const tuple = `(${columns.map(() => '?').join(',')})`;
        await transaction.runAsync(`INSERT INTO "${table}"(${columns.map(key => `"${key}"`).join(',')}) VALUES${Array.from({ length: batchRows }, () => tuple).join(',')}`, ...bindings);
        bindings = [];
        batchRows = 0;
      };
      for (const source of rows) {
        const row: Record<string, unknown> = { ...source };
        if ('payload' in row && typeof row.payload === 'object' && row.payload !== null) {
          const payload = row.payload as { accountId: string; categoryId: string };
          row.payloadAccountId = payload.accountId; row.payloadCategoryId = payload.categoryId;
        }
        if ('payloadSnapshot' in row && typeof row.payloadSnapshot === 'object' && row.payloadSnapshot !== null) {
          const payload = row.payloadSnapshot as { accountId: string; categoryId: string };
          row.snapshotAccountId = payload.accountId; row.snapshotCategoryId = payload.categoryId;
        }
        if (table === 'PreferencesPortable') row.singleton = 1;
        const keys = Object.keys(row);
        const values = Object.values(row).map(value => {
          const binding = typeof value === 'boolean' ? Number(value) : typeof value === 'object' && value !== null ? JSON.stringify(value) : value;
          if (!(binding === null || typeof binding === 'string' || typeof binding === 'number')) throw new Error('Invalid synthetic row');
          return binding;
        });
        // Bound native calls and memory; stay below even SQLite's older 999-variable default.
        if (batchRows > 0 && (JSON.stringify(columns) !== JSON.stringify(keys) || bindings.length + values.length > 900 || batchRows >= 100)) await flush();
        columns = keys;
        bindings.push(...values);
        batchRows++;
        // This is a processed-row cursor, not a claim of a committed partial write.
        checkpoint?.(++count);
      }
      await flush();
    }
  });
}
