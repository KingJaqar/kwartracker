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
import { budgetStatus, chartShares, shareLabel } from '../src/domain/reports.ts';
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
    retained: null, refundOfTransactionId: null, creationMetadata: captureCreationMetadata(stamp, changes.timeZoneId ?? 'Asia/Manila'), ...changes });
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
  await repo.saveTransaction(operationToken, newId, { type: 'income', amountExpression: '1', decimalSeparator: '.', accountId: activeAccount.id, categoryId: activeCategory.id, toAccountId: null, accountingDate: '2025-12-31', localTime: null, timeZoneId: 'Asia/Manila', chosenOffsetMinutes: null, note: null, correctDate: false, expectedUpdatedAtUtc: null, refundOfTransactionId: null, creationMetadata: captureCreationMetadata(stamp, 'Asia/Manila'), retained: null });
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

// ---- Phase 2: linked Expense refunds (BR-23), Budgets (FR-BUD) and Analysis (FR-ANA) ----

async function purchaseWithRefunds(options: { fault?: FaultPoint; path?: string } = {}) {
  const context = await setup(options);
  const purchaseId = randomUUID();
  await context.repo.saveTransaction(randomUUID(), purchaseId, context.input({ amountExpression: '100', note: null }));
  const refund = (changes: Partial<TransactionInput> = {}) => context.input({ refundOfTransactionId: purchaseId, note: null, ...changes });
  return { ...context, purchaseId, refund };
}

test('FR-TRN acceptance/TC-84: ₱100 purchase, ₱30 + ₱70 refunds leave ₱0 cost; a further refund and every invalid link are rejected without writing', async () => {
  const { database, repo, accountId, expense, income, purchaseId, refund, input } = await purchaseWithRefunds();
  const first = randomUUID(), second = randomUUID();
  await repo.saveTransaction(randomUUID(), first, refund({ amountExpression: '30' }));
  await repo.saveTransaction(randomUUID(), second, refund({ amountExpression: '70' }));
  assert.equal((await repo.accounts()).find(row => row.id === accountId)?.balanceMinor, 0n);
  const summary = await repo.summary('2026-11'); assert.equal(summary.expenseMinor, 0n); assert.equal(summary.incomeMinor, 0n);
  assert.deepEqual(await repo.refundStatus(purchaseId), { purchaseMinor: 10000n, refundedMinor: 10000n });
  const stored = await repo.transaction(first);
  assert.equal(stored?.expenseEffect, 'refund'); assert.equal(stored?.refundOfTransactionId, purchaseId); assert.equal(stored?.categoryId, expense.id);
  const before = await snapshot(database);
  await assert.rejects(repo.saveTransaction(randomUUID(), randomUUID(), refund({ amountExpression: '0.01' })), { code: 'REFUND_EXCEEDS_PURCHASE' });
  await assert.rejects(repo.saveTransaction(randomUUID(), randomUUID(), refund({ amountExpression: '0' })), { code: 'INVALID_AMOUNT' });
  await assert.rejects(repo.saveTransaction(randomUUID(), randomUUID(), refund({ amountExpression: '-1' })), { code: 'INVALID_AMOUNT' });
  // Category must be the purchase's; a refund needs a purchase original; rules for type/target shape apply.
  const other = (await repo.categories()).find(row => row.type === 'expense' && row.id !== expense.id); assert.ok(other);
  await assert.rejects(repo.saveTransaction(randomUUID(), randomUUID(), refund({ amountExpression: '1', categoryId: other.id })), { code: 'REFUND_ORIGINAL_INVALID' });
  await assert.rejects(repo.saveTransaction(randomUUID(), randomUUID(), refund({ amountExpression: '1', refundOfTransactionId: first })), { code: 'REFUND_ORIGINAL_INVALID' });
  await assert.rejects(repo.saveTransaction(randomUUID(), randomUUID(), refund({ amountExpression: '1', refundOfTransactionId: randomUUID() })), { code: 'REFUND_ORIGINAL_INVALID' });
  await assert.rejects(repo.saveTransaction(randomUUID(), randomUUID(), refund({ amountExpression: '1', type: 'income', categoryId: income.id })), { code: 'INVALID_COMMAND' });
  await assert.rejects(repo.saveTransaction(randomUUID(), randomUUID(), refund({ amountExpression: '1', type: 'transfer', categoryId: null, toAccountId: accountId })), { code: 'INVALID_COMMAND' });
  const salary = randomUUID(); const transfer = randomUUID();
  assert.deepEqual(await snapshot(database), before);
  await repo.saveTransaction(randomUUID(), salary, input({ type: 'income', categoryId: income.id, amountExpression: '5' }));
  const b = randomUUID(); await repo.saveAccount(randomUUID(), b, { name: 'Bank', icon: 'bank', openingExpression: '0', decimalSeparator: '.', expectedUpdatedAtUtc: null });
  await repo.saveTransaction(randomUUID(), transfer, input({ type: 'transfer', categoryId: null, toAccountId: b, amountExpression: '5' }));
  for (const target of [salary, transfer]) await assert.rejects(repo.saveTransaction(randomUUID(), randomUUID(), refund({ amountExpression: '1', refundOfTransactionId: target })), { code: 'REFUND_ORIGINAL_INVALID' });
  await database.closeAsync();
});

test('TC-84/41: refund edit/delete limits, purchase edit/delete guards and fixed links never change either row on rejection', async () => {
  const { database, repo, accountId, expense, income, purchaseId, refund, input } = await purchaseWithRefunds();
  const refundId = randomUUID();
  await repo.saveTransaction(randomUUID(), refundId, refund({ amountExpression: '40' }));
  const purchase = await repo.transaction(purchaseId); const saved = await repo.transaction(refundId); assert.ok(purchase && saved);
  const before = await snapshot(database);
  const purchaseEdit = (changes: Partial<TransactionInput>) => repo.saveTransaction(randomUUID(), purchaseId, input({ amountExpression: '100', note: null, expectedUpdatedAtUtc: purchase.updatedAtUtc, retained: purchase, ...changes }), true);
  const other = (await repo.categories()).find(row => row.type === 'expense' && row.id !== expense.id); assert.ok(other);
  await assert.rejects(purchaseEdit({ amountExpression: '39.99' }), { code: 'LINKED_REFUNDS' });
  await assert.rejects(purchaseEdit({ categoryId: other.id }), { code: 'LINKED_REFUNDS' });
  await assert.rejects(purchaseEdit({ type: 'income', categoryId: income.id }), { code: 'LINKED_REFUNDS' });
  await assert.rejects(purchaseEdit({ refundOfTransactionId: purchaseId }), { code: 'INVALID_COMMAND' });
  await assert.rejects(repo.deleteTransaction(randomUUID(), purchaseId, purchase.updatedAtUtc), { code: 'LINKED_REFUNDS' });
  const refundEdit = (changes: Partial<TransactionInput>) => repo.saveTransaction(randomUUID(), refundId, refund({ expectedUpdatedAtUtc: saved.updatedAtUtc, retained: saved, ...changes }), true);
  await assert.rejects(refundEdit({ amountExpression: '100.01' }), { code: 'REFUND_EXCEEDS_PURCHASE' });
  await assert.rejects(refundEdit({ amountExpression: '10', refundOfTransactionId: null }), { code: 'INVALID_COMMAND' });
  await assert.rejects(refundEdit({ amountExpression: '10', categoryId: other.id }), { code: 'REFUND_ORIGINAL_INVALID' });
  assert.deepEqual(await snapshot(database), before);
  // Exactly the purchase amount is allowed; the purchase may then be reduced to, but not below, the refunded total.
  await refundEdit({ amountExpression: '100', note: 'Full refund' });
  const full = await repo.transaction(refundId); assert.ok(full);
  assert.equal(full.amountMinor, 10000); assert.equal(full.note, 'Full refund'); assert.equal(full.createdAtUtc, saved.createdAtUtc); assert.equal(full.idempotencyToken, saved.idempotencyToken);
  assert.equal((await repo.accounts()).find(row => row.id === accountId)?.balanceMinor, 0n);
  await assert.rejects(purchaseEdit({ amountExpression: '99.99' }), { code: 'LINKED_REFUNDS' });
  // Deleting the refund reverses its effects and frees the whole amount again.
  await repo.deleteTransaction(randomUUID(), refundId, full.updatedAtUtc);
  assert.equal((await repo.accounts()).find(row => row.id === accountId)?.balanceMinor, -10000n);
  assert.deepEqual(await repo.refundStatus(purchaseId), { purchaseMinor: 10000n, refundedMinor: 0n });
  assert.equal((await repo.summary('2026-11')).expenseMinor, 10000n);
  await repo.saveTransaction(randomUUID(), randomUUID(), refund({ amountExpression: '100' }));
  await database.closeAsync();
});

test('TC-84 race: two final refunds through one writer and through two SQLite connections; exactly one commits', async () => {
  const { database, repo, purchaseId, refund } = await purchaseWithRefunds();
  await repo.saveTransaction(randomUUID(), randomUUID(), refund({ amountExpression: '30' }));
  const results = await Promise.allSettled([repo.saveTransaction(randomUUID(), randomUUID(), refund({ amountExpression: '70' })), repo.saveTransaction(randomUUID(), randomUUID(), refund({ amountExpression: '70' }))]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = results.find(result => result.status === 'rejected'); assert.ok(rejected?.status === 'rejected'); assert.equal(rejected.reason.code, 'REFUND_EXCEEDS_PURCHASE');
  assert.deepEqual(await repo.refundStatus(purchaseId), { purchaseMinor: 10000n, refundedMinor: 10000n });
  await database.closeAsync();

  const directory = mkdtempSync(join(tmpdir(), 'kwartracker-refund-race-')); const path = join(directory, 'ledger.db');
  const shared = await purchaseWithRefunds({ path });
  const second = new TestDatabase(path);
  const otherRepo = new LedgerRepository(new DatabaseCoordinator(second), { now: () => stamp });
  const races = await Promise.allSettled([shared.repo.saveTransaction(randomUUID(), randomUUID(), shared.refund({ amountExpression: '100' })), otherRepo.saveTransaction(randomUUID(), randomUUID(), shared.refund({ amountExpression: '100' }))]);
  assert.equal(races.filter(result => result.status === 'fulfilled').length, 1);
  const loser = races.find(result => result.status === 'rejected'); assert.ok(loser?.status === 'rejected'); assert.ok(['DATABASE_BUSY', 'REFUND_EXCEEDS_PURCHASE'].includes(loser.reason.code));
  // The losing writer can retry safely: capacity is now exhausted, so the guard rejects it.
  await assert.rejects(otherRepo.saveTransaction(randomUUID(), randomUUID(), shared.refund({ amountExpression: '100' })), { code: 'REFUND_EXCEEDS_PURCHASE' });
  assert.deepEqual(await shared.repo.refundStatus(shared.purchaseId), { purchaseMinor: 10000n, refundedMinor: 10000n });
  assert.equal((await shared.database.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM "Transaction" WHERE expenseEffect=\'refund\''))?.count, 1);
  second.raw.close(); await shared.database.closeAsync(); rmSync(directory, { recursive: true });
});

test('TC-41: every write checkpoint rolls back refund create, refund edit, refund delete and linked purchase edit', async () => {
  for (const action of ['create', 'edit', 'delete', 'purchase'] as const) for (const target of ['ledger:after-receipt', 'ledger:before-transaction', 'ledger:after-transaction', 'ledger:before-commit']) {
    let enabled = false;
    const { database, repo, purchaseId, refund, input } = await purchaseWithRefunds({ fault: point => { if (enabled && point === target) throw new Error('SQLITE_FULL'); } });
    const refundId = randomUUID(); await repo.saveTransaction(randomUUID(), refundId, refund({ amountExpression: '25' }));
    const row = await repo.transaction(refundId); const purchase = await repo.transaction(purchaseId); assert.ok(row && purchase);
    const before = await snapshot(database); const balances = await repo.accounts(); enabled = true;
    const attempt = action === 'create' ? repo.saveTransaction(randomUUID(), randomUUID(), refund({ amountExpression: '10' }))
      : action === 'edit' ? repo.saveTransaction(randomUUID(), refundId, refund({ amountExpression: '50', expectedUpdatedAtUtc: row.updatedAtUtc, retained: row }), true)
        : action === 'delete' ? repo.deleteTransaction(randomUUID(), refundId, row.updatedAtUtc)
          : repo.saveTransaction(randomUUID(), purchaseId, input({ amountExpression: '80', note: null, expectedUpdatedAtUtc: purchase.updatedAtUtc, retained: purchase }), true);
    await assert.rejects(attempt, { code: 'INSUFFICIENT_STORAGE' });
    assert.deepEqual(await snapshot(database), before); assert.deepEqual(await repo.accounts(), balances);
    await database.closeAsync();
  }
});

test('TC-83: refund to another active account in a later month moves the right account, month and Budget; Income never changes', async () => {
  const { database, repo, accountId, expense, purchaseId, refund } = await purchaseWithRefunds();
  const receiving = randomUUID(); await repo.saveAccount(randomUUID(), receiving, { name: 'Bank', icon: 'bank', openingExpression: '0', decimalSeparator: '.', expectedUpdatedAtUtc: null });
  await repo.saveBudget(randomUUID(), randomUUID(), { categoryId: expense.id, month: '2026-12', limitExpression: '50', decimalSeparator: '.', expectedUpdatedAtUtc: null });
  await repo.saveTransaction(randomUUID(), randomUUID(), refund({ amountExpression: '30', accountId: receiving, accountingDate: '2026-12-05', correctDate: true }));
  const balances = await repo.accounts();
  assert.equal(balances.find(row => row.id === accountId)?.balanceMinor, -10000n); assert.equal(balances.find(row => row.id === receiving)?.balanceMinor, 3000n);
  assert.deepEqual([(await repo.summary('2026-11')).expenseMinor, (await repo.summary('2026-12')).expenseMinor, (await repo.summary('2026-12')).incomeMinor], [10000n, -3000n, 0n]);
  const december = await repo.budgets('2026-12'); assert.equal(december.budgets[0]?.spentMinor, -3000n);
  const analysis = await repo.analysis('2026-12-01', '2026-12-31');
  assert.equal(analysis.incomeMinor, 0n); assert.equal(analysis.expenseMinor, -3000n); assert.equal(analysis.categories.find(row => row.id === expense.id)?.netMinor, -3000n);
  const page = (await repo.page('2026-12')).rows; assert.equal(page.length, 1); assert.equal(page[0]?.expenseEffect, 'refund');
  assert.deepEqual(await repo.refundStatus(purchaseId), { purchaseMinor: 10000n, refundedMinor: 3000n });
  await database.closeAsync();
});

test('BR-23/FR-TRN-002: refunds inherit an archived category; an archived receiving account is rejected on create but kept unchanged on edit', async () => {
  const { database, repo, expense, accountInput, purchaseId, refund } = await purchaseWithRefunds();
  const category = (await repo.categories()).find(row => row.id === expense.id); assert.ok(category);
  await repo.lifecycle(randomUUID(), 'category', category.id, 'archive', category.updatedAtUtc);
  const receiving = randomUUID(); await repo.saveAccount(randomUUID(), receiving, { ...accountInput, name: 'Wallet' });
  const refundId = randomUUID(); await repo.saveTransaction(randomUUID(), refundId, refund({ amountExpression: '10', accountId: receiving }));
  const account = (await repo.accounts()).find(row => row.id === receiving); assert.ok(account);
  await repo.lifecycle(randomUUID(), 'account', receiving, 'archive', account.updatedAtUtc);
  await assert.rejects(repo.saveTransaction(randomUUID(), randomUUID(), refund({ amountExpression: '1', accountId: receiving })), { code: 'ACTIVE_ACCOUNT_REQUIRED' });
  const row = await repo.transaction(refundId); assert.ok(row);
  await repo.saveTransaction(randomUUID(), refundId, refund({ amountExpression: '12', accountId: receiving, expectedUpdatedAtUtc: row.updatedAtUtc, retained: row }), true);
  assert.deepEqual(await repo.refundStatus(purchaseId), { purchaseMinor: 10000n, refundedMinor: 1200n });
  await database.closeAsync();
});

test('v6 receipt v1: refund and Budget requests hash exactly their normalized schema fields; replay returns the same projection', async () => {
  const { database, repo, expense, purchaseId, refund } = await purchaseWithRefunds();
  const digest = (value: CanonicalValue) => createHash('sha256').update(canonicalJson(value)).digest('hex');
  const token = randomUUID(), id = randomUUID(), command = refund({ amountExpression: '1' });
  const first = await repo.saveTransaction(token, id, command);
  assert.deepEqual(await repo.saveTransaction(token, id, command), first);
  const stored = await database.getFirstAsync<Transaction>('SELECT * FROM "Transaction" WHERE id=?', id); assert.ok(stored);
  const { createdAtUtc: _created, updatedAtUtc: _updated, ...fields } = stored;
  const receipt = await database.getFirstAsync<{ requestHash: string }>('SELECT requestHash FROM WriteReceipt WHERE operationToken=?', token);
  assert.equal(receipt?.requestHash, digest({ operation: 'create', entityType: 'transaction', entityId: id, input: fields } as CanonicalValue));
  assert.equal(fields.refundOfTransactionId, purchaseId);
  const budgetToken = randomUUID(), budgetId = randomUUID(), budgetInput = { categoryId: expense.id, month: '2026-11', limitExpression: '10+2.5', decimalSeparator: '.', expectedUpdatedAtUtc: null };
  const created = await repo.saveBudget(budgetToken, budgetId, budgetInput);
  assert.deepEqual(await repo.saveBudget(budgetToken, budgetId, { ...budgetInput, limitExpression: '12.50' }), created);
  await assert.rejects(repo.saveBudget(budgetToken, budgetId, { ...budgetInput, limitExpression: '13' }), { code: 'IDEMPOTENCY_CONFLICT' });
  const budgetReceipt = await database.getFirstAsync<{ requestHash: string; entityType: string }>('SELECT requestHash,entityType FROM WriteReceipt WHERE operationToken=?', budgetToken);
  assert.deepEqual({ ...budgetReceipt }, { entityType: 'budget', requestHash: digest({ operation: 'create', entityType: 'budget', entityId: budgetId, input: { id: budgetId, categoryId: expense.id, month: '2026-11', limitMinor: 1250 } }) });
  await database.closeAsync();
});

test('TC-06/59: Budget spent/remaining cross the limit exactly; duplicates are rejected; edits replace one month and never roll over', async () => {
  const { database, repo, expense, income, input } = await setup();
  const id = randomUUID();
  await repo.saveBudget(randomUUID(), id, { categoryId: expense.id, month: '2026-11', limitExpression: '20', decimalSeparator: '.', expectedUpdatedAtUtc: null });
  await assert.rejects(repo.saveBudget(randomUUID(), randomUUID(), { categoryId: expense.id, month: '2026-11', limitExpression: '30', decimalSeparator: '.', expectedUpdatedAtUtc: null }), { code: 'BUDGET_EXISTS' });
  await assert.rejects(repo.saveBudget(randomUUID(), randomUUID(), { categoryId: income.id, month: '2026-11', limitExpression: '30', decimalSeparator: '.', expectedUpdatedAtUtc: null }), { code: 'BUDGET_CATEGORY_REQUIRED' });
  for (const limitExpression of ['0', '-5', '0.004', '1/0']) await assert.rejects(repo.saveBudget(randomUUID(), randomUUID(), { categoryId: expense.id, month: '2026-10', limitExpression, decimalSeparator: '.', expectedUpdatedAtUtc: null }));
  await assert.rejects(repo.saveBudget(randomUUID(), randomUUID(), { categoryId: expense.id, month: '2026-13', limitExpression: '1', decimalSeparator: '.', expectedUpdatedAtUtc: null }), { code: 'INVALID_DATE' });
  await repo.saveTransaction(randomUUID(), randomUUID(), input({ amountExpression: '12.34' }));
  await repo.saveTransaction(randomUUID(), randomUUID(), input({ amountExpression: '8.66', accountingDate: '2026-11-30', correctDate: true }));
  await repo.saveTransaction(randomUUID(), randomUUID(), input({ amountExpression: '5', accountingDate: '2026-12-01', correctDate: true }));
  await repo.saveTransaction(randomUUID(), randomUUID(), input({ type: 'income', categoryId: income.id, amountExpression: '1000' }));
  let view = await repo.budgets('2026-11');
  assert.equal(view.budgets.length, 1); assert.equal(view.budgets[0]?.spentMinor, 2100n); assert.equal(view.budgets[0]?.limitMinor, 2000);
  assert.ok(!view.unbudgeted.some(row => row.id === expense.id) && view.unbudgeted.every(row => row.type === 'expense' && !row.isArchived));
  const row = view.budgets[0]; assert.ok(row);
  await assert.rejects(repo.saveBudget(randomUUID(), id, { categoryId: expense.id, month: '2026-12', limitExpression: '50', decimalSeparator: '.', expectedUpdatedAtUtc: row.updatedAtUtc }, true), { code: 'INVALID_COMMAND' });
  await repo.saveBudget(randomUUID(), id, { categoryId: expense.id, month: '2026-11', limitExpression: '25', decimalSeparator: '.', expectedUpdatedAtUtc: row.updatedAtUtc }, true);
  await assert.rejects(repo.saveBudget(randomUUID(), id, { categoryId: expense.id, month: '2026-11', limitExpression: '26', decimalSeparator: '.', expectedUpdatedAtUtc: row.updatedAtUtc }, true), { code: 'STALE_WRITE' });
  view = await repo.budgets('2026-11'); assert.equal(view.budgets[0]?.limitMinor, 2500); assert.equal(view.budgets[0]?.spentMinor, 2100n);
  assert.equal((await repo.budgets('2026-12')).budgets.length, 0);
  await database.closeAsync();
});

test('TC-60/58/96: archived Budgets stay historical; Budget-only categories delete after explicit Budget deletion, which changes no finance', async () => {
  const { database, repo, expense, input } = await setup();
  const categories = await repo.categories();
  const lonely = categories.find(row => row.type === 'expense' && row.id !== expense.id); assert.ok(lonely);
  const lonelyBudget = randomUUID(), usedBudget = randomUUID();
  await repo.saveBudget(randomUUID(), lonelyBudget, { categoryId: lonely.id, month: '2026-10', limitExpression: '10', decimalSeparator: '.', expectedUpdatedAtUtc: null });
  await repo.saveBudget(randomUUID(), usedBudget, { categoryId: expense.id, month: '2026-11', limitExpression: '10', decimalSeparator: '.', expectedUpdatedAtUtc: null });
  await repo.saveTransaction(randomUUID(), randomUUID(), input());
  // TC-60: archive keeps the historical Budget visible; no new Budget until restore.
  await repo.lifecycle(randomUUID(), 'category', lonely.id, 'archive', lonely.updatedAtUtc);
  const october = await repo.budgets('2026-10');
  assert.equal(october.budgets[0]?.categoryArchived, 1); assert.ok(!october.unbudgeted.some(row => row.id === lonely.id));
  await assert.rejects(repo.saveBudget(randomUUID(), randomUUID(), { categoryId: lonely.id, month: '2026-11', limitExpression: '5', decimalSeparator: '.', expectedUpdatedAtUtc: null }), { code: 'BUDGET_CATEGORY_REQUIRED' });
  const archived = (await repo.categories()).find(row => row.id === lonely.id); assert.ok(archived);
  await repo.lifecycle(randomUUID(), 'category', lonely.id, 'restore', archived.updatedAtUtc);
  assert.ok((await repo.budgets('2026-11')).unbudgeted.some(row => row.id === lonely.id));
  // TC-58/96: Budget-only reference blocks hard delete until the Budget is explicitly deleted.
  const restored = (await repo.categories()).find(row => row.id === lonely.id); assert.ok(restored);
  assert.deepEqual({ ...await repo.references('category', lonely.id) }, { transactions: 0, budgets: 1, revisions: 0, occurrences: 0 });
  assert.equal(await repo.latestBudgetMonth(lonely.id), '2026-10');
  await assert.rejects(repo.lifecycle(randomUUID(), 'category', lonely.id, 'delete', restored.updatedAtUtc), { code: 'ENTITY_REFERENCED' });
  const finance = async () => ({ rows: await database.getAllAsync('SELECT * FROM "Transaction" ORDER BY id'), accounts: await repo.accounts(), analysis: await repo.analysis('2026-10-01', '2026-11-30') });
  const before = await finance();
  const budget = (await repo.budgets('2026-10')).budgets[0]; assert.ok(budget);
  await assert.rejects(repo.deleteBudget(randomUUID(), lonelyBudget, '2000-01-01T00:00:00.000Z'), { code: 'STALE_WRITE' });
  await repo.deleteBudget(randomUUID(), lonelyBudget, budget.updatedAtUtc);
  assert.deepEqual(await finance(), before);
  await repo.lifecycle(randomUUID(), 'category', lonely.id, 'delete', restored.updatedAtUtc);
  // A category with transactions stays non-deletable after its Budget is deleted; a recreated Budget computes from history.
  const used = (await repo.budgets('2026-11')).budgets[0]; assert.ok(used);
  await repo.deleteBudget(randomUUID(), usedBudget, used.updatedAtUtc);
  const current = (await repo.categories()).find(row => row.id === expense.id); assert.ok(current);
  await assert.rejects(repo.lifecycle(randomUUID(), 'category', expense.id, 'delete', current.updatedAtUtc), { code: 'ENTITY_REFERENCED' });
  await repo.saveBudget(randomUUID(), randomUUID(), { categoryId: expense.id, month: '2026-11', limitExpression: '10', decimalSeparator: '.', expectedUpdatedAtUtc: null });
  assert.equal((await repo.budgets('2026-11')).budgets[0]?.spentMinor, 1234n);
  await assert.rejects(repo.saveBudget(randomUUID(), randomUUID(), { categoryId: expense.id, month: '2026-11', limitExpression: '10', decimalSeparator: '.', expectedUpdatedAtUtc: null }), { code: 'BUDGET_EXISTS' });
  await database.closeAsync();
});

test('TC-61/85/118: Analysis ranks signed net Expense with ties, Net refund, archived, boundaries and a positive-only chart from one row set', async () => {
  const { database, repo, accountId, input, income, accountInput } = await setup();
  const expense = (await repo.categories()).filter(row => row.type === 'expense');
  const [food, transport, bills, shopping, health, other] = ['Food', 'Transport', 'Bills', 'Shopping', 'Health', 'Other'].map(name => expense.find(row => row.name === name));
  assert.ok(food && transport && bills && shopping && health && other);
  const spend = async (category: string, amount: string, date: string) => { const id = randomUUID(); await repo.saveTransaction(randomUUID(), id, input({ categoryId: category, amountExpression: amount, accountingDate: date, correctDate: true, note: null })); return id; };
  await spend(food.id, '30', '2026-11-01'); await spend(transport.id, '30', '2026-11-30');            // tie at the inclusive boundaries
  await spend(bills.id, '40', '2026-10-31'); await spend(bills.id, '15', '2026-12-01');                // outside the range
  const shoppingPurchase = await spend(shopping.id, '50', '2026-10-15');                              // purchase outside, refund inside
  await repo.saveTransaction(randomUUID(), randomUUID(), input({ refundOfTransactionId: shoppingPurchase, categoryId: shopping.id, amountExpression: '20', accountingDate: '2026-11-10', correctDate: true, note: null }));
  const healthPurchase = await spend(health.id, '10', '2026-11-05');
  await repo.saveTransaction(randomUUID(), randomUUID(), input({ refundOfTransactionId: healthPurchase, categoryId: health.id, amountExpression: '10', accountingDate: '2026-11-06', correctDate: true, note: null })); // nets to zero
  await spend(other.id, '40', '2026-11-15');
  await repo.saveTransaction(randomUUID(), randomUUID(), input({ type: 'income', categoryId: income.id, amountExpression: '500', accountingDate: '2026-11-20', correctDate: true }));
  const b = randomUUID(); await repo.saveAccount(randomUUID(), b, { ...accountInput, name: 'Bank' });
  await repo.saveTransaction(randomUUID(), randomUUID(), input({ type: 'transfer', categoryId: null, toAccountId: b, amountExpression: '999', accountingDate: '2026-11-20', correctDate: true }));
  // Archive Other after use: its history stays in Analysis.
  const archivedOther = (await repo.categories()).find(row => row.id === other.id); assert.ok(archivedOther);
  await repo.lifecycle(randomUUID(), 'category', other.id, 'archive', archivedOther.updatedAtUtc);
  const view = await repo.analysis('2026-11-01', '2026-11-30');
  assert.equal(view.incomeMinor, 50000n);
  assert.deepEqual(view.categories.map(row => [row.name, row.netMinor, row.isArchived]), [['Other', 4000n, 1], ['Food', 3000n, 0], ['Transport', 3000n, 0], ['Bills', 0n, 0], ['Health', 0n, 0], ['Shopping', -2000n, 0]]);
  assert.equal(view.expenseMinor, view.categories.reduce((sum, row) => sum + row.netMinor, 0n)); assert.equal(view.expenseMinor, 8000n);
  assert.equal(view.expenseMinor, (await repo.summary('2026-11')).expenseMinor);
  const shares = chartShares(view.categories);
  assert.deepEqual(shares.map(({ row, tenths }) => [row.name, shareLabel(tenths)]), [['Other', '40.0%'], ['Food', '30.0%'], ['Transport', '30.0%']]);
  // No positive category: an empty chart and no largest category; refunds never count as Income.
  const refundsOnly = await repo.analysis('2026-11-06', '2026-11-10');
  assert.deepEqual(chartShares(refundsOnly.categories), []); assert.equal(refundsOnly.incomeMinor, 0n); assert.equal(refundsOnly.expenseMinor, -3000n);
  await assert.rejects(repo.analysis('2026-11-02', '2026-11-01'), { code: 'INVALID_DATE_RANGE' });
  await assert.rejects(repo.analysis('2026-02-30', '2026-03-01'), { code: 'INVALID_DATE' });
  assert.ok(accountId);
  await database.closeAsync();
});

test('FR-ANA-002/FR-BUD-003 helpers: half-up one-decimal shares, positive-only denominator and unclamped Budget states', () => {
  const rows = (values: bigint[]) => values.map((netMinor, index) => ({ id: String(index), netMinor }));
  assert.deepEqual(chartShares(rows([1n, 1n, 1n])).map(share => shareLabel(share.tenths)), ['33.3%', '33.3%', '33.3%']);
  assert.deepEqual(chartShares(rows([15n, 1n, 0n, -50n])).map(share => shareLabel(share.tenths)), ['93.8%', '6.3%']);
  assert.deepEqual(chartShares(rows([2000000000000n * 3n, 1n])).map(share => share.tenths), [1000n, 0n]);
  assert.deepEqual(budgetStatus(2000n, 2100n), { state: 'over', remainingMinor: -100n, fraction: 1 });
  assert.deepEqual(budgetStatus(2000n, 2000n), { state: 'reached', remainingMinor: 0n, fraction: 1 });
  assert.deepEqual(budgetStatus(2000n, -3000n), { state: 'net_refund', remainingMinor: 5000n, fraction: 0 });
  assert.deepEqual(budgetStatus(2000n, 500n), { state: 'within', remainingMinor: 1500n, fraction: 0.25 });
});

test('TC-33 data leg: PERF-01 Budgets and Analysis equal an exact reference over 10,000 rows, pending ledger rows excluded', async () => {
  const database = new TestDatabase(); await migrate(database);
  const fixture = generatePerfFixture(); await loadFixture(database, fixture.data);
  const repo = new LedgerRepository(new DatabaseCoordinator(database));
  const inRange = (date: string, from: string, to: string) => date >= from && date <= to;
  const net = (category: string, from: string, to: string) => fixture.data.Transaction.filter(row => row.type === 'expense' && row.categoryId === category && inRange(row.accountingDate, from, to))
    .reduce((sum, row) => sum + (row.expenseEffect === 'refund' ? -1n : 1n) * BigInt(row.amountMinor), 0n);
  const view = await repo.analysis('2023-01-01', '2025-12-31');
  assert.equal(view.incomeMinor, fixture.data.Transaction.filter(row => row.type === 'income').reduce((sum, row) => sum + BigInt(row.amountMinor), 0n));
  const active = fixture.data.Category.filter(row => row.type === 'expense');
  assert.equal(view.categories.length, active.filter(row => !row.isArchived || net(row.id, '2023-01-01', '2025-12-31') !== 0n || fixture.data.Transaction.some(t => t.categoryId === row.id)).length);
  for (const row of view.categories) assert.equal(row.netMinor, net(row.id, '2023-01-01', '2025-12-31'));
  for (let index = 1; index < view.categories.length; index++) {
    const previous = view.categories[index - 1]; const current = view.categories[index]; assert.ok(previous && current);
    assert.ok(previous.netMinor > current.netMinor || (previous.netMinor === current.netMinor && previous.name <= current.name));
  }
  const budgets = await repo.budgets('2025-03');
  const budgeted = new Set(fixture.data.Budget.filter(row => row.month === '2025-03').map(row => row.categoryId));
  assert.equal(budgets.budgets.length, budgeted.size);
  for (const row of budgets.budgets) assert.equal(row.spentMinor, net(row.categoryId, '2025-03-01', '2025-03-31'));
  assert.deepEqual(budgets.unbudgeted.map(row => row.id).sort(), fixture.data.Category.filter(row => row.type === 'expense' && !row.isArchived && !budgeted.has(row.id)).map(row => row.id).sort());
  await database.closeAsync();
});
