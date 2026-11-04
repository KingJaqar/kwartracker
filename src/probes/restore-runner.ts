import { canonicalJson } from '../domain/canonical';
import { restoreProbeIo } from './platform';
import { openRestoreSandbox, prepareRestoreSandbox } from './restore-native';
import { executeRestoreProbe, recoverRestoreProbe, parseProbeJournal, restoreCheckpoints, normalizationSteps, RestoreProbeBlocked } from './restore-protocol';

class ProbePause extends Error {}
export async function startRestoreCase(point: string, signal: AbortSignal, profile: 'small' | 'perf' = 'small') {
  if (!restoreCheckpoints.includes(point)) throw new Error('Unknown interruption point');
  if (signal.aborted) throw new Error('Probe cancelled');
  const sandbox = await prepareRestoreSandbox(signal, profile);
  await restoreProbeIo(sandbox.operation, 'write', 'baseline.json', canonicalJson({ journal: sandbox.journal, initialState: sandbox.initialState, point, profile, seedHash: sandbox.seedHash }));
  try {
    await executeRestoreProbe(sandbox.io, sandbox.journal, async current => {
      if (signal.aborted) throw new Error('Probe deadline');
      if (current === point) throw new ProbePause();
    });
    throw new Error('Interruption point not reached');
  } catch (error) {
    if (!(error instanceof ProbePause)) throw error;
    return { status: 'paused', operation: sandbox.operation, point, journalPhase: (await sandbox.io.readJournal())?.phase ?? null, notificationPermission: sandbox.notificationPermission, profile, seedHash: sandbox.seedHash };
  }
}

export async function recoverRestoreCase(operation: string, fail: string, signal: AbortSignal) {
  if (fail !== '' && fail !== 'cleanup' && !normalizationSteps.some(step => step === fail)) throw new Error('Unknown failure action');
  if (signal.aborted) throw new Error('Probe cancelled');
  const sandbox = await openRestoreSandbox(operation);
  const baseline: unknown = JSON.parse(await restoreProbeIo(operation, 'read', 'baseline.json'));
  if (typeof baseline !== 'object' || baseline === null || !('journal' in baseline) || !('initialState' in baseline) || typeof baseline.initialState !== 'string' || !('point' in baseline) || typeof baseline.point !== 'string' || !restoreCheckpoints.includes(baseline.point)) throw new Error('Invalid synthetic baseline');
  const initial = parseProbeJournal(JSON.stringify(baseline.journal), operation);
  if (!initial) throw new Error('Missing synthetic baseline');
  const phase = (await sandbox.io.readJournal())?.phase;
  const expected = restoreCheckpoints.indexOf(baseline.point) >= restoreCheckpoints.indexOf('after:journal:DB_COMMITTED') ? 'new' : 'old';
  const stateBefore = canonicalJson(await sandbox.state());
  let blocked: string | null = null;
  try {
    await recoverRestoreProbe({ ...sandbox.io,
      normalize: async step => { if (signal.aborted || step === fail) throw new Error('Injected normalization failure'); await sandbox.io.normalize(step); },
      remove: async file => { if (signal.aborted || fail === 'cleanup') throw new Error('Injected cleanup failure'); await sandbox.io.remove(file); },
    });
  } catch (error) {
    if (error instanceof RestoreProbeBlocked) blocked = error.reason;
    else if (fail !== '') blocked = 'INJECTED_FAILURE';
    else throw error;
  }
  const datasetHash = await sandbox.hash('live.db');
  if (blocked) {
    const journal = await sandbox.io.readJournal();
    if (!journal) throw new Error('Blocked recovery lost its journal');
    if (blocked !== 'CORRUPT' && datasetHash !== initial.newHash) throw new Error('Blocked completion lost replacement');
    if (blocked === 'CORRUPT' && canonicalJson(await sandbox.state()) !== stateBefore) throw new Error('Corrupt recovery mutated device state');
    return { status: 'blocked', operation, phase, blocked, datasetHash, journalRetained: true, productServices: 'Absent from isolated prototype root' };
  }
  if (datasetHash !== (expected === 'old' ? initial.oldHash : initial.newHash)) throw new Error(`Recovered dataset disagrees with the ${expected} commit oracle`);
  const deviceStateHash = await sandbox.assertSavedState(expected, baseline.initialState);
  if (await sandbox.io.readJournal()) throw new Error('Completed recovery retained a journal');
  await sandbox.releaseSyntheticRequests();
  return { status: 'passed', operation, phase, dataset: expected, datasetHash, deviceStateHash, journalRemoved: true, productServices: 'Absent from isolated prototype root', scope: 'Synthetic credentials/schedules plus representative local service markers. Product integration remains Phase 5.' };
}

export async function corruptRestoreCase(operation: string) {
  await openRestoreSandbox(operation); // Validates the operation and owned directory before mutation.
  await restoreProbeIo(operation, 'corrupt', 'live.db');
  return { status: 'corrupted-synthetic-copy', operation };
}

export function listRestoreCases() { return { status: 'ready', points: restoreCheckpoints, count: restoreCheckpoints.length, inputIdentity: canonicalJson({ version: 1, points: restoreCheckpoints }) }; }
