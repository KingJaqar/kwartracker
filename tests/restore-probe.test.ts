import { test } from 'node:test';
import assert from 'node:assert/strict';
import { executeRestoreProbe, recoverRestoreProbe, normalizationSteps, parseProbeJournal, restoreCheckpoints, RestoreProbeBlocked, type ProbeFile, type ProbeJournal, type RestoreProbeIo } from '../src/probes/restore-protocol.ts';

const initial: ProbeJournal = { operation: '10000000-0000-4000-8000-000000000000', packageHash: 'a'.repeat(64), oldHash: 'b'.repeat(64), newHash: 'c'.repeat(64), paths: { live: 'live.db', staged: 'staged.db', rollback: 'rollback.db' }, phase: 'AUTHORIZED', completed: [] };
function sandbox() {
  const files = new Map<ProbeFile, string>([['live.db', initial.oldHash], ['staged.db', initial.newHash]]);
  const device = new Map(normalizationSteps.map(step => [step, true]));
  let journal: ProbeJournal | null = null;
  let failStep = '';
  let failDelete = false;
  const io: RestoreProbeIo = {
    readJournal: async () => journal && structuredClone(journal),
    writeJournal: async value => { journal = parseProbeJournal(JSON.stringify(value), initial.operation); },
    hash: async file => files.get(file) ?? null,
    rename: async (from, to) => {
      assert.equal(files.has(to), false);
      const contents = files.get(from);
      assert.ok(contents);
      files.set(to, contents); files.delete(from);
    },
    remove: async file => {
      if (failDelete) throw new Error('Injected storage failure');
      if (file === 'journal.json') journal = null; else files.delete(file);
    },
    normalize: async step => {
      if (step === failStep) throw new Error('Injected provider failure');
      device.set(step, false);
    },
  };
  return { io, files, device, journal: () => journal, failNormalization: (step: string) => { failStep = step; }, failCleanup: (value: boolean) => { failDelete = value; } };
}

test('S1 synthetic fault matrix: each durable boundary selects complete old or new data and corresponding device state', async () => {
  const points: string[] = [];
  await executeRestoreProbe(sandbox().io, initial, async point => { points.push(point); });
  assert.equal(new Set(points).size, points.length);
  assert.deepEqual(points, restoreCheckpoints);
  assert.equal(points.length, 56);
  const commitIndex = points.indexOf('after:journal:DB_COMMITTED');
  for (const [index, point] of points.entries()) {
    const value = sandbox();
    await assert.rejects(executeRestoreProbe(value.io, initial, async current => { if (current === point) throw new Error('Injected interruption'); }), /Injected interruption/);
    const outcome = await recoverRestoreProbe(value.io);
    const committed = index >= commitIndex;
    assert.equal(value.files.get('live.db'), committed ? initial.newHash : initial.oldHash, point);
    assert.equal([...value.device.values()].every(flag => flag === !committed), true, point);
    assert.equal(value.journal(), null, point);
    assert.equal(outcome === 'no-journal' || outcome === (committed ? 'new' : 'old'), true, point);
  }
});

test('S1 a provider failure keeps the committed replacement and journal gated until explicit recovery succeeds', async () => {
  for (const step of normalizationSteps) {
    const value = sandbox();
    value.failNormalization(step);
    await assert.rejects(executeRestoreProbe(value.io, initial), /provider failure/);
    assert.equal(value.files.get('live.db'), initial.newHash);
    assert.equal(value.journal()?.phase, 'DEVICE_NORMALIZING');
    assert.equal(value.journal()?.completed.includes(step), false);
    await assert.rejects(recoverRestoreProbe(value.io), /provider failure/);
    assert.equal(value.files.get('live.db'), initial.newHash);
    value.failNormalization('');
    assert.equal(await recoverRestoreProbe(value.io), 'new');
    assert.equal([...value.device.values()].every(flag => flag === false), true);
  }
});

test('S1 corruption has different outcomes on either side of the commit decision; post-commit copies remain intact', async () => {
  for (const phase of ['NEW_RENAMED', 'DB_COMMITTED'] as const) {
    const value = sandbox();
    await assert.rejects(executeRestoreProbe(value.io, initial, async point => { if (point === `after:journal:${phase}`) throw new Error('Injected interruption'); }));
    value.files.set('live.db', 'corrupt');
    if (phase === 'NEW_RENAMED') {
      assert.equal(await recoverRestoreProbe(value.io), 'old');
      assert.equal(value.files.get('live.db'), initial.oldHash);
      assert.equal(value.files.get('staged.db'), 'corrupt');
      assert.equal([...value.device.values()].every(Boolean), true);
    } else {
      const before = structuredClone([...value.files]);
      await assert.rejects(recoverRestoreProbe(value.io), (error: unknown) => error instanceof RestoreProbeBlocked && error.reason === 'CORRUPT');
      assert.deepEqual([...value.files], before);
      assert.equal(value.journal()?.phase, 'DB_COMMITTED');
      assert.equal([...value.device.values()].every(Boolean), true);
    }
  }
});

test('S1 cleanup failures never roll back normalized device state and malformed journal paths are rejected', async () => {
  const value = sandbox();
  value.failCleanup(true);
  await assert.rejects(executeRestoreProbe(value.io, initial), /storage failure/);
  assert.equal(value.journal()?.phase, 'CLEANUP_PENDING');
  assert.equal(value.files.get('live.db'), initial.newHash);
  assert.equal([...value.device.values()].every(flag => flag === false), true);
  await assert.rejects(recoverRestoreProbe(value.io), /storage failure/);
  value.failCleanup(false);
  assert.equal(await recoverRestoreProbe(value.io), 'new');
  for (const invalid of [{ ...initial, paths: { ...initial.paths, live: '../product.db' } }, { ...initial, phase: 'READY' }, { ...initial, completed: ['credentials'] }]) {
    assert.throws(() => parseProbeJournal(JSON.stringify(invalid), initial.operation));
  }
});
