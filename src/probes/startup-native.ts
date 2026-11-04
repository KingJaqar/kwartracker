import { openDatabaseAsync } from 'expo-sqlite';
import { AppError } from '../domain/errors';
import { initializeDatabase } from '../db/startup';
import { migrate } from '../db/migrations';
import perfManifest from '../../tests/fixtures/perf-manifest.json';
import { restoreProbeIo } from './platform';
import { openRestoreSandbox } from './restore-native';
import { parseProbeJournal, recoverRestoreProbe, restoreCheckpoints } from './restore-protocol';

/** Actual nonempty journal recovery on the pinned full PERF dataset, before opening its live DB. */
export async function probeColdStartup(operation: string) {
  const sandbox = await openRestoreSandbox(operation);
  const baseline: unknown = JSON.parse(await restoreProbeIo(operation, 'read', 'baseline.json'));
  if (typeof baseline !== 'object' || baseline === null || !('profile' in baseline) || baseline.profile !== 'perf' || !('seedHash' in baseline) || baseline.seedHash !== perfManifest.seedHash || !('journal' in baseline) || !('initialState' in baseline) || typeof baseline.initialState !== 'string' || !('point' in baseline) || typeof baseline.point !== 'string' || !restoreCheckpoints.includes(baseline.point)) throw new AppError('PROBE_FAILED');
  const initial = parseProbeJournal(JSON.stringify(baseline.journal), operation);
  if (!initial || !await sandbox.io.readJournal()) throw new AppError('PROBE_FAILED');
  const order = ['recovery'];
  const started = performance.now();
  await recoverRestoreProbe(sandbox.io);
  const recoveryMs = performance.now() - started;
  const opening = performance.now();
  const database = await openDatabaseAsync('live.db', { useNewConnection: true }, sandbox.directory);
  const openMs = performance.now() - opening;
  try {
    const before = await database.getFirstAsync<{ count: number }>('SELECT total_changes() AS count');
    const timings = await initializeDatabase(database, async () => { if (await sandbox.io.readJournal()) throw new AppError('RECOVERY_REQUIRED'); }, { onStage: stage => { if (stage !== 'recovery') order.push(stage); } });
    const secondMigration = await migrate(database);
    const after = await database.getFirstAsync<{ count: number }>('SELECT total_changes() AS count');
    if (secondMigration !== 'current' || before?.count !== after?.count || order.join(',') !== 'recovery,migration,integrity,ready') throw new AppError('PROBE_FAILED');
    const counts: Record<string, number> = {};
    for (const [table, expected] of Object.entries(perfManifest.counts)) {
      const count = await database.getFirstAsync<{ count: number }>(`SELECT count(*) AS count FROM "${table}"`);
      if (count?.count !== expected) throw new AppError('PROBE_FAILED');
      counts[table] = count.count;
    }
    const expected = restoreCheckpoints.indexOf(baseline.point) >= restoreCheckpoints.indexOf('after:journal:DB_COMMITTED') ? 'new' : 'old';
    const deviceStateHash = await sandbox.assertSavedState(expected, baseline.initialState);
    await sandbox.releaseSyntheticRequests();
    return { status: 'passed', operation, seedHash: perfManifest.seedHash, counts, order, timings: timings.map(timing => timing.stage === 'recovery' ? { ...timing, milliseconds: timing.milliseconds + recoveryMs } : timing), openMilliseconds: openMs, secondMigration, noMigrationWritesOnCurrent: true, recoveredDeviceState: expected, deviceStateHash, scope: 'One full-fixture database-cold sample. Host must prove distinct process-cold launches; no invented startup-duration gate.' };
  } finally { await database.closeAsync(); }
}
