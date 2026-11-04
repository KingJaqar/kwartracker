import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { TestDatabase } from './helpers/sqlite.ts';
import { failAt } from './helpers/fault.ts';
import { migrate, schemaObjects } from '../src/db/migrations/index.ts';
import { initializeDatabase } from '../src/db/startup.ts';
import { DatabaseCoordinator } from '../src/db/coordinator.ts';
import { portableWrite } from '../src/repositories/write-receipts.ts';
import { AppError } from '../src/domain/errors.ts';
import { generatePerfFixture } from './fixtures/perf.ts';
import type { PortableData } from '../src/domain/portable.ts';
import type { SqlConnection } from '../src/db/connection.ts';
import { runMigrationChain, type Migration } from '../src/db/migrations/chain.ts';
import { loadFixture } from './fixtures/load.ts';

const hash = async (text: string) => createHash('sha256').update(text).digest('hex');
const command = { operationToken: '10000000-0000-4000-8000-000000000000', operation: 'create', entityType: 'account', entityId: '20000000-0000-4000-8000-000000000000', input: { name: 'Synthetic account' } } as const;
const insertAccount = `INSERT INTO Account VALUES('20000000-0000-4000-8000-000000000000','Synthetic account','wallet',-100,0,'2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z')`;

test('TC-122 Phase0: empty initializes once; current open performs no migration writes', async () => {
  const database = new TestDatabase();
  assert.equal(await migrate(database), 'initialized');
  const changes = database.raw.prepare('SELECT total_changes() AS count').get()?.count;
  assert.equal(await migrate(database), 'current');
  assert.equal(database.raw.prepare('SELECT total_changes() AS count').get()?.count, changes);
  assert.equal((await schemaObjects(database)).filter(row => row.type === 'table').length, 10);
  await database.closeAsync();
});

test('TC-122 asynchronous native observation barriers remain inside the atomic migration transaction', async () => {
  for (const target of ['migration:before-schema', 'migration:after-schema', 'migration:0:1:after-step', 'migration:before-commit']) {
    const database = new TestDatabase();
    await assert.rejects(migrate(database, async point => {
      await Promise.resolve();
      if (point === target) throw new AppError('INJECTED_FAILURE');
    }), { code: 'INJECTED_FAILURE' });
    assert.equal((await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 0);
    assert.deepEqual(await schemaObjects(database), []);
    await database.closeAsync();
  }
});

test('TC-122 Phase0: every initialization fault rolls back schema, preferences and version', async () => {
  for (const point of ['migration:before-schema', 'migration:after-schema', 'migration:before-commit']) {
    const database = new TestDatabase();
    await assert.rejects(migrate(database, failAt(point)), { code: 'INJECTED_FAILURE' });
    assert.equal((await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 0);
    assert.deepEqual(await schemaObjects(database), []);
    assert.equal(await migrate(database), 'initialized');
    await database.closeAsync();
  }
});

test('TC-122 Phase0: unknown nonempty, unsupported older/newer and forged current schemas are preserved', async () => {
  for (const version of [0, 1, 2, 99]) {
    const directory = mkdtempSync(join(tmpdir(), 'kwartracker-unknown-'));
    const path = join(directory, 'synthetic.db');
    const database = new TestDatabase(path);
    await database.execAsync(`CREATE TABLE Untouched(value TEXT); INSERT INTO Untouched VALUES('synthetic'); PRAGMA user_version=${version}`);
    const before = createHash('sha256').update(readFileSync(path)).digest('hex');
    await assert.rejects(initializeDatabase(database, async () => undefined), { code: 'DATABASE_UNSUPPORTED' });
    assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), before);
    assert.equal((await database.getFirstAsync<{ value: string }>('SELECT value FROM Untouched'))?.value, 'synthetic');
    await database.closeAsync();
    rmSync(directory, { recursive: true });
  }
});

test('unknown table names resembling SQLite internals are not mistaken for an empty database', async () => {
  const database = new TestDatabase();
  await database.execAsync('CREATE TABLE sqliteX(value TEXT)');
  await assert.rejects(migrate(database), { code: 'DATABASE_UNSUPPORTED' });
  assert.equal((await schemaObjects(database)).length, 1);
  await database.closeAsync();
});

test('local damaged appearance reads default without changing finance; missing preferences block readiness', async () => {
  const database = new TestDatabase();
  await migrate(database);
  await database.execAsync("UPDATE PreferencesPortable SET uiMode='damaged',theme='damaged'");
  await initializeDatabase(database, async () => undefined);
  await database.execAsync('DELETE FROM PreferencesPortable');
  await assert.rejects(initializeDatabase(database, async () => undefined), { code: 'DATABASE_CORRUPT' });
  await database.closeAsync();
});

test('FR-NAV-002 startup order and failed recovery prevent migration or navigator admission', async () => {
  const database = new TestDatabase();
  const stages: string[] = [];
  await initializeDatabase(database, async () => { stages.push('journal-inspection'); }, { onStage: stage => stages.push(stage) });
  assert.deepEqual(stages, ['recovery', 'journal-inspection', 'migration', 'integrity', 'ready']);
  await database.closeAsync();
  const blocked = new TestDatabase();
  await assert.rejects(initializeDatabase(blocked, async () => { throw new AppError('RECOVERY_REQUIRED'); }), { code: 'RECOVERY_REQUIRED' });
  assert.deepEqual(await schemaObjects(blocked), []);
  await blocked.closeAsync();
});

test('TC-28/43/111 repository legs: concurrent replay, conflict, rollback and replay after deletion/restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'kwartracker-receipt-'));
  const path = join(directory, 'synthetic.db');
  const database = new TestDatabase(path);
  await migrate(database);
  const coordinator = new DatabaseCoordinator(database);
  const mutate = async (transaction: SqlConnection) => { await transaction.execAsync(insertAccount); };
  const [first, replay] = await Promise.all([portableWrite(coordinator, command, hash, mutate), portableWrite(coordinator, command, hash, async () => { throw new Error('Replay must not revalidate'); })]);
  assert.deepEqual(replay, first);
  assert.equal((await database.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM Account'))?.count, 1);
  await assert.rejects(portableWrite(coordinator, { ...command, input: { name: 'changed' } }, hash, mutate), { code: 'IDEMPOTENCY_CONFLICT' });
  await coordinator.write(transaction => transaction.execAsync('DELETE FROM Account'));
  await database.closeAsync();
  const restarted = new TestDatabase(path);
  assert.equal(await migrate(restarted), 'current');
  assert.deepEqual(await portableWrite(new DatabaseCoordinator(restarted), command, hash, async () => { throw new Error('Deleted target cannot be recreated'); }), first);
  const failure = { ...command, operationToken: '30000000-0000-4000-8000-000000000000' };
  await assert.rejects(portableWrite(new DatabaseCoordinator(restarted), failure, hash, async transaction => { await transaction.execAsync(insertAccount); throw new Error('SQLITE_FULL'); }), { code: 'INSUFFICIENT_STORAGE' });
  assert.equal((await restarted.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM WriteReceipt'))?.count, 1);
  assert.equal((await restarted.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM Account'))?.count, 0);
  await restarted.closeAsync();
  rmSync(directory, { recursive: true });
});

test('restore admission drains readers/writers, rejects new work and remains closed after failure', async () => {
  const database = new TestDatabase();
  const coordinator = new DatabaseCoordinator(database);
  let finishRead: () => void = () => { throw new Error('Reader not started'); };
  const read = coordinator.read(() => new Promise<void>(resolve => { finishRead = resolve; }));
  let restored = false;
  const restore = coordinator.withRestoreLock(async () => { restored = true; throw new AppError('INJECTED_FAILURE'); });
  await assert.rejects(coordinator.write(async () => undefined), { code: 'RESTORE_IN_PROGRESS' });
  await assert.rejects(coordinator.read(async () => undefined), { code: 'RESTORE_IN_PROGRESS' });
  assert.equal(restored, false);
  finishRead();
  await read;
  await assert.rejects(restore, { code: 'INJECTED_FAILURE' });
  await assert.rejects(coordinator.read(async () => 'ready'), { code: 'RESTORE_IN_PROGRESS' });
  await database.closeAsync();
});

test('fault harness kills a real child process mid-migration; reopen has original complete source', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'kwartracker-kill-'));
  const path = join(directory, 'synthetic.db');
  const script = `const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(process.argv[1]);db.exec('BEGIN EXCLUSIVE;CREATE TABLE Partial(value TEXT);INSERT INTO Partial VALUES(\'synthetic\');PRAGMA user_version=1;');process.kill(process.pid,'SIGKILL');`;
  const result = spawnSync(process.execPath, ['-e', script, path], { timeout: 10000, windowsHide: true });
  assert.notEqual(result.status, 0);
  const restarted = new TestDatabase(path);
  assert.deepEqual(await schemaObjects(restarted), []);
  assert.equal((await restarted.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 0);
  assert.equal(await migrate(restarted), 'initialized');
  await restarted.closeAsync();
  rmSync(directory, { recursive: true });
});

test('synthetic batched fixture loading bounds native calls and rolls back a cancelled multi-batch load', async () => {
  const data = generatePerfFixture().data;
  const database = new TestDatabase();
  await migrate(database);
  const original = await database.getAllAsync('SELECT * FROM PreferencesPortable');
  const run = database.runAsync.bind(database);
  let calls = 0;
  database.runAsync = async (sql, ...params) => {
    calls++;
    assert.ok(params.length <= 900, 'Each statement stays below the portable bind limit');
    return run(sql, ...params);
  };
  let cursor = 0;
  await assert.rejects(loadFixture(database, data, count => {
    assert.equal(count, ++cursor);
    if (count === 1000) throw new Error('Synthetic cancellation');
  }), /Synthetic cancellation/);
  assert.ok(calls > 1, 'Cancellation occurs after multiple real inserts');
  assert.equal((await database.getFirstAsync<{ count: number }>('SELECT count(*) AS count FROM Account'))?.count, 0);
  assert.deepEqual(await database.getAllAsync('SELECT * FROM PreferencesPortable'), original);
  calls = 0;
  await loadFixture(database, data);
  assert.ok(calls < 600, 'Full fixture uses bounded batches rather than one call per row');
  await initializeDatabase(database, async () => undefined);
  await database.closeAsync();
});

test('portable schema loads full golden finance/history/receipts and PERF-01 counts with valid foreign keys', async () => {
  const golden = JSON.parse(readFileSync(new URL('../documentation/fixtures/backup-v6/golden-history.json', import.meta.url), 'utf8')) as { data: PortableData };
  for (const data of [golden.data, generatePerfFixture().data]) {
    const database = new TestDatabase();
    await migrate(database);
    await loadFixture(database, data);
    await initializeDatabase(database, async () => undefined);
    for (const [table, rows] of Object.entries(data)) assert.equal((await database.getFirstAsync<{ count: number }>(`SELECT count(*) AS count FROM "${table}"`))?.count, rows.length, table);
    const receipts = await database.getAllAsync<Record<string, unknown>>('SELECT * FROM WriteReceipt ORDER BY operationToken');
    assert.deepEqual(receipts.map(row => ({ ...row })), [...data.WriteReceipt].sort((a, b) => a.operationToken.localeCompare(b.operationToken)));
    for (const [table, expected] of Object.entries(data)) {
      const actual = await database.getAllAsync<Record<string, unknown>>(`SELECT * FROM "${table}"`);
      const projected = actual.map(row => Object.fromEntries(Object.entries(row).filter(([key]) => !['singleton', 'payloadAccountId', 'payloadCategoryId', 'snapshotAccountId', 'snapshotCategoryId'].includes(key)).map(([key, value]) => [key,
        ['isArchived', 'notesVisibleInList', 'isPaused'].includes(key) ? Boolean(value)
          : ['payload', 'payloadSnapshot', 'originScheduleSnapshot'].includes(key) && typeof value === 'string' ? JSON.parse(value) : value,
      ])));
      const identity = (row: Record<string, unknown>) => String(row.id ?? row.operationToken ?? 'preferences');
      assert.deepEqual(projected.sort((a, b) => identity(a).localeCompare(identity(b))), [...expected].sort((a, b) => identity(a).localeCompare(identity(b))), `${table} exact finance/history/receipt meaning`);
    }
    if (data === golden.data) {
      const refund = data.Transaction.find(row => row.expenseEffect === 'refund');
      assert.ok(refund);
      await assert.rejects(database.runAsync('UPDATE "Transaction" SET type=\'income\',expenseEffect=NULL WHERE id=?', refund.id));
      const revision = data.RecurringRuleRevision[0];
      assert.ok(revision);
      await assert.rejects(database.runAsync('INSERT INTO RecurringRuleRevision(id,ruleId,revisionSequence,effectiveFromDate,payload,payloadAccountId,payloadCategoryId,createdAtUtc) VALUES(?,?,?,?,?,?,?,?)',
        '99000000-0000-4000-8000-000000000000', revision.ruleId, 99, revision.effectiveFromDate, '{}', revision.payload.accountId, revision.payload.categoryId, revision.createdAtUtc));
    }
    await database.closeAsync();
  }
});

test('synthetic-only multi-step source1→target3 migrates atomically; every step fault preserves original history', async () => {
  const steps: Migration[] = [
    { from: 1, to: 2, recognizes: async database => (await database.getAllAsync("SELECT name FROM sqlite_master WHERE name='SyntheticHistory'")).length === 1, apply: database => database.execAsync("ALTER TABLE SyntheticHistory ADD COLUMN receipt TEXT; UPDATE SyntheticHistory SET receipt='retained-receipt'") },
    { from: 2, to: 3, recognizes: async database => (await database.getAllAsync<{ name: string }>('PRAGMA table_info(SyntheticHistory)')).some(row => row.name === 'receipt'), apply: database => database.execAsync('CREATE INDEX SyntheticHistory_receipt ON SyntheticHistory(receipt)') },
  ];
  for (const point of ['migration:1:2:after-step', 'migration:2:3:after-step', 'migration:before-commit', 'no-fault']) {
    const database = new TestDatabase();
    await database.execAsync("CREATE TABLE SyntheticHistory(amount INTEGER,accountingDate TEXT);INSERT INTO SyntheticHistory VALUES(-101,'2024-02-29');PRAGMA user_version=1;");
    if (point === 'no-fault') {
      await runMigrationChain(database, 3, steps, () => undefined);
      assert.deepEqual({ ...await database.getFirstAsync<Record<string, unknown>>('SELECT * FROM SyntheticHistory') }, { amount: -101, accountingDate: '2024-02-29', receipt: 'retained-receipt' });
      assert.equal((await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 3);
    } else {
      await assert.rejects(runMigrationChain(database, 3, steps, failAt(point)), { code: 'INJECTED_FAILURE' });
      assert.deepEqual({ ...await database.getFirstAsync<Record<string, unknown>>('SELECT * FROM SyntheticHistory') }, { amount: -101, accountingDate: '2024-02-29' });
      assert.equal((await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 1);
    }
    await database.closeAsync();
  }
});
