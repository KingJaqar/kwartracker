import { openDatabaseAsync } from 'expo-sqlite';
import { AppError } from '../domain/errors';
import { migrate, schemaObjects } from '../db/migrations';
import { restoreProbeIo } from './platform';

const points = ['migration:before-schema', 'migration:after-schema', 'migration:0:1:after-step', 'migration:before-commit'];
function waitForTermination(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const stop = () => { clearTimeout(timer); signal.removeEventListener('abort', stop); reject(new AppError('DEADLINE_EXCEEDED')); };
    const timer = setTimeout(stop, 25000);
    if (signal.aborted) stop(); else signal.addEventListener('abort', stop, { once: true });
  });
}

/** Holds a real Expo SQLite migration transaction at one explicit barrier for a host process-stop. */
export async function pauseNativeMigration(point: string, signal: AbortSignal, progress: (value: string) => void) {
  if (!points.includes(point) || signal.aborted) throw new AppError('INVALID_COMMAND');
  const operation = await restoreProbeIo('', 'create');
  const directory = await restoreProbeIo(operation, 'directory');
  const database = await openDatabaseAsync('live.db', { useNewConnection: true }, directory);
  try {
    await database.execAsync('PRAGMA journal_mode=WAL;');
    await migrate(database, async current => {
      if (current === point) {
        progress(JSON.stringify({ status: 'migration-paused', operation, point, deadlineMs: 25000 }));
        await waitForTermination(signal);
      }
    });
    throw new AppError('PROBE_FAILED');
  } finally { await database.closeAsync(); }
}

export async function prepareMigrationFixture(kind: string) {
  if (!['empty', 'current', 'unknown', 'newer'].includes(kind)) throw new AppError('INVALID_COMMAND');
  const operation = await restoreProbeIo('', 'create');
  const directory = await restoreProbeIo(operation, 'directory');
  const database = await openDatabaseAsync('live.db', { useNewConnection: true }, directory);
  try {
    if (kind === 'unknown') await database.execAsync("CREATE TABLE UnknownMarker(value TEXT); INSERT INTO UnknownMarker VALUES('SYNTHETIC-PRESERVED');");
    else if (kind !== 'empty') { await migrate(database); if (kind === 'newer') await database.execAsync('PRAGMA user_version=2;'); }
  } finally { await database.closeAsync(); }
  await restoreProbeIo(operation, 'write', 'baseline.json', JSON.stringify({ kind }));
  return { status: 'prepared', operation, kind, sha256: await restoreProbeIo(operation, 'hash', 'live.db') };
}

export async function inspectMigrationFixture(operation: string) {
  const directory = await restoreProbeIo(operation, 'directory');
  if (await restoreProbeIo(operation, 'exists', 'live.db') !== 'true') throw new AppError('PROBE_FAILED');
  // WAL recovery occurs on open after termination; inspect before any migration retry.
  const database = await openDatabaseAsync('live.db', { useNewConnection: true }, directory);
  try {
    const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    const objects = await schemaObjects(database);
    const before = await restoreProbeIo(operation, 'hash', 'live.db');
    if (version?.user_version === 0 && objects.length === 0 || version?.user_version === 1) {
      const first = await migrate(database);
      const changes = await database.getFirstAsync<{ count: number }>('SELECT total_changes() AS count');
      const second = await migrate(database);
      const after = await database.getFirstAsync<{ count: number }>('SELECT total_changes() AS count');
      if (second !== 'current' || changes?.count !== after?.count) throw new AppError('PROBE_FAILED');
      return { status: 'passed', operation, recoveredSourceVersion: version?.user_version, recoveredSourceObjects: objects.length, first, second, noRepeatWrites: true };
    } else {
      try { await migrate(database); throw new AppError('PROBE_FAILED'); }
      catch (error) { if (!(error instanceof AppError && error.code === 'DATABASE_UNSUPPORTED')) throw error; }
      const preserved = await restoreProbeIo(operation, 'hash', 'live.db');
      if (before !== preserved) throw new AppError('PROBE_FAILED');
      return { status: 'passed', operation, sourceVersion: version?.user_version, sourceObjects: objects.length, unsupportedPreserved: true, sha256: preserved };
    }
  } finally { await database.closeAsync(); }
}
