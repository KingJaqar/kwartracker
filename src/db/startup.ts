import { AppError, databaseError } from '../domain/errors.ts';
import type { DatabaseConnection } from './connection.ts';
import { migrate, type FaultPoint } from './migrations/index.ts';
import { APP_SCHEMA_VERSION } from './schema.ts';

export type StartupStage = 'recovery' | 'migration' | 'integrity' | 'ready';
export type StartupTiming = { stage: StartupStage; milliseconds: number };

export async function initializeDatabase(
  database: DatabaseConnection,
  recover: () => Promise<void>,
  options: { fault?: FaultPoint; onStage?: (stage: StartupStage) => void; now?: () => number } = {},
): Promise<StartupTiming[]> {
  const timings: StartupTiming[] = [];
  const now = options.now ?? (() => performance.now());
  const stage = async (name: StartupStage, work: () => Promise<unknown>) => {
    options.onStage?.(name);
    const start = now();
    await work();
    timings.push({ stage: name, milliseconds: now() - start });
  };
  try {
    await stage('recovery', recover);
    // Unsupported files are inspected before WAL or any other persistent setting is changed.
    await stage('migration', () => migrate(database, options.fault));
    await database.execAsync('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
    await stage('integrity', async () => {
      const checks = await database.getAllAsync<{ integrity_check: string }>('PRAGMA integrity_check');
      const foreignKeys = await database.getAllAsync('PRAGMA foreign_key_check');
      if (checks.length !== 1 || checks[0]?.integrity_check !== 'ok' || foreignKeys.length !== 0) throw new AppError('DATABASE_CORRUPT');
      const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
      if (version?.user_version !== APP_SCHEMA_VERSION) throw new AppError('DATABASE_UNSUPPORTED');
      // Check all required tables/columns, including already-current files. Never silently repair.
      const preferences = await database.getFirstAsync('SELECT currencySign,currencyPosition,displayDecimalPlaces,notesVisibleInList,uiMode,theme,dailyReminderTime FROM PreferencesPortable WHERE singleton=1');
      if (!preferences) throw new AppError('DATABASE_CORRUPT');
    });
    options.onStage?.('ready');
    return timings;
  } catch (error) { throw databaseError(error); }
}
