import { AppError } from '../../domain/errors.ts';
import type { DatabaseConnection, SqlConnection } from '../connection.ts';
import type { FaultPoint } from './index.ts';

export type Migration = {
  from: number; to: number;
  recognizes: (database: SqlConnection) => Promise<boolean>;
  apply: (transaction: SqlConnection, fault: FaultPoint) => Promise<void>;
};

/** All recognized forward steps and the final version stamp share one exclusive transaction. */
export async function runMigrationChain(database: DatabaseConnection, target: number, steps: readonly Migration[], fault: FaultPoint) {
  const source = (await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version;
  if (source === undefined || source < 0 || source >= target) throw new AppError('DATABASE_UNSUPPORTED');
  const chain: Migration[] = [];
  let cursor = source;
  while (cursor < target) {
    const matches = steps.filter(step => step.from === cursor);
    const step = matches[0];
    if (matches.length !== 1 || !step || step.to !== cursor + 1 || step.to > target) throw new AppError('DATABASE_UNSUPPORTED');
    chain.push(step);
    cursor = step.to;
  }
  const initial = chain[0];
  if (!initial || !await initial.recognizes(database)) throw new AppError('DATABASE_UNSUPPORTED');
  await database.withExclusiveTransactionAsync(async transaction => {
    const version = (await transaction.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version;
    if (version !== source) throw new AppError('DATABASE_UNSUPPORTED');
    for (const step of chain) {
      if (!await step.recognizes(transaction)) throw new AppError('DATABASE_UNSUPPORTED');
      await step.apply(transaction, fault);
      await fault(`migration:${step.from}:${step.to}:after-step`);
    }
    await transaction.execAsync(`PRAGMA user_version = ${target}`);
    await fault('migration:before-commit');
  });
}
