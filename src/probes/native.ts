import { Directory, File, Paths } from 'expo-file-system';
import { openDatabaseAsync } from 'expo-sqlite';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { AppError } from '../domain/errors';
import { initializeDatabase } from '../db/startup';
import { migrate } from '../db/migrations';
import { metrics } from '../theme/tokens';
import { generatePerfFixture } from '../../tests/fixtures/perf';
import { loadFixture } from '../../tests/fixtures/load';

export const PROBE_SCOPE = 'Synthetic foundation probes; not product acceptance';
const directory = () => {
  const value = new Directory(Paths.document, 'foundation-probes');
  value.create({ idempotent: true, intermediates: true });
  return value;
};

/** S1 primitive probe. Does not assert fsync/atomic journal durability from a public move API. */
export async function probeSqliteSwap() {
  const folder = directory();
  const id = Date.now().toString(36);
  const old = new File(folder, `${id}-old.db`);
  const staged = new File(folder, `${id}-staged.db`);
  const rollback = new File(folder, `${id}-rollback.db`);
  for (const [file, marker] of [[old, 'old-complete'], [staged, 'new-complete']] as const) {
    const database = await openDatabaseAsync(file.name, { useNewConnection: true }, folder.uri);
    try {
      await database.execAsync('PRAGMA journal_mode=WAL; CREATE TABLE SyntheticMarker(value TEXT);');
      await database.runAsync('INSERT INTO SyntheticMarker VALUES(?)', marker);
      const checkpoint = await database.getFirstAsync<{ busy: number }>('PRAGMA wal_checkpoint(TRUNCATE)');
      if (checkpoint?.busy !== 0) throw new AppError('DATABASE_BUSY');
    } finally { await database.closeAsync(); }
  }
  await old.move(rollback);
  await staged.move(new File(folder, `${id}-old.db`));
  const reopened = await openDatabaseAsync(`${id}-old.db`, { useNewConnection: true }, folder.uri);
  try {
    const marker = await reopened.getFirstAsync<{ value: string }>('SELECT value FROM SyntheticMarker');
    if (marker?.value !== 'new-complete') throw new AppError('DATABASE_CORRUPT');
    return { checkpointCloseMoveReopen: 'observed', marker: marker.value, rollbackRetained: rollback.exists, journalFlushAtomicity: 'unverified; S1 remains open', directory: 'foundation-probes (synthetic only)' };
  } finally { await reopened.closeAsync(); }
}

/** S4 cancel one scheduled identifier without disturbing any other app-owned request. */
export async function probeNotificationCancel() {
  await Notifications.setNotificationChannelAsync('foundation-probe', { name: 'Foundation checks', importance: Notifications.AndroidImportance.DEFAULT });
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return { permission: permission.status, scheduled: false, outcome: 'permission-denied' };
  const before = await Notifications.getAllScheduledNotificationsAsync();
  const id = await Notifications.scheduleNotificationAsync({
    content: { title: 'Kwartracker foundation check', body: 'Synthetic notification only.' },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 300, channelId: 'foundation-probe' },
  });
  try {
    const during = await Notifications.getAllScheduledNotificationsAsync();
    if (!during.some(request => request.identifier === id)) throw new AppError('INVALID_COMMAND');
  } finally { await Notifications.cancelScheduledNotificationAsync(id); }
  const after = await Notifications.getAllScheduledNotificationsAsync();
  return { permission: permission.status, scheduled: true, cancelledOwnIdentifier: !after.some(request => request.identifier === id), otherIdentifiersPreserved: before.every(request => after.some(candidate => candidate.identifier === request.identifier)), rebootAndTimeZone: 'pending physical-device procedure' };
}

const rebootProbeId = 'kwartracker-foundation-reboot';
export async function scheduleRebootProbe() {
  await Notifications.setNotificationChannelAsync('foundation-probe', { name: 'Foundation checks', importance: Notifications.AndroidImportance.DEFAULT });
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return { permission: permission.status, scheduled: false };
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  if (existing.some(request => request.identifier === rebootProbeId)) return { scheduled: false, reason: 'Existing synthetic request retained; inspect/cancel it before scheduling another.' };
  const target = new Date(Date.now() + 5 * 60000);
  const trigger: Notifications.DailyTriggerInput = { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: target.getHours(), minute: target.getMinutes(), channelId: 'foundation-probe' };
  await Notifications.scheduleNotificationAsync({ identifier: rebootProbeId, content: { title: 'Kwartracker reboot/timezone check', body: 'Synthetic daily trigger; cancel after inspection.' }, trigger });
  return { scheduled: true, trigger, scheduledTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, outcome: 'Observe delivery after reboot/timezone change; then inspect and cancel.' };
}

export async function inspectAndCancelRebootProbe() {
  const requests = await Notifications.getAllScheduledNotificationsAsync();
  const matching = requests.find(request => request.identifier === rebootProbeId);
  await Notifications.cancelScheduledNotificationAsync(rebootProbeId);
  return { wasScheduled: Boolean(matching), trigger: matching?.trigger ?? null, currentTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, cancelled: !(await Notifications.getAllScheduledNotificationsAsync()).some(request => request.identifier === rebootProbeId) };
}

/** S5 prepare markers to inspect through Android backup/transfer; never a credential. */
export async function prepareBackupMarkers() {
  const database = await openDatabaseAsync('backup-marker.db', { useNewConnection: true }, directory().uri);
  try { await database.execAsync("CREATE TABLE IF NOT EXISTS SyntheticMarker(value TEXT); DELETE FROM SyntheticMarker; INSERT INTO SyntheticMarker VALUES('SYNTHETIC-BACKUP-EXCLUSION');"); }
  finally { await database.closeAsync(); }
  await SecureStore.setItemAsync('foundation-probe-backup-marker', 'SYNTHETIC-NOT-A-CREDENTIAL');
  return { markersPrepared: true, backupTransferExclusion: 'pending actual Android backup/transfer inspection', minimumTouchTarget: metrics.minTouch };
}

export async function inspectBackupMarkers() {
  const file = new File(directory(), 'backup-marker.db');
  const secret = await SecureStore.getItemAsync('foundation-probe-backup-marker');
  return { databaseMarkerPresent: file.exists, secureStoreMarkerPresent: secret !== null };
}

/** S6 records one cold open per explicit launch. Five launches require device/build provenance. */
export async function probeStartup() {
  const database = await openDatabaseAsync('startup-probe.db', { useNewConnection: true }, directory().uri);
  try {
    const timings = await initializeDatabase(database, async () => undefined);
    const secondOpen = await migrate(database);
    const count = await database.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM "Transaction"');
    const marker = new File(directory(), 'startup-seed.json');
    return { timings, secondMigration: secondOpen, transactionCount: count?.count ?? 0, seed: marker.exists ? await marker.text() : null, status: 'One explicit open. Five process-cold launches and build/device provenance required.' };
  } finally { await database.closeAsync(); }
}

export async function seedStartupFixture(signal?: AbortSignal) {
  const check = () => { if (signal?.aborted) throw new AppError('CANCELLED'); };
  check();
  const fixture = generatePerfFixture();
  check();
  const file = new File(directory(), 'startup-probe.db');
  // Never overwrite a previous synthetic run automatically; preserves timing/fault evidence.
  if (file.exists) return { seeded: false, reason: 'Existing synthetic database retained. Use a fresh probe sandbox for another seed.' };
  const database = await openDatabaseAsync(file.name, { useNewConnection: true }, directory().uri);
  try {
    await migrate(database);
    await loadFixture(database, fixture.data, check);
    check();
    new File(directory(), 'startup-seed.json').write(JSON.stringify({ seed: fixture.seed, seedHash: fixture.seedHash }));
    return { seeded: true, seedHash: fixture.seedHash, transactionCount: fixture.data.Transaction.length };
  } finally { await database.closeAsync(); }
}
