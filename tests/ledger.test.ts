import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TestDatabase } from './helpers/sqlite.ts';
import { migrate } from '../src/db/migrations/index.ts';
import { DatabaseCoordinator } from '../src/db/coordinator.ts';
import { LedgerRepository, type PageCursor, type TransactionInput } from '../src/repositories/ledger.ts';
import { seedFirstLedger } from '../src/repositories/seed.ts';
import { AppError } from '../src/domain/errors.ts';
import { formatMoney } from '../src/domain/money.ts';
import { loadFixture } from './fixtures/load.ts';
import { generatePerfFixture } from './fixtures/perf.ts';
import type { FaultPoint } from '../src/db/migrations/index.ts';
import { captureCreationMetadata } from '../src/domain/dates.ts';
import { canonicalJson, type CanonicalValue } from '../src/domain/canonical.ts';
import type { Transaction } from '../src/domain/portable.ts';

const stamp = '2026-11-02T00:00:00.000Z';
async function setup(options: { path?: string; fault?: FaultPoint; seed?: boolean } = {}) {
  const database = new TestDatabase(options.path);
  await migrate(database);
  const coordinator = new DatabaseCoordinator(database);
  if (options.seed !== false) await seedFirstLedger(coordinator, randomUUID, () => stamp);
  const repo = new LedgerRepository(coordinator, { now: () => stamp, fault: options.fault });
  const accountId = randomUUID();
  const accountInput = { name: 'Cash', icon: 'cash', openingExpression: '0', decimalSeparator: '.', expectedUpdatedAtUtc: null };
  await repo.saveAccount(randomUUID(), accountId, accountInput);
  const categories = await repo.categories();
  const expense = categories.find(row => row.type === 'expense'); const income = categories.find(row => row.type === 'income');
  assert.ok(expense && income);
  const input = (changes: Partial<TransactionInput> = {}): TransactionInput => ({ type: 'expense', amountExpression: '12.34', decimalSeparator: '.', accountId, categoryId: expense.id, toAccountId: null, accountingDate: '2026-11-02', localTime: null, timeZoneId: 'Asia/Manila', chosenOffsetMinutes: null, note: 'A private note', correctDate: false, expectedUpdatedAtUtc: null,
    retained: null, creationMetadata: captureCreationMetadata(stamp, changes.timeZoneId ?? 'Asia/Manila'), ...changes });
  return { database, coordinator, repo, accountId, accountInput, expense, income, input };
}
async function snapshot(database: TestDatabase) {
  const tables = ['Account', 'Category', 'Transaction', 'WriteReceipt', 'PreferencesPortable', 'Budget', 'RecurringRuleRevision', 'RecurringOccurrenceLedger'];
  return Promise.all(tables.map(table => database.getAllAsync(`SELECT * FROM "${table}" ORDER BY rowid`)));
}

test('TC-15/114: exact seven seeds and their receipts commit once; deleting every seed never reseeds', async () => {
  const database = new TestDatabase(); await migrate(database); const db = new DatabaseCoordinator(database);
  await Promise.all([seedFirstLedger(db, randomUUID, () => stamp), seedFirstLedger(db, randomUUID, () => stamp)]);
  const repo = new LedgerRepository(db); const categories = await repo.categories();
  assert.deepEqual(categories.map(({ type, name, icon }) => ({ type, name, icon })).sort((a, b) => a.name.localeCompare(b.name)), [
    { type: 'expense', name: 'Food', icon: 'food' }, { type: 'expense', name: 'Transport', icon: 'transport' },
    { type: 'expense', name: 'Bills', icon: 'bills' }, { type: 'expense', name: 'Shopping', icon: 'shopping' },
    { type: 'expense', name: 'Health', icon: 'health' }, { type: 'expense', name: 'Other', icon: 'other' },
    { type: 'income', name: 'Salary', icon: 'salary' },
  ].sort((a, b) => a.name.localeCompare(b.name)));
  assert.equal(categories.length, 7); assert.equal(new Set(categories.map(row => row.id)).size, 7);
  for (const row of categories) await repo.lifecycle(randomUUID(), 'category', row.id, 'delete', row.updatedAtUtc);
  await seedFirstLedger(db, randomUUID, () => stamp);
  assert.equal((await repo.categories()).length, 0);
  assert.equal((await database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM WriteReceipt'))?.count, 14);
  await database.closeAsync();
});

test('TC-01: Income and Expense appear once and have exact matching account effects', async () => {
  const { database, repo, input, accountId, income } = await setup();
  await repo.saveTransaction(randomUUID(), randomUUID(), input());
  await repo.saveTransaction(randomUUID(), randomUUID(), input({ type: 'income', categoryId: income.id, amountExpression: '50' }));
  assert.equal((await repo.accounts()).find(row => row.id === accountId)?.balanceMinor, 3766n);
  assert.equal((await repo.page('2026-11')).rows.length, 2);
  assert.deepEqual(await repo.summary('2026-11'), { incomeMinor: 5000n, expenseMinor: 1234n, days: { '2026-11-02': 3766n } });
  const before = await snapshot(database);
  await assert.rejects(repo.saveTransaction(randomUUID(), randomUUID(), input({ type: 'income' })), { code: 'MATCHING_CATEGORY_REQUIRED' });
  assert.deepEqual(await snapshot(database), before); await database.closeAsync();
});

test('TC-02/03: Transfer is symmetric, excluded from totals, invalid targets leave the whole DB unchanged', async () => {
  const { database, repo, input, accountId, accountInput } = await setup(); const target = randomUUID();
  await repo.saveAccount(randomUUID(), target, { ...accountInput, name: 'Bank' });
  await repo.saveTransaction(randomUUID(), randomUUID(), input({ type: 'transfer', categoryId: null, toAccountId: target, amountExpression: '1000' }));
  const accounts = await repo.accounts();
  assert.equal(accounts.find(row => row.id === accountId)?.balanceMinor, -100000n); assert.equal(accounts.find(row => row.id === target)?.balanceMinor, 100000n);
  assert.deepEqual(await repo.summary('2026-11'), { incomeMinor: 0n, expenseMinor: 0n, days: {} });
  const row = accounts.find(row => row.id === target); assert.ok(row);
  await repo.lifecycle(randomUUID(), 'account', target, 'archive', row.updatedAtUtc);
  for (const toAccountId of [accountId, null, target, randomUUID()]) {
    const before = await snapshot(database);
    await assert.rejects(repo.saveTransaction(randomUUID(), randomUUID(), input({ type: 'transfer', categoryId: null, toAccountId })), AppError);
    assert.deepEqual(await snapshot(database), before);
  }
  await database.closeAsync();
});

test('TC-04: midnight, DST gap/fold, noon and explicit corrections preserve accounting and creation metadata', async () => {
  const { database, repo, input } = await setup();
  for (const [date, localTime, zone, offset, instant] of [
    ['2026-11-02', '00:01', 'Asia/Manila', null, '2026-11-01T16:01:00.000Z'],
    ['2026-11-01', '01:30', 'America/New_York', -300, '2026-11-01T06:30:00.000Z'],
    ['2026-11-01', '01:30', 'America/New_York', -240, '2026-11-01T05:30:00.000Z'],
    ['2026-11-02', null, 'Asia/Manila', null, '2026-11-02T04:00:00.000Z'],
  ] as const) {
    const id = randomUUID();
    await repo.saveTransaction(randomUUID(), id, input({ accountingDate: date, localTime, timeZoneId: zone, chosenOffsetMinutes: offset }));
    const old = await repo.transaction(id); assert.ok(old); assert.equal(old.accountingDate, date); assert.equal(old.occurredAtUtc, instant);
    await repo.saveTransaction(randomUUID(), id, input({ accountingDate: '2026-10-31', localTime: '23:59', correctDate: true, expectedUpdatedAtUtc: old.updatedAtUtc, retained: old,
      creationMetadata: { createdAtUtc: old.createdAtUtc, createdTimeZoneId: old.createdTimeZoneId, createdUtcOffsetMinutes: old.createdUtcOffsetMinutes } }), true);
    const next = await repo.transaction(id); assert.ok(next); assert.equal(next.accountingDate, '2026-10-31'); assert.equal(next.createdAtUtc, old.createdAtUtc); assert.equal(next.createdTimeZoneId, old.createdTimeZoneId); assert.equal(next.createdUtcOffsetMinutes, old.createdUtcOffsetMinutes);
  }
  for (const [date, code] of [['2026-03-08', 'NONEXISTENT_LOCAL_TIME'], ['2026-11-01', 'AMBIGUOUS_LOCAL_TIME']] as const) {
    const before = await snapshot(database);
    await assert.rejects(repo.saveTransaction(randomUUID(), randomUUID(), input({ accountingDate: date, localTime: date.endsWith('08') ? '02:30' : '01:30', timeZoneId: 'America/New_York' })), { code });
    assert.deepEqual(await snapshot(database), before);
  }
  assert.equal((await repo.page('2026-10')).rows.length, 4); await database.closeAsync();
});

test('TC-05/08/114: archive/restore hides active targets, keeps exact history, immutable type and name edits', async () => {
  const { database, repo, input, expense, accountId } = await setup(); const id = randomUUID();
  await repo.saveTransaction(randomUUID(), id, input()); const totals = await repo.summary('2026-11'); const balance = (await repo.accounts())[0]?.balanceMinor;
  await repo.lifecycle(randomUUID(), 'category', expense.id, 'archive', expense.updatedAtUtc);
  const account = (await repo.accounts()).find(row => row.id === accountId); assert.ok(account);
  await repo.lifecycle(randomUUID(), 'account', accountId, 'archive', account.updatedAtUtc);
  assert.equal((await repo.categories(true)).some(row => row.id === expense.id), false); assert.equal((await repo.accounts(true)).some(row => row.id === accountId), false);
  assert.equal((await repo.page('2026-11')).rows[0]?.categoryName, expense.name); assert.deepEqual(await repo.summary('2026-11'), totals); assert.equal((await repo.accounts())[0]?.balanceMinor, balance);
  const old = await repo.transaction(id); assert.ok(old);
  await repo.saveTransaction(randomUUID(), id, input({ amountExpression: '1', expectedUpdatedAtUtc: old.updatedAtUtc, retained: old }), true);
  const category = (await repo.categories()).find(row => row.id === expense.id); assert.ok(category);
  await repo.lifecycle(randomUUID(), 'category', expense.id, 'restore', category.updatedAtUtc);
  const restored = (await repo.categories()).find(row => row.id === expense.id); assert.ok(restored);
  await repo.saveCategory(randomUUID(), expense.id, { name: 'Meals', icon: 'coffee', type: 'expense', expectedUpdatedAtUtc: restored.updatedAtUtc }, true);
  assert.equal((await repo.transaction(id))?.categoryName, 'Meals'); assert.equal((await repo.summary('2026-11')).expenseMinor, 100n);
  const updated = (await repo.categories()).find(row => row.id === expense.id); assert.ok(updated);
  const before = await snapshot(database);
  await assert.rejects(repo.saveCategory(randomUUID(), expense.id, { name: 'Meals', icon: 'coffee', type: 'income', expectedUpdatedAtUtc: updated.updatedAtUtc }, true), { code: 'CATEGORY_TYPE_FIXED' });
  assert.deepEqual(await snapshot(database), before);
  for (const kind of ['account', 'category'] as const) {
    const target = kind === 'account' ? (await repo.accounts()).find(row => row.id === accountId) : (await repo.categories()).find(row => row.id === expense.id); assert.ok(target);
    await assert.rejects(repo.lifecycle(randomUUID(), kind, target.id, 'delete', target.updatedAtUtc), { code: 'ENTITY_REFERENCED' });
  }
  const archived = (await repo.accounts()).find(row => row.id === accountId); assert.ok(archived);
  const archivedBalance = archived.balanceMinor;
  await repo.lifecycle(randomUUID(), 'account', accountId, 'restore', archived.updatedAtUtc);
  assert.equal((await repo.accounts(true)).find(row => row.id === accountId)?.balanceMinor, archivedBalance);
  await database.closeAsync();
});

test('TC-07/29/79: every financial write checkpoint rolls back Transfer edit/delete and receipts', async () => {
  for (const action of ['edit', 'delete'] as const) for (const targetPoint of ['ledger:after-receipt', 'ledger:before-transaction', 'ledger:after-transaction', 'ledger:before-commit']) {
    let enabled = false;
    const { database, repo, input, accountInput } = await setup({ fault: point => { if (enabled && point === targetPoint) throw new Error('SQLITE_FULL'); } });
    const b = randomUUID(), c = randomUUID(), id = randomUUID(); await repo.saveAccount(randomUUID(), b, accountInput); await repo.saveAccount(randomUUID(), c, accountInput);
    await repo.saveTransaction(randomUUID(), id, input({ type: 'transfer', categoryId: null, toAccountId: b })); const row = await repo.transaction(id); assert.ok(row);
    const before = await snapshot(database); const balances = await repo.accounts(); enabled = true;
    await assert.rejects(action === 'edit' ? repo.saveTransaction(randomUUID(), id, input({ type: 'transfer', categoryId: null, toAccountId: c, amountExpression: '20', expectedUpdatedAtUtc: row.updatedAtUtc, retained: row }), true)
      : repo.deleteTransaction(randomUUID(), id, row.updatedAtUtc), { code: 'INSUFFICIENT_STORAGE' });
    assert.deepEqual(await snapshot(database), before); assert.deepEqual(await repo.accounts(), balances); enabled = false;
    if (action === 'edit') { await repo.saveTransaction(randomUUID(), id, input({ type: 'transfer', categoryId: null, toAccountId: c, amountExpression: '20', expectedUpdatedAtUtc: row.updatedAtUtc, retained: row }), true); assert.equal((await repo.accounts()).find(a => a.id === b)?.balanceMinor, 0n); assert.equal((await repo.accounts()).find(a => a.id === c)?.balanceMinor, 2000n); }
    else { await repo.deleteTransaction(randomUUID(), id, row.updatedAtUtc); assert.equal((await repo.accounts()).every(a => a.balanceMinor === 0n), true); }
    await database.closeAsync();
  }
});

test('TC-28/79: double Save, failed-create rollback, conflict and replay before validation after deletion/restart', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'kwartracker-ledger-')); const path = join(directory, 'ledger.db');
  const { database, coordinator, repo, input } = await setup({ path }); const token = randomUUID(), id = randomUUID(), command = input();
  const [first, second] = await Promise.all([repo.saveTransaction(token, id, command), repo.saveTransaction(token, id, command)]); assert.deepEqual(second, first);
  assert.equal((await repo.page('2026-11')).rows.length, 1); await assert.rejects(repo.saveTransaction(token, id, { ...command, note: 'different' }), { code: 'IDEMPOTENCY_CONFLICT' });
  const old = await repo.transaction(id); assert.ok(old); await repo.deleteTransaction(randomUUID(), id, old.updatedAtUtc);
  assert.deepEqual(await repo.saveTransaction(token, id, command), first);
  const before = await snapshot(database);
  const failing = new LedgerRepository(coordinator, { fault: point => { if (point === 'ledger:after-transaction') throw new Error('SQLITE_FULL'); } });
  await assert.rejects(failing.saveTransaction(randomUUID(), randomUUID(), command), { code: 'INSUFFICIENT_STORAGE' }); assert.deepEqual(await snapshot(database), before);
  await database.closeAsync(); const reopened = new TestDatabase(path);
  assert.deepEqual(await new LedgerRepository(new DatabaseCoordinator(reopened)).saveTransaction(token, id, command), first);
  assert.equal((await reopened.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM "Transaction"'))?.count, 0);
  await reopened.closeAsync(); rmSync(directory, { recursive: true });
});

test('TC-13/39: persisted preferences apply 2→0→2 without rewriting any stored finance', async () => {
  const { database, repo, input } = await setup(); await repo.saveTransaction(randomUUID(), randomUUID(), input());
  const rows = await database.getAllAsync('SELECT * FROM "Transaction"');
  const original = await repo.preferences();
  for (const [displayDecimalPlaces, output] of [[2, '₱12.34'], [0, '₱12'], [2, '₱12.34']] as const) {
    await repo.savePreferences(randomUUID(), randomUUID(), { ...original, displayDecimalPlaces, uiMode: 'dark', notesVisibleInList: false });
    const saved = await repo.preferences(); assert.equal(saved.uiMode, 'dark'); assert.equal(saved.notesVisibleInList, false); assert.equal(formatMoney(1234n, saved), output);
    assert.deepEqual(await database.getAllAsync('SELECT * FROM "Transaction"'), rows);
  }
  const before = await snapshot(database);
  await assert.rejects(repo.savePreferences(randomUUID(), randomUUID(), { ...original, currencySign: '' }), { code: 'INVALID_COMMAND' }); assert.deepEqual(await snapshot(database), before); await database.closeAsync();
});

test('TC-79: actual SQLite page exhaustion rolls back the receipt and row; the same draft succeeds after space is available', async () => {
  const { database, repo, input } = await setup();
  const pages = await database.getFirstAsync<{ page_count: number }>('PRAGMA page_count'); assert.ok(pages);
  await database.execAsync(`PRAGMA max_page_count=${pages.page_count}`);
  const before = await snapshot(database); const id = randomUUID(), token = randomUUID(); const command = input({ note: 'x'.repeat(4000) });
  await assert.rejects(repo.saveTransaction(token, id, command), { code: 'INSUFFICIENT_STORAGE' });
  assert.deepEqual(await snapshot(database), before);
  await database.execAsync(`PRAGMA max_page_count=${pages.page_count + 32}`);
  await repo.saveTransaction(token, id, command); assert.equal((await repo.transaction(id))?.note?.length, 4000); await database.closeAsync();
});

test('TC-30/39/113: write-boundary rounding, malformed expressions and signed opening endpoints', async () => {
  const { database, repo, input, accountInput, accountId } = await setup();
  for (const [expression, amount] of [['1.005', 101], ['1/3', 33], ['10000000000', 1000000000000]] as const) {
    const id = randomUUID(); await repo.saveTransaction(randomUUID(), id, input({ amountExpression: expression })); assert.equal((await repo.transaction(id))?.amountMinor, amount);
  }
  for (const amountExpression of ['0.004', '-1', '1−2', '1/0', '1..2', '()', '1e3', '10000000000.005', '1 2']) {
    const before = await snapshot(database); await assert.rejects(repo.saveTransaction(randomUUID(), randomUUID(), input({ amountExpression })), AppError); assert.deepEqual(await snapshot(database), before);
  }
  for (const [openingExpression, expected] of [['0', 0], ['-1.005', -101], ['-10000000000', -1000000000000], ['10000000000', 1000000000000]] as const) {
    const old = (await repo.accounts()).find(row => row.id === accountId); assert.ok(old);
    await repo.saveAccount(randomUUID(), accountId, { ...accountInput, openingExpression, expectedUpdatedAtUtc: old.updatedAtUtc }, true); assert.equal((await repo.accounts()).find(row => row.id === accountId)?.openingBalanceMinor, expected);
  }
  const old = (await repo.accounts()).find(row => row.id === accountId); assert.ok(old); await assert.rejects(repo.saveAccount(randomUUID(), accountId, { ...accountInput, openingExpression: '-10000000000.005', expectedUpdatedAtUtc: old.updatedAtUtc }, true), { code: 'AMOUNT_OUT_OF_RANGE' }); await database.closeAsync();
});

test('TC-105/113: real PERF-01 paging, concurrent changes, exact aggregate query and balances beyond 2^53', async () => {
  const fixture = generatePerfFixture(); const database = new TestDatabase(); await migrate(database); await loadFixture(database, fixture.data);
  const repo = new LedgerRepository(new DatabaseCoordinator(database)); assert.equal((await repo.accounts()).length, 500); assert.equal((await repo.categories()).length, 200);
  // Per-transaction reference for the SQL per-account sums: every leg, sign and opening balance exact.
  const [transferRow, refundRow, refundTarget] = fixture.data.Transaction.filter(row => row.type === 'expense'); assert.ok(transferRow && refundRow && refundTarget);
  await database.runAsync('UPDATE "Transaction" SET type=\'transfer\',expenseEffect=NULL,categoryId=NULL,toAccountId=? WHERE id=?', fixture.data.Account.find(row => row.id !== transferRow.accountId)?.id ?? '', transferRow.id);
  await database.runAsync('UPDATE "Transaction" SET expenseEffect=\'refund\',refundOfTransactionId=? WHERE id=?', refundTarget.id, refundRow.id);
  const reference = new Map(fixture.data.Account.map(row => [row.id, BigInt(row.openingBalanceMinor)]));
  for (const row of await database.getAllAsync<{ type: string; expenseEffect: string | null; accountId: string; toAccountId: string | null; amountMinor: number }>('SELECT type,expenseEffect,accountId,toAccountId,amountMinor FROM "Transaction"')) {
    const amount = BigInt(row.amountMinor), add = (id: string, value: bigint) => reference.set(id, (reference.get(id) ?? 0n) + value);
    if (row.type === 'transfer') { add(row.accountId, -amount); if (row.toAccountId) add(row.toAccountId, amount); }
    else add(row.accountId, row.type === 'income' || row.expenseEffect === 'refund' ? amount : -amount);
  }
  assert.deepEqual(new Map((await repo.accounts()).map(row => [row.id, row.balanceMinor])), reference);
  const first = await repo.page('2025-12'); assert.equal(first.rows.length, 50); assert.ok(first.next);
  const expected = fixture.data.Transaction.filter(row => row.accountingDate.startsWith('2025-12')).sort((a, b) => b.accountingDate.localeCompare(a.accountingDate) || b.occurredAtUtc.localeCompare(a.occurredAtUtc) || b.id.localeCompare(a.id));
  const actual = [...first.rows]; let cursor: PageCursor | null = first.next; let pages = 1;
  while (cursor) { assert.ok(pages++ <= Math.ceil(expected.length / 50)); const page = await repo.page('2025-12', cursor); actual.push(...page.rows); cursor = page.next; }
  assert.deepEqual(actual.map(row => row.id), expected.map(row => row.id));
  const boundary = first.rows.at(-1); assert.ok(boundary); await database.runAsync('DELETE FROM "Transaction" WHERE id=?', boundary.id);
  const next = await repo.page('2025-12', first.next); assert.deepEqual(next.rows.map(row => row.id), expected.slice(50, 100).map(row => row.id));
  const newId = randomUUID(), operationToken = randomUUID(), template = fixture.data.Transaction[0]; assert.ok(template);
  const activeAccount = fixture.data.Account.find(row => !row.isArchived); const activeCategory = fixture.data.Category.find(row => row.type === 'income' && !row.isArchived); assert.ok(activeAccount && activeCategory);
  await repo.saveTransaction(operationToken, newId, { type: 'income', amountExpression: '1', decimalSeparator: '.', accountId: activeAccount.id, categoryId: activeCategory.id, toAccountId: null, accountingDate: '2025-12-31', localTime: null, timeZoneId: 'Asia/Manila', chosenOffsetMinutes: null, note: null, correctDate: false, expectedUpdatedAtUtc: null, creationMetadata: captureCreationMetadata(stamp, 'Asia/Manila'), retained: null });
  const refreshed = await repo.page('2025-12'); assert.equal(refreshed.rows[0]?.id, newId); assert.equal(new Set(refreshed.rows.map(row => row.id)).size, 50);
  await database.runAsync('UPDATE "Transaction" SET type=\'income\',expenseEffect=NULL,refundOfTransactionId=NULL,toAccountId=NULL,categoryId=?,accountId=?,amountMinor=1000000000000,accountingDate=\'2025-12-15\'', activeCategory.id, activeAccount.id);
  const summary = await repo.summary('2025-12'); assert.equal(summary.incomeMinor, 10000000000000000n); assert.equal(summary.expenseMinor, 0n);
  assert.equal((await repo.accounts()).find(row => row.id === activeAccount.id)?.balanceMinor, 10000000000050000n);
  assert.equal(formatMoney(summary.incomeMinor, await repo.preferences()), '₱100000000000000.00'); await database.closeAsync();
});

test('stale edits/deletes never overwrite newer data and receipt replay still succeeds', async () => {
  const { database, repo, input } = await setup(); const id = randomUUID(); await repo.saveTransaction(randomUUID(), id, input()); const old = await repo.transaction(id); assert.ok(old);
  const token = randomUUID(); const changed = input({ note: 'first edit', expectedUpdatedAtUtc: old.updatedAtUtc, retained: old }); const result = await repo.saveTransaction(token, id, changed, true);
  const before = await snapshot(database); await assert.rejects(repo.saveTransaction(randomUUID(), id, input({ note: 'stale edit', expectedUpdatedAtUtc: old.updatedAtUtc, retained: old }), true), { code: 'STALE_WRITE' }); await assert.rejects(repo.deleteTransaction(randomUUID(), id, old.updatedAtUtc), { code: 'STALE_WRITE' }); assert.deepEqual(await snapshot(database), before); assert.deepEqual(await repo.saveTransaction(token, id, changed, true), result); await database.closeAsync();
});

test('TC-101 repository leg: latest confirmed type uses commit order when creation timestamps tie', async () => {
  const { database, repo, input, income } = await setup(); assert.equal(await repo.latestType(), 'expense');
  await repo.saveTransaction(randomUUID(), randomUUID(), input({ type: 'income', categoryId: income.id })); assert.equal(await repo.latestType(), 'income');
  await repo.saveTransaction(randomUUID(), randomUUID(), input()); assert.equal(await repo.latestType(), 'expense'); await database.closeAsync();
});

test('first-launch failure never leaves a partial seed or receipt batch', async () => {
  for (let checkpoint = 1; checkpoint <= 14; checkpoint++) {
    const database = new TestDatabase(); await migrate(database); const coordinator = new DatabaseCoordinator(database);
    const before = await snapshot(database); const original = database.runAsync.bind(database); let writes = 0;
    database.runAsync = async (sql, ...params) => { const result = await original(sql, ...params); if (++writes === checkpoint) throw new Error('SQLITE_FULL'); return result; };
    await assert.rejects(seedFirstLedger(coordinator, randomUUID), { code: 'INSUFFICIENT_STORAGE' }); assert.deepEqual(await snapshot(database), before);
    database.runAsync = original; await seedFirstLedger(coordinator, randomUUID); assert.equal((await new LedgerRepository(coordinator).categories()).length, 7); await database.closeAsync();
  }
});

test('v6 receipt v1: hashes use exactly normalized schema fields; lifecycle uses {id}; equivalent arithmetic replays', async () => {
  const { database, repo, input, accountId, accountInput, expense } = await setup();
  async function check(operation: string, entityType: string, entityId: string, fields: CanonicalValue, token?: string) {
    const receipt = await database.getFirstAsync<{ requestHash: string }>(`SELECT requestHash FROM WriteReceipt WHERE operation=? AND entityType=? AND entityId=? ${token ? 'AND operationToken=?' : ''} ORDER BY rowid DESC LIMIT 1`, operation, entityType, entityId, ...(token ? [token] : []));
    assert.ok(receipt);
    assert.equal(receipt.requestHash, createHash('sha256').update(canonicalJson({ operation, entityType, entityId, input: fields })).digest('hex'));
  }
  await check('create', 'account', accountId, { id: accountId, name: 'Cash', icon: 'cash', openingBalanceMinor: 0, isArchived: false });
  await check('create', 'category', expense.id, { id: expense.id, name: expense.name, icon: expense.icon, type: expense.type, isArchived: false });
  const id = randomUUID(), token = randomUUID(), command = input();
  const first = await repo.saveTransaction(token, id, command);
  async function transactionFields() {
    const row = await database.getFirstAsync<Transaction>('SELECT * FROM "Transaction" WHERE id=?', id); assert.ok(row);
    const { createdAtUtc: _created, updatedAtUtc: _updated, ...fields } = row;
    return fields;
  }
  await check('create', 'transaction', id, { ...await transactionFields() }, token);
  assert.deepEqual(await repo.saveTransaction(token, id, { ...command, amountExpression: '12+0.34' }), first);
  const old = await repo.transaction(id); assert.ok(old);
  const editToken = randomUUID(), edit = input({ amountExpression: '6/3', retained: old, expectedUpdatedAtUtc: old.updatedAtUtc });
  const edited = await repo.saveTransaction(editToken, id, edit, true);
  await check('edit', 'transaction', id, { ...await transactionFields() }, editToken);
  assert.deepEqual(await repo.saveTransaction(editToken, id, { ...edit, amountExpression: '2.000' }, true), edited);
  const account = (await repo.accounts()).find(row => row.id === accountId); assert.ok(account);
  await repo.saveAccount(randomUUID(), accountId, { ...accountInput, openingExpression: '-1.005', expectedUpdatedAtUtc: account.updatedAtUtc }, true);
  await check('edit', 'account', accountId, { id: accountId, name: 'Cash', icon: 'cash', openingBalanceMinor: -101, isArchived: false });
  const prefs = await repo.preferences(), prefsId = randomUUID(); await repo.savePreferences(randomUUID(), prefsId, prefs); await check('edit', 'preferences', prefsId, { ...prefs });
  await repo.lifecycle(randomUUID(), 'category', expense.id, 'archive', expense.updatedAtUtc); await check('archive', 'category', expense.id, { id: expense.id });
  const latest = await repo.transaction(id); assert.ok(latest); await repo.deleteTransaction(randomUUID(), id, latest.updatedAtUtc); await check('delete', 'transaction', id, { id });
  await database.closeAsync();
});
