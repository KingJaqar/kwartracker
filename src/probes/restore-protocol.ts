/** Isolated S1 prototype. Product restore/recovery remains Phase 5. */
export const restorePhases = ['AUTHORIZED', 'STAGING_VALIDATED', 'OLD_RENAMED', 'NEW_RENAMED', 'NEW_VALIDATED', 'DB_COMMITTED', 'DEVICE_NORMALIZING', 'READY', 'CLEANUP_PENDING'] as const;
export const normalizationSteps = ['credentials', 'security', 'notifications', 'portableFlags', 'suggestions', 'crashCapture', 'telemetry'] as const;
export type RestorePhase = typeof restorePhases[number];
export type NormalizationStep = typeof normalizationSteps[number];
export type ProbeFile = 'live.db' | 'staged.db' | 'rollback.db';
export type ProbeJournal = {
  operation: string;
  packageHash: string;
  oldHash: string;
  newHash: string;
  paths: { live: 'live.db'; staged: 'staged.db'; rollback: 'rollback.db' };
  phase: RestorePhase;
  completed: NormalizationStep[];
};
export interface RestoreProbeIo {
  readJournal(): Promise<ProbeJournal | null>;
  writeJournal(journal: ProbeJournal): Promise<void>;
  hash(file: ProbeFile): Promise<string | null>;
  rename(from: ProbeFile, to: ProbeFile): Promise<void>;
  remove(file: 'staged.db' | 'rollback.db' | 'journal.json'): Promise<void>;
  normalize(step: NormalizationStep): Promise<void>;
}
export type ProbeCheckpoint = (point: string) => Promise<void>;
const paired = (label: string) => [`before:${label}`, `after:${label}`];
export const restoreCheckpoints = [
  ...paired('journal:AUTHORIZED'), ...paired('journal:STAGING_VALIDATED'),
  ...paired('rename:old'), ...paired('journal:OLD_RENAMED'),
  ...paired('rename:new'), ...paired('journal:NEW_RENAMED'),
  ...paired('journal:NEW_VALIDATED'), ...paired('journal:DB_COMMITTED'),
  ...paired('journal:DEVICE_NORMALIZING'),
  ...normalizationSteps.flatMap(step => [...paired(`normalize:${step}`), ...paired(`bitmap:${step}`)]),
  ...paired('journal:READY'), ...paired('journal:CLEANUP_PENDING'),
  ...['rollback', 'staged', 'journal'].flatMap(file => paired(`delete:${file}`)),
];
const noFault: ProbeCheckpoint = async () => undefined;
export class RestoreProbeBlocked extends Error {
  readonly reason: 'CORRUPT' | 'ROLLBACK_UNAVAILABLE';
  constructor(reason: RestoreProbeBlocked['reason']) { super(reason); this.reason = reason; }
}

export function parseProbeJournal(text: string, operation: string): ProbeJournal | null {
  if (text === '') return null;
  const value: unknown = JSON.parse(text);
  if (typeof value !== 'object' || value === null) throw new Error('Invalid synthetic journal');
  const row = value as Record<string, unknown>;
  const paths = row.paths;
  if (row.operation !== operation || !/^[0-9a-f-]{36}$/.test(operation)
    || !['packageHash', 'oldHash', 'newHash'].every(key => typeof row[key] === 'string' && /^[0-9a-f]{64}$/.test(row[key]))
    || !restorePhases.some(phase => phase === row.phase)
    || !Array.isArray(row.completed) || row.completed.some((step: unknown) => !normalizationSteps.some(known => known === step))
    || new Set(row.completed).size !== row.completed.length
    || (['AUTHORIZED', 'STAGING_VALIDATED', 'OLD_RENAMED', 'NEW_RENAMED', 'NEW_VALIDATED', 'DB_COMMITTED'].includes(String(row.phase)) && row.completed.length !== 0)
    || (['READY', 'CLEANUP_PENDING'].includes(String(row.phase)) && row.completed.length !== normalizationSteps.length)
    || typeof paths !== 'object' || paths === null
    || !('live' in paths && paths.live === 'live.db' && 'staged' in paths && paths.staged === 'staged.db' && 'rollback' in paths && paths.rollback === 'rollback.db')) {
    throw new Error('Invalid synthetic journal');
  }
  // The boundary above validates every field consumed by the protocol.
  return { operation, packageHash: String(row.packageHash), oldHash: String(row.oldHash), newHash: String(row.newHash), paths: { live: 'live.db', staged: 'staged.db', rollback: 'rollback.db' }, phase: row.phase as RestorePhase, completed: row.completed as NormalizationStep[] };
}

async function action(checkpoint: ProbeCheckpoint, label: string, work: () => Promise<void>) {
  await checkpoint(`before:${label}`);
  await work();
  await checkpoint(`after:${label}`);
}
async function persist(io: RestoreProbeIo, journal: ProbeJournal, phase: RestorePhase, checkpoint: ProbeCheckpoint) {
  const next = { ...journal, phase };
  await action(checkpoint, `journal:${phase}`, () => io.writeJournal(next));
  return next;
}

export async function executeRestoreProbe(io: RestoreProbeIo, initial: ProbeJournal, checkpoint: ProbeCheckpoint = noFault) {
  let journal = await persist(io, initial, 'AUTHORIZED', checkpoint);
  if (await io.hash('live.db') !== journal.oldHash || await io.hash('staged.db') !== journal.newHash) throw new RestoreProbeBlocked('CORRUPT');
  journal = await persist(io, journal, 'STAGING_VALIDATED', checkpoint);
  await action(checkpoint, 'rename:old', () => io.rename('live.db', 'rollback.db'));
  journal = await persist(io, journal, 'OLD_RENAMED', checkpoint);
  await action(checkpoint, 'rename:new', () => io.rename('staged.db', 'live.db'));
  journal = await persist(io, journal, 'NEW_RENAMED', checkpoint);
  if (await io.hash('live.db') !== journal.newHash) throw new RestoreProbeBlocked('CORRUPT');
  journal = await persist(io, journal, 'NEW_VALIDATED', checkpoint);
  journal = await persist(io, journal, 'DB_COMMITTED', checkpoint);
  await completeRestoreProbe(io, journal, checkpoint);
}

async function completeRestoreProbe(io: RestoreProbeIo, input: ProbeJournal, checkpoint: ProbeCheckpoint) {
  if (await io.hash('live.db') !== input.newHash) throw new RestoreProbeBlocked('CORRUPT');
  let journal = input;
  if (restorePhases.indexOf(journal.phase) < restorePhases.indexOf('READY')) {
    journal = await persist(io, journal, 'DEVICE_NORMALIZING', checkpoint);
    for (const step of normalizationSteps) {
      if (journal.completed.includes(step)) continue;
      await action(checkpoint, `normalize:${step}`, () => io.normalize(step));
      const next = { ...journal, completed: [...journal.completed, step] };
      await action(checkpoint, `bitmap:${step}`, () => io.writeJournal(next));
      journal = next;
    }
    journal = await persist(io, journal, 'READY', checkpoint);
  }
  journal = await persist(io, journal, 'CLEANUP_PENDING', checkpoint);
  await action(checkpoint, 'delete:rollback', () => io.remove('rollback.db'));
  await action(checkpoint, 'delete:staged', () => io.remove('staged.db'));
  await action(checkpoint, 'delete:journal', () => io.remove('journal.json'));
}

/** Caller keeps finance/network services gated until this returns successfully. One attempt only. */
export async function recoverRestoreProbe(io: RestoreProbeIo, checkpoint: ProbeCheckpoint = noFault): Promise<'old' | 'new' | 'no-journal'> {
  const journal = await io.readJournal();
  if (!journal) return 'no-journal';
  if (restorePhases.indexOf(journal.phase) < restorePhases.indexOf('DB_COMMITTED')) {
    if (await io.hash('live.db') !== journal.oldHash) {
      if (await io.hash('rollback.db') !== journal.oldHash) throw new RestoreProbeBlocked('ROLLBACK_UNAVAILABLE');
      // Preserve a replacement (including a corrupt one) for diagnosis; do not overwrite it.
      if (await io.hash('live.db') !== null) {
        if (await io.hash('staged.db') !== null) throw new RestoreProbeBlocked('ROLLBACK_UNAVAILABLE');
        await action(checkpoint, 'rollback:preserve-new', () => io.rename('live.db', 'staged.db'));
      }
      await action(checkpoint, 'rollback:restore-old', () => io.rename('rollback.db', 'live.db'));
    }
    if (await io.hash('live.db') !== journal.oldHash) throw new RestoreProbeBlocked('ROLLBACK_UNAVAILABLE');
    await action(checkpoint, 'rollback:journal', () => io.remove('journal.json'));
    return 'old';
  }
  await completeRestoreProbe(io, journal, checkpoint);
  return 'new';
}
