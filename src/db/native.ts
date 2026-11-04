import { File, Paths } from 'expo-file-system';
import { openDatabaseAsync } from 'expo-sqlite';
import { uuid } from 'expo-modules-core';
import { AppError, databaseError } from '../domain/errors';
import { DatabaseCoordinator } from './coordinator';
import { initializeDatabase } from './startup';
import type { PreferencesPortable } from '../domain/portable';
import { seedFirstLedger } from '../repositories/seed';

export const RESTORE_JOURNAL_NAME = 'kwartracker-restore-journal.json';
export type OpenDatabase = { coordinator: DatabaseCoordinator; uiMode: PreferencesPortable['uiMode'] };
let opening: Promise<OpenDatabase> | undefined;
let failed = false;

async function checkRecovery() {
  if (new File(Paths.document, RESTORE_JOURNAL_NAME).exists) throw new AppError('RECOVERY_REQUIRED');
}

async function open(): Promise<OpenDatabase> {
  // Recovery admission happens before opening/creating the live database file.
  await checkRecovery();
  const database = await openDatabaseAsync('kwartracker.db', { useNewConnection: true });
  try {
    await initializeDatabase(database, checkRecovery);
    const preference = await database.getFirstAsync<{ uiMode: unknown }>('SELECT uiMode FROM PreferencesPortable WHERE singleton=1');
    const mode = preference?.uiMode;
    const coordinator = new DatabaseCoordinator(database);
    await seedFirstLedger(coordinator, () => uuid.v4());
    return { coordinator, uiMode: mode === 'dark' || mode === 'light' ? mode : 'system' };
  } catch (error) {
    try { await database.closeAsync(); } catch { /* Preserve the startup cause; never recreate or delete the file. */ }
    throw databaseError(error);
  }
}

/** Share one attempt across mounts. A rejected attempt remains rejected until explicit Retry. */
export function openAppDatabase(explicitRetry = false): Promise<OpenDatabase> {
  if (explicitRetry && failed) { opening = undefined; failed = false; }
  opening ??= open().catch((error: unknown) => { failed = true; throw databaseError(error); });
  return opening;
}
