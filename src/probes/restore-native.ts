import { openDatabaseAsync } from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { canonicalJson, type CanonicalValue } from '../domain/canonical';
import { restoreProbeIo } from './platform';
import { parseProbeJournal, type NormalizationStep, type ProbeFile, type ProbeJournal, type RestoreProbeIo } from './restore-protocol';
import { generatePerfFixture } from '../../tests/fixtures/perf';
import perfManifest from '../../tests/fixtures/perf-manifest.json';
import { loadFixture } from '../../tests/fixtures/load';
import { migrate } from '../db/migrations';

const digest = (value: CanonicalValue) => bytesToHex(sha256(utf8ToBytes(canonicalJson(value))));
const oldDevice = {
  passcode: true, biometrics: true, reminder: true, assistive: true,
  suggestions: ['synthetic-suggestion'], crashCapture: true, telemetryConsent: true,
  installIdentity: 'synthetic-install', telemetryQueue: ['synthetic-event'],
};
const newDevice = { passcode: false, biometrics: false, reminder: false, assistive: false, suggestions: [], crashCapture: false, telemetryConsent: false, installIdentity: null, telemetryQueue: [] };
type DeviceMarkers = Record<string, CanonicalValue>;
function deviceMarkers(text: string): DeviceMarkers {
  const value: unknown = JSON.parse(text);
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid device markers');
  const row = value as Record<string, unknown>;
  for (const name of ['passcode', 'biometrics', 'reminder', 'assistive', 'crashCapture', 'telemetryConsent']) {
    if (typeof row[name] !== 'boolean') throw new Error('Invalid device flag');
  }
  for (const name of ['suggestions', 'telemetryQueue']) {
    if (!Array.isArray(row[name]) || row[name].some((item: unknown) => typeof item !== 'string')) throw new Error('Invalid synthetic queue');
  }
  if (typeof row.installIdentity !== 'string' && row.installIdentity !== null) throw new Error('Invalid install marker');
  return row as DeviceMarkers;
}

/** Every file and key belongs to this operation in the nonshipping probe package. */
export async function openRestoreSandbox(operation: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(operation)) throw new Error('Invalid probe operation');
  const directory = await restoreProbeIo(operation, 'directory');
  const key = (suffix: string) => `foundation-${operation}-${suffix}`;
  const notificationIds = [key('reminder'), key('inactivity')];
  const exists = async (file: ProbeFile) => await restoreProbeIo(operation, 'exists', file) === 'true';
  const readDevice = async () => deviceMarkers(await restoreProbeIo(operation, 'read', 'device.json'));
  const writeDevice = async (value: DeviceMarkers) => { await restoreProbeIo(operation, 'write', 'device.json', canonicalJson(value)); };
  const hash = async (file: ProbeFile): Promise<string | null> => {
    if (!await exists(file)) return null;
    try {
      const database = await openDatabaseAsync(file, { useNewConnection: true }, directory);
      try {
        await database.execAsync('PRAGMA query_only=ON;');
        const integrity = await database.getAllAsync<{ integrity_check: string }>('PRAGMA integrity_check');
        const foreignKeys = await database.getAllAsync('PRAGMA foreign_key_check');
        if (integrity.length !== 1 || integrity[0]?.integrity_check !== 'ok' || foreignKeys.length) return 'corrupt';
        const schema = await database.getAllAsync<{ name: string; sql: string }>("SELECT name,sql FROM sqlite_master WHERE type='table' ORDER BY name");
        const names = schema.map(row => row.name).sort();
        const supported = names.join(',') === ['SyntheticAccount', 'SyntheticTransaction'].sort().join(',') || names.join(',') === Object.keys(perfManifest.counts).sort().join(',');
        if (!supported) return 'corrupt';
        const tables: Record<string, CanonicalValue> = {};
        for (const table of names) {
          const rows = await database.getAllAsync<Record<string, CanonicalValue>>(`SELECT * FROM "${table}"`);
          tables[table] = rows.map(row => canonicalJson(row)).sort();
        }
        const version = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
        return digest({ schema, tables, version: version?.user_version ?? -1 });
      } finally { await database.closeAsync(); }
    } catch { return 'corrupt'; }
  };
  const io: RestoreProbeIo = {
    readJournal: async () => parseProbeJournal(await restoreProbeIo(operation, 'read', 'journal.json'), operation),
    writeJournal: async journal => { await restoreProbeIo(operation, 'write', 'journal.json', canonicalJson(journal)); },
    hash,
    rename: async (from, to) => { await restoreProbeIo(operation, 'rename', from, to); },
    remove: async file => { await restoreProbeIo(operation, 'remove', file); },
    normalize: async (step: NormalizationStep) => {
      if (step === 'credentials') {
        await SecureStore.deleteItemAsync(key('verifier'));
        await SecureStore.deleteItemAsync(key('lockout'));
      } else if (step === 'notifications') {
        for (const id of notificationIds) await Notifications.cancelScheduledNotificationAsync(id);
      } else {
        const state = await readDevice();
        if (step === 'security') { state.passcode = false; state.biometrics = false; }
        if (step === 'portableFlags') { state.reminder = false; state.assistive = false; }
        if (step === 'suggestions') state.suggestions = [];
        if (step === 'crashCapture') state.crashCapture = false;
        if (step === 'telemetry') { state.telemetryConsent = false; state.installIdentity = null; state.telemetryQueue = []; }
        await writeDevice(state);
      }
    },
  };
  async function state() {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return {
      device: await readDevice(),
      verifier: await SecureStore.getItemAsync(key('verifier')),
      lockout: await SecureStore.getItemAsync(key('lockout')),
      notificationIds: notificationIds.filter(id => scheduled.some(item => item.identifier === id)),
      permission: (await Notifications.getPermissionsAsync()).status,
    };
  }
  async function assertSavedState(expected: 'old' | 'new', saved: string) {
    const initial: unknown = JSON.parse(saved);
    if (typeof initial !== 'object' || initial === null || !('permission' in initial) || typeof initial.permission !== 'string') throw new Error('Invalid baseline permission');
    const actual = await state();
    const wanted = expected === 'old' ? saved : canonicalJson({ device: newDevice, verifier: null, lockout: null, notificationIds: [], permission: initial.permission });
    if (canonicalJson(actual) !== wanted) throw new Error(`Synthetic ${expected} device-state oracle failed`);
    return digest(actual);
  }
  async function releaseSyntheticRequests() {
    for (const id of notificationIds) await Notifications.cancelScheduledNotificationAsync(id);
  }
  return { io, hash, state, assertSavedState, releaseSyntheticRequests, directory, key, notificationIds, writeDevice };
}

export async function prepareRestoreSandbox(signal?: AbortSignal, profile: 'small' | 'perf' = 'small') {
  const check = () => { if (signal?.aborted) throw new Error('Synthetic preparation cancelled'); };
  check();
  const fixture = profile === 'perf' ? generatePerfFixture() : null;
  if (fixture && fixture.seedHash !== perfManifest.seedHash) throw new Error('PERF fixture identity changed');
  const operation = await restoreProbeIo('', 'create');
  const sandbox = await openRestoreSandbox(operation);
  for (const [file, label, accountCount, transactionCount] of [['live.db', 'old', 2, 16], ['staged.db', 'new', 3, 24]] as const) {
    const database = await openDatabaseAsync(file, { useNewConnection: true }, sandbox.directory);
    try {
      await database.execAsync('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
      if (fixture) {
        await migrate(database);
        await loadFixture(database, fixture.data, check);
      } else {
        await database.execAsync('CREATE TABLE SyntheticAccount(id INTEGER PRIMARY KEY,name TEXT NOT NULL,opening INTEGER NOT NULL); CREATE TABLE SyntheticTransaction(id INTEGER PRIMARY KEY,account INTEGER NOT NULL REFERENCES SyntheticAccount(id),amount INTEGER NOT NULL,note TEXT NOT NULL); PRAGMA user_version=1;');
        await database.withExclusiveTransactionAsync(async transaction => {
        for (let index = 0; index < accountCount; index++) await transaction.runAsync('INSERT INTO SyntheticAccount VALUES(?,?,?)', index, `${label} account ${index}`, index * 100);
        for (let index = 0; index < transactionCount; index++) await transaction.runAsync('INSERT INTO SyntheticTransaction VALUES(?,?,?,?)', index, index % accountCount, index * 37 - 500, `${label} note ${index}`);
        });
      }
      const checkpoint = await database.getFirstAsync<{ busy: number }>('PRAGMA wal_checkpoint(TRUNCATE)');
      if (checkpoint?.busy !== 0) throw new Error('Synthetic WAL checkpoint busy');
    } finally { await database.closeAsync(); }
    await restoreProbeIo(operation, 'sync', file);
  }
  await sandbox.writeDevice(oldDevice);
  await SecureStore.setItemAsync(sandbox.key('verifier'), 'SYNTHETIC-NOT-A-CREDENTIAL');
  await SecureStore.setItemAsync(sandbox.key('lockout'), 'SYNTHETIC-LOCKOUT');
  const permission = await Notifications.getPermissionsAsync();
  if (permission.granted) {
    await Notifications.setNotificationChannelAsync('foundation-restore', { name: 'Synthetic restore checks', importance: Notifications.AndroidImportance.LOW });
    for (const identifier of sandbox.notificationIds) await Notifications.scheduleNotificationAsync({ identifier, content: { title: 'Synthetic restore marker' }, trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 86400, channelId: 'foundation-restore' } });
  }
  const oldHash = await sandbox.hash('live.db');
  const newHash = await sandbox.hash('staged.db');
  if (!oldHash || !newHash || oldHash === 'corrupt' || newHash === 'corrupt' || profile === 'small' && oldHash === newHash) throw new Error('Invalid synthetic datasets');
  const journal: ProbeJournal = { operation, packageHash: digest({ syntheticPackage: 'S1-v1', newHash }), oldHash, newHash, paths: { live: 'live.db', staged: 'staged.db', rollback: 'rollback.db' }, phase: 'AUTHORIZED', completed: [] };
  const initialState = canonicalJson(await sandbox.state());
  await restoreProbeIo(operation, 'write', 'baseline.json', canonicalJson({ journal, initialState }));
  return { ...sandbox, operation, journal, initialState, notificationPermission: permission.status, profile, seedHash: fixture?.seedHash ?? null };
}
