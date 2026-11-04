import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { SqlConnection } from '../db/connection.ts';
import type { DatabaseCoordinator } from '../db/coordinator.ts';
import { accountingDate, captureCreationMetadata, resolveAccountingTimeAsync } from '../domain/dates.ts';
import { AppError } from '../domain/errors.ts';
import { monthValue, shortText, uuidValue } from '../domain/ledger.ts';
import { amountFromExpression, safeInteger, storedMinor } from '../domain/money.ts';
import type { Account, Budget, Category, PreferencesPortable, Transaction } from '../domain/portable.ts';
import { portableWrite, type ReceiptResult, type WriteCommand } from './write-receipts.ts';
import type { FaultPoint } from '../db/migrations/index.ts';
import { yieldTask } from '../domain/tasks.ts';

export type AccountRow = Omit<Account, 'isArchived'> & { isArchived: number };
export type CategoryRow = Omit<Category, 'isArchived'> & { isArchived: number };
export type AccountBalance = AccountRow & { balanceMinor: bigint };
export type TransactionRow = Omit<Transaction, 'originScheduleSnapshot'> & {
  originScheduleSnapshot: string | null; accountName: string; categoryName: string | null;
  categoryIcon: string | null; toAccountName: string | null; accountIcon: string;
};
export type PageCursor = Pick<Transaction, 'accountingDate' | 'occurredAtUtc' | 'id'>;
export type RecordsPage = { rows: TransactionRow[]; next: PageCursor | null };
export type MonthSummary = { incomeMinor: bigint; expenseMinor: bigint; days: Record<string, bigint> };
export type ReferenceCounts = { transactions: number; budgets: number; revisions: number; occurrences: number };
export type TransactionInput = {
  type: Transaction['type']; amountExpression: string; decimalSeparator: string;
  accountId: string; categoryId: string | null; toAccountId: string | null;
  accountingDate: string; localTime: string | null; timeZoneId: string; chosenOffsetMinutes: number | null;
  note: string | null; correctDate: boolean; expectedUpdatedAtUtc: string | null;
  /** Set only for a linked Expense refund (BR-23); its category must be the purchase's category. */
  refundOfTransactionId: string | null;
  creationMetadata: ReturnType<typeof captureCreationMetadata>;
  retained: Pick<Transaction, 'idempotencyToken' | 'accountingDate' | 'occurredAtUtc'> | null;
};
/** A purchase amount and the exact total of its non-deleted linked refunds. */
export type RefundStatus = { purchaseMinor: bigint; refundedMinor: bigint };
export type BudgetRow = Omit<Budget, 'createdAtUtc'> & { categoryName: string; categoryIcon: string; categoryArchived: number; spentMinor: bigint };
export type BudgetsView = { month: string; budgets: BudgetRow[]; unbudgeted: CategoryRow[] };
export type BudgetInput = { categoryId: string; month: string; limitExpression: string; decimalSeparator: string; expectedUpdatedAtUtc: string | null };
export type AnalysisCategory = Pick<CategoryRow, 'id' | 'name' | 'icon' | 'isArchived'> & { netMinor: bigint };
/** One snapshot: the net-Expense total is the sum of the ranked categories, so chart, list and total share one row set. */
export type AnalysisView = { from: string; to: string; incomeMinor: bigint; expenseMinor: bigint; categories: AnalysisCategory[] };
export type AccountInput = { name: string; icon: string; openingExpression: string; decimalSeparator: string; expectedUpdatedAtUtc: string | null; isArchived?: boolean };
export type CategoryInput = { name: string; icon: string; type: Category['type']; expectedUpdatedAtUtc: string | null; isArchived?: boolean };
export type DisplayPreferences = Pick<PreferencesPortable, 'currencySign' | 'currencyPosition' | 'displayDecimalPlaces' | 'notesVisibleInList' | 'uiMode' | 'dailyReminderTime'>;
type StoredPreferences = Omit<PreferencesPortable, 'notesVisibleInList'> & { notesVisibleInList: number };
const hash = async (input: string) => bytesToHex(sha256(utf8ToBytes(input)));
const selectTransaction = `SELECT t.*,a.name AS accountName,a.icon AS accountIcon,c.name AS categoryName,c.icon AS categoryIcon,b.name AS toAccountName
  FROM "Transaction" t JOIN Account a ON a.id=t.accountId LEFT JOIN Category c ON c.id=t.categoryId LEFT JOIN Account b ON b.id=t.toAccountId`;

/** All financial mutation validation runs after the receipt lookup and inside the writer's transaction. */
export class LedgerRepository {
  private readonly db: DatabaseCoordinator;
  private readonly now: () => string;
  private readonly fault: FaultPoint;
  constructor(db: DatabaseCoordinator, options: { now?: () => string; fault?: FaultPoint } = {}) {
    this.db = db; this.now = options.now ?? (() => new Date().toISOString()); this.fault = options.fault ?? (() => undefined);
  }

  private write(command: WriteCommand, mutate: (tx: SqlConnection, stamp: string) => Promise<void>): Promise<ReceiptResult> {
    const stamp = this.now();
    return portableWrite(this.db, command, hash, async tx => {
      await this.fault('ledger:after-receipt');
      await mutate(tx, stamp);
      await this.fault('ledger:before-commit');
    }, () => stamp);
  }

  async preferences(): Promise<PreferencesPortable> {
    return this.db.read(async tx => {
      const row = await tx.getFirstAsync<StoredPreferences>('SELECT * FROM PreferencesPortable WHERE singleton=1');
      if (!row) throw new AppError('DATABASE_CORRUPT');
      return { currencySign: row.currencySign, currencyPosition: row.currencyPosition, displayDecimalPlaces: row.displayDecimalPlaces,
        notesVisibleInList: Boolean(row.notesVisibleInList), uiMode: row.uiMode === 'dark' || row.uiMode === 'light' ? row.uiMode : 'system', theme: 'kwartracker', dailyReminderTime: row.dailyReminderTime };
    });
  }

  async savePreferences(operationToken: string, entityId: string, input: DisplayPreferences) {
    const fields = { currencySign: input.currencySign, currencyPosition: input.currencyPosition, displayDecimalPlaces: input.displayDecimalPlaces,
      notesVisibleInList: input.notesVisibleInList, uiMode: input.uiMode, theme: 'kwartracker', dailyReminderTime: input.dailyReminderTime };
    return this.write({ operationToken, entityId, operation: 'edit', entityType: 'preferences', input: fields }, async tx => {
      if (typeof input.currencySign !== 'string' || input.currencySign.trim().length === 0 || [...input.currencySign].length > 12 ||
        !['prefix', 'suffix'].includes(input.currencyPosition) || ![0, 2].includes(input.displayDecimalPlaces) ||
        typeof input.notesVisibleInList !== 'boolean' || !['system', 'light', 'dark'].includes(input.uiMode)) throw new AppError('INVALID_COMMAND');
      const previous = await tx.getFirstAsync<{ dailyReminderTime: string | null }>('SELECT dailyReminderTime FROM PreferencesPortable WHERE singleton=1');
      if (!previous) throw new AppError('DATABASE_CORRUPT');
      if (previous.dailyReminderTime !== input.dailyReminderTime) throw new AppError('STALE_WRITE');
      const result = await tx.runAsync('UPDATE PreferencesPortable SET currencySign=?,currencyPosition=?,displayDecimalPlaces=?,notesVisibleInList=?,uiMode=?,theme=? WHERE singleton=1',
        input.currencySign, input.currencyPosition, input.displayDecimalPlaces, Number(input.notesVisibleInList), input.uiMode, 'kwartracker');
      if (result.changes !== 1) throw new AppError('DATABASE_CORRUPT');
    });
  }

  accounts(activeOnly = false): Promise<AccountBalance[]> {
    return this.db.read(async tx => {
      // One row per account: SQLite SUM over the schema's integer amounts is exact and raises on int64 overflow
      // (TOTAL would use floats), and text results keep every digit for BigInt. Outgoing legs use accountId, incoming transfers toAccountId.
      const rows = await exact(() => tx.getAllAsync<AccountRow & { sourceMinor: string | null; destinationMinor: string | null }>(`
          SELECT a.*,
            (SELECT CAST(SUM(CASE WHEN t.type='income' OR t.expenseEffect='refund' THEN t.amountMinor ELSE -t.amountMinor END) AS TEXT) FROM "Transaction" t WHERE t.accountId=a.id) AS sourceMinor,
            (SELECT CAST(SUM(t.amountMinor) AS TEXT) FROM "Transaction" t WHERE t.toAccountId=a.id) AS destinationMinor
          FROM Account a ${activeOnly ? 'WHERE a.isArchived=0' : ''} ORDER BY a.createdAtUtc,a.id`));
      return rows.map(({ sourceMinor, destinationMinor, ...row }) => ({ ...row, balanceMinor: storedMinor(row.openingBalanceMinor, true) + summedMinor(sourceMinor) + summedMinor(destinationMinor) }));
    });
  }

  categories(activeOnly = false): Promise<CategoryRow[]> {
    return this.db.read(tx => tx.getAllAsync<CategoryRow>(`SELECT * FROM Category ${activeOnly ? 'WHERE isArchived=0' : ''} ORDER BY createdAtUtc,id`));
  }

  async saveAccount(operationToken: string, id: string, input: AccountInput, editing = false) {
    const name = shortText(input.name), icon = shortText(input.icon);
    const amount = safeInteger(amountFromExpression(input.openingExpression, { openingBalance: true, decimalSeparator: input.decimalSeparator }));
    const fields = { id, name, icon, openingBalanceMinor: amount, isArchived: input.isArchived ?? false };
    return this.write({ operationToken, entityId: id, operation: editing ? 'edit' : 'create', entityType: 'account', input: fields }, async (tx, stamp) => {
      if (typeof fields.isArchived !== 'boolean' || (!editing && fields.isArchived)) throw new AppError('INVALID_COMMAND');
      if (editing) {
        const old = await tx.getFirstAsync<AccountRow>('SELECT * FROM Account WHERE id=?', id);
        const updated = versionStamp(old, input.expectedUpdatedAtUtc, stamp);
        if (Boolean(old?.isArchived) !== fields.isArchived) throw new AppError('STALE_WRITE');
        await tx.runAsync('UPDATE Account SET name=?,icon=?,openingBalanceMinor=?,updatedAtUtc=? WHERE id=?', name, icon, amount, updated, id);
      } else {
        await tx.runAsync('INSERT INTO Account VALUES(?,?,?,?,0,?,?)', id, name, icon, amount, stamp, stamp);
      }
    });
  }

  async saveCategory(operationToken: string, id: string, input: CategoryInput, editing = false) {
    const name = shortText(input.name), icon = shortText(input.icon);
    const fields = { id, name, icon, type: input.type, isArchived: input.isArchived ?? false };
    return this.write({ operationToken, entityId: id, operation: editing ? 'edit' : 'create', entityType: 'category', input: fields }, async (tx, stamp) => {
      if (typeof fields.isArchived !== 'boolean' || (!editing && fields.isArchived)) throw new AppError('INVALID_COMMAND');
      if (input.type !== 'income' && input.type !== 'expense') throw new AppError('INVALID_COMMAND');
      if (editing) {
        const old = await tx.getFirstAsync<CategoryRow>('SELECT * FROM Category WHERE id=?', id);
        const updated = versionStamp(old, input.expectedUpdatedAtUtc, stamp);
        if (Boolean(old?.isArchived) !== fields.isArchived) throw new AppError('STALE_WRITE');
        if (old?.type !== input.type) throw new AppError('CATEGORY_TYPE_FIXED');
        await tx.runAsync('UPDATE Category SET name=?,icon=?,updatedAtUtc=? WHERE id=?', name, icon, updated, id);
      } else {
        await tx.runAsync('INSERT INTO Category VALUES(?,?,?,?,0,?,?)', id, input.type, name, icon, stamp, stamp);
      }
    });
  }

  references(kind: 'account' | 'category', id: string): Promise<ReferenceCounts> {
    return this.db.read(tx => references(tx, kind, uuidValue(id)));
  }

  lifecycle(operationToken: string, kind: 'account' | 'category', id: string, action: 'archive' | 'restore' | 'delete', expectedUpdatedAtUtc: string) {
    return this.write({ operationToken, entityId: id, operation: action, entityType: kind, input: { id } }, async (tx, stamp) => {
      const table = kind === 'account' ? 'Account' : 'Category';
      const old = await tx.getFirstAsync<AccountRow | CategoryRow>(`SELECT * FROM ${table} WHERE id=?`, id);
      const updated = versionStamp(old, expectedUpdatedAtUtc, stamp);
      if (action === 'delete') {
        const counts = await references(tx, kind, id);
        if (Object.values(counts).some(count => count > 0)) throw new AppError('ENTITY_REFERENCED');
        await tx.runAsync(`DELETE FROM ${table} WHERE id=?`, id);
      } else {
        if (action === 'archive') {
          const column = kind === 'account' ? 'snapshotAccountId' : 'snapshotCategoryId';
          const pending = await tx.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM RecurringOccurrenceLedger WHERE ${column}=? AND disposition IN ('pending','deferred_backlog')`, id);
          // Phase 3 owns rule pausing/cancellation. Never leave pending archived targets inconsistent in the meantime.
          if (pending && pending.count > 0) throw new AppError('RECURRING_ACTIVITY');
        }
        await tx.runAsync(`UPDATE ${table} SET isArchived=?,updatedAtUtc=? WHERE id=?`, Number(action === 'archive'), updated, id);
      }
    });
  }

  transaction(id: string): Promise<TransactionRow | null> {
    uuidValue(id);
    return this.db.read(tx => tx.getFirstAsync<TransactionRow>(`${selectTransaction} WHERE t.id=?`, id));
  }

  latestType(): Promise<Transaction['type']> {
    return this.db.read(async tx => (await tx.getFirstAsync<Pick<Transaction, 'type'>>('SELECT t.type FROM "Transaction" t JOIN WriteReceipt r ON r.operationToken=t.idempotencyToken ORDER BY r.committedAtUtc DESC,r.rowid DESC LIMIT 1'))?.type ?? 'expense');
  }

  async saveTransaction(operationToken: string, id: string, input: TransactionInput, editing = false) {
    // v1 receipt encoding is the normalized entity schema, not transport/draft fields.
    const amount = safeInteger(amountFromExpression(input.amountExpression, { decimalSeparator: input.decimalSeparator }));
    const metadata = captureCreationMetadata(input.creationMetadata.createdAtUtc, input.creationMetadata.createdTimeZoneId);
    if (metadata.createdUtcOffsetMinutes !== input.creationMetadata.createdUtcOffsetMinutes) throw new AppError('INVALID_DATE');
    const retained = input.retained;
    const refund = input.refundOfTransactionId !== null;
    if (editing && !retained) throw new AppError('INVALID_COMMAND');
    const when = editing && !input.correctDate && retained
      ? { accountingDate: retained.accountingDate, occurredAtUtc: retained.occurredAtUtc }
      : await resolveAccountingTimeAsync(input.accountingDate, input.timeZoneId, input.localTime ?? undefined, input.chosenOffsetMinutes ?? undefined);
    const fields: Omit<Transaction, 'createdAtUtc' | 'updatedAtUtc'> = {
      id, idempotencyToken: editing && retained ? retained.idempotencyToken : operationToken,
      type: input.type, expenseEffect: input.type === 'expense' ? refund ? 'refund' : 'purchase' : null, amountMinor: amount,
      accountingDate: when.accountingDate, occurredAtUtc: when.occurredAtUtc,
      createdTimeZoneId: metadata.createdTimeZoneId, createdUtcOffsetMinutes: metadata.createdUtcOffsetMinutes,
      note: input.note, accountId: input.accountId, categoryId: input.categoryId, toAccountId: input.toAccountId,
      refundOfTransactionId: input.refundOfTransactionId, originOccurrenceId: null, originKind: 'manual', originRuleTitleSnapshot: null, originScheduleSnapshot: null, originOccurrenceDate: null,
    };
    return this.write({ operationToken, entityId: id, operation: editing ? 'edit' : 'create', entityType: 'transaction', input: { ...fields } }, async (tx, stamp) => {
      if (!['income', 'expense', 'transfer'].includes(input.type)) throw new AppError('INVALID_COMMAND');
      const old = editing ? await tx.getFirstAsync<Transaction>('SELECT * FROM "Transaction" WHERE id=?', id) : null;
      const updated = editing ? versionStamp(old, input.expectedUpdatedAtUtc, stamp) : stamp;
      if (old?.originKind === 'recurring') throw new AppError('UNSUPPORTED_EDIT');
      // A refund stays linked to its original purchase; no other entry becomes a refund on edit.
      if (old && (old.expenseEffect === 'refund' ? old.refundOfTransactionId !== input.refundOfTransactionId : refund)) throw new AppError('INVALID_COMMAND');
      if (old && (metadata.createdAtUtc !== old.createdAtUtc || metadata.createdTimeZoneId !== old.createdTimeZoneId || metadata.createdUtcOffsetMinutes !== old.createdUtcOffsetMinutes || fields.idempotencyToken !== old.idempotencyToken ||
        (!input.correctDate && (fields.accountingDate !== old.accountingDate || fields.occurredAtUtc !== old.occurredAtUtc)))) throw new AppError('INVALID_COMMAND');
      if (input.note !== null && (typeof input.note !== 'string' || [...input.note].length > 4000)) throw new AppError('INVALID_NOTE');
      if (refund) await validateRefund(tx, id, input, amount, old);
      else await validateTargets(tx, input, old);
      // A purchase with linked refunds keeps its type and category and never falls below its refunded total.
      if (old && !refund) {
        const refunds = await tx.getAllAsync<{ amountMinor: number }>('SELECT amountMinor FROM "Transaction" WHERE refundOfTransactionId=?', id);
        if (refunds.length && (input.type !== old.type || input.categoryId !== old.categoryId || refunds.reduce((sum, row) => sum + storedMinor(row.amountMinor), 0n) > BigInt(amount))) throw new AppError('LINKED_REFUNDS');
      }
      await this.fault('ledger:before-transaction');
      if (old) {
        await tx.runAsync('UPDATE "Transaction" SET type=?,expenseEffect=?,amountMinor=?,accountingDate=?,occurredAtUtc=?,note=?,accountId=?,categoryId=?,toAccountId=?,updatedAtUtc=? WHERE id=?',
          input.type, fields.expenseEffect, amount, when.accountingDate, when.occurredAtUtc, input.note, input.accountId, input.categoryId, input.toAccountId, updated, id);
      } else {
        await tx.runAsync(`INSERT INTO "Transaction"(id,idempotencyToken,type,expenseEffect,amountMinor,accountingDate,occurredAtUtc,createdTimeZoneId,createdUtcOffsetMinutes,note,accountId,categoryId,toAccountId,refundOfTransactionId,originOccurrenceId,originKind,originRuleTitleSnapshot,originScheduleSnapshot,originOccurrenceDate,createdAtUtc,updatedAtUtc)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,'manual',NULL,NULL,NULL,?,?)`,
        id, operationToken, input.type, fields.expenseEffect, amount, when.accountingDate, when.occurredAtUtc, metadata.createdTimeZoneId, metadata.createdUtcOffsetMinutes,
        input.note, input.accountId, input.categoryId, input.toAccountId, input.refundOfTransactionId, metadata.createdAtUtc, new Date(Math.max(Date.parse(stamp), Date.parse(metadata.createdAtUtc))).toISOString());
      }
      // Effects are derived from one row; there is no materialized half-transfer balance to expose.
      await this.fault('ledger:after-transaction');
    });
  }

  deleteTransaction(operationToken: string, id: string, expectedUpdatedAtUtc: string) {
    return this.write({ operationToken, entityId: id, operation: 'delete', entityType: 'transaction', input: { id } }, async (tx, stamp) => {
      const old = await tx.getFirstAsync<Transaction>('SELECT * FROM "Transaction" WHERE id=?', id);
      versionStamp(old, expectedUpdatedAtUtc, stamp);
      if (old?.originKind === 'recurring') throw new AppError('UNSUPPORTED_EDIT');
      // Deleting a refund reverses its credit and Expense reduction and frees that amount; a refunded purchase stays.
      if (await tx.getFirstAsync('SELECT id FROM "Transaction" WHERE refundOfTransactionId=? LIMIT 1', id)) throw new AppError('LINKED_REFUNDS');
      await this.fault('ledger:before-transaction');
      await tx.runAsync('DELETE FROM "Transaction" WHERE id=?', id);
      await this.fault('ledger:after-transaction');
    });
  }

  /** Purchase amount and the exact total of its non-deleted refunds (BR-23). */
  async refundStatus(originalId: string): Promise<RefundStatus> {
    uuidValue(originalId);
    return this.db.read(async tx => {
      const { purchaseMinor, refundedMinor } = await refundStatus(tx, originalId, null);
      return { purchaseMinor, refundedMinor };
    });
  }

  /** Budgets with signed spent for the month and the active Expense categories still without one (FR-BUD-002/005). */
  async budgets(month: string): Promise<BudgetsView> {
    monthValue(month);
    return this.db.write(async tx => {
      const rows = await exact(() => tx.getAllAsync<Omit<BudgetRow, 'spentMinor'> & { spentMinor: string | null }>(`
        SELECT b.id,b.categoryId,b.month,b.limitMinor,b.updatedAtUtc,c.name AS categoryName,c.icon AS categoryIcon,c.isArchived AS categoryArchived,
          (SELECT CAST(SUM(CASE WHEN t.expenseEffect='refund' THEN -t.amountMinor ELSE t.amountMinor END) AS TEXT) FROM "Transaction" t
            WHERE t.type='expense' AND t.categoryId=b.categoryId AND t.accountingDate>=? AND t.accountingDate<=?) AS spentMinor
        FROM Budget b JOIN Category c ON c.id=b.categoryId WHERE b.month=? ORDER BY c.name,c.id`, `${month}-01`, `${month}-31`, month));
      const unbudgeted = await tx.getAllAsync<CategoryRow>(`SELECT c.* FROM Category c WHERE c.type='expense' AND c.isArchived=0
        AND NOT EXISTS(SELECT 1 FROM Budget b WHERE b.categoryId=c.id AND b.month=?) ORDER BY c.name,c.id`, month);
      return { month, budgets: rows.map(row => ({ ...row, spentMinor: summedMinor(row.spentMinor) })), unbudgeted };
    });
  }

  async latestBudgetMonth(categoryId: string): Promise<string | null> {
    uuidValue(categoryId);
    return this.db.read(async tx => (await tx.getFirstAsync<{ month: string }>('SELECT month FROM Budget WHERE categoryId=? ORDER BY month DESC LIMIT 1', categoryId))?.month ?? null);
  }

  async saveBudget(operationToken: string, id: string, input: BudgetInput, editing = false) {
    const month = monthValue(input.month);
    const limitMinor = safeInteger(amountFromExpression(input.limitExpression, { decimalSeparator: input.decimalSeparator }));
    const fields = { id, categoryId: uuidValue(input.categoryId), month, limitMinor };
    return this.write({ operationToken, entityId: id, operation: editing ? 'edit' : 'create', entityType: 'budget', input: fields }, async (tx, stamp) => {
      if (editing) {
        // BR-11/FR-BUD-004: an edit replaces only this month's limit; its category and month stay fixed.
        const old = await tx.getFirstAsync<Budget>('SELECT * FROM Budget WHERE id=?', id);
        const updated = versionStamp(old, input.expectedUpdatedAtUtc, stamp);
        if (old?.categoryId !== fields.categoryId || old.month !== month) throw new AppError('INVALID_COMMAND');
        await tx.runAsync('UPDATE Budget SET limitMinor=?,updatedAtUtc=? WHERE id=?', limitMinor, updated, id);
      } else {
        const category = await tx.getFirstAsync<CategoryRow>('SELECT * FROM Category WHERE id=?', fields.categoryId);
        if (!category || category.type !== 'expense' || category.isArchived) throw new AppError('BUDGET_CATEGORY_REQUIRED');
        if (await tx.getFirstAsync('SELECT id FROM Budget WHERE categoryId=? AND month=?', fields.categoryId, month)) throw new AppError('BUDGET_EXISTS');
        await tx.runAsync('INSERT INTO Budget VALUES(?,?,?,?,?,?)', id, fields.categoryId, month, limitMinor, stamp, stamp);
      }
    });
  }

  /** FR-BUD-007: removes only the Budget row; transactions, balances and Analysis are untouched. */
  deleteBudget(operationToken: string, id: string, expectedUpdatedAtUtc: string) {
    return this.write({ operationToken, entityId: id, operation: 'delete', entityType: 'budget', input: { id } }, async (tx, stamp) => {
      versionStamp(await tx.getFirstAsync<Budget>('SELECT * FROM Budget WHERE id=?', id), expectedUpdatedAtUtc, stamp);
      await tx.runAsync('DELETE FROM Budget WHERE id=?', id);
    });
  }

  /** FR-ANA-001-003 for an inclusive accounting-date range, ranked by signed net Expense, then name. */
  async analysis(from: string, to: string): Promise<AnalysisView> {
    accountingDate(from); accountingDate(to);
    if (from > to) throw new AppError('INVALID_DATE_RANGE');
    return this.db.write(async tx => {
      const income = await exact(() => tx.getFirstAsync<{ total: string | null }>(`SELECT CAST(SUM(amountMinor) AS TEXT) AS total FROM "Transaction"
        WHERE type='income' AND accountingDate>=? AND accountingDate<=?`, from, to));
      // Every active Expense category, plus archived ones with rows in the range (BR-09), including zero and negative results.
      const rows = await exact(() => tx.getAllAsync<Omit<AnalysisCategory, 'netMinor'> & { netMinor: string | null }>(`
        SELECT c.id,c.name,c.icon,c.isArchived,CAST(n.net AS TEXT) AS netMinor FROM Category c LEFT JOIN (
          SELECT categoryId,SUM(CASE WHEN expenseEffect='refund' THEN -amountMinor ELSE amountMinor END) AS net FROM "Transaction"
          WHERE type='expense' AND accountingDate>=? AND accountingDate<=? GROUP BY categoryId) n ON n.categoryId=c.id
        WHERE c.type='expense' AND (c.isArchived=0 OR n.categoryId IS NOT NULL) ORDER BY COALESCE(n.net,0) DESC,c.name,c.id`, from, to));
      const categories = rows.map(row => ({ ...row, netMinor: summedMinor(row.netMinor) }));
      return { from, to, incomeMinor: summedMinor(income?.total ?? null), expenseMinor: categories.reduce((sum, row) => sum + row.netMinor, 0n), categories };
    });
  }

  page(month: string, cursor: PageCursor | null = null): Promise<RecordsPage> {
    monthValue(month);
    if (cursor) { uuidValue(cursor.id); if (!cursor.accountingDate.startsWith(month)) throw new AppError('INVALID_DATE'); }
    return this.db.read(tx => pageQuery(tx, month, cursor));
  }

  summary(month: string): Promise<MonthSummary> {
    monthValue(month);
    return this.db.read(tx => summaryQuery(tx, month));
  }

  /** Serialize the first page and header in one snapshot so a racing commit cannot mix their datasets. */
  records(month: string) {
    monthValue(month);
    return this.db.write(async tx => {
      const page = await pageQuery(tx, month, null);
      const summary = await summaryQuery(tx, month);
      const count = await tx.getFirstAsync<{ present: number }>('SELECT EXISTS(SELECT 1 FROM Account) AS present');
      return { month, page, summary, hasAccounts: Boolean(count?.present) };
    });
  }
}

async function pageQuery(tx: SqlConnection, month: string, cursor: PageCursor | null): Promise<RecordsPage> {
      const rows = await tx.getAllAsync<TransactionRow>(`${selectTransaction} WHERE t.accountingDate>=? AND t.accountingDate<=?
        ${cursor ? 'AND (t.accountingDate,t.occurredAtUtc,t.id)<(?,?,?)' : ''}
        ORDER BY t.accountingDate DESC,t.occurredAtUtc DESC,t.id DESC LIMIT 51`,
      `${month}-01`, `${month}-31`, ...(cursor ? [cursor.accountingDate, cursor.occurredAtUtc, cursor.id] : []));
      const last = rows[49];
      return { rows: rows.slice(0, 50), next: rows.length > 50 && last ? { accountingDate: last.accountingDate, occurredAtUtc: last.occurredAtUtc, id: last.id } : null };
}

/** SQLite SUM over integer amounts is exact and raises on int64 overflow (TOTAL would use floats). */
async function exact<T>(query: () => Promise<T>): Promise<T> {
  try { return await query(); }
  catch (error) {
    if (error instanceof Error && /integer overflow/i.test(error.message)) throw new AppError('AMOUNT_OUT_OF_RANGE');
    throw error;
  }
}

async function refundStatus(tx: SqlConnection, originalId: string, excludeId: string | null): Promise<RefundStatus & { original: Transaction }> {
  const original = await tx.getFirstAsync<Transaction>('SELECT * FROM "Transaction" WHERE id=?', originalId);
  if (!original || original.type !== 'expense' || original.expenseEffect !== 'purchase') throw new AppError('REFUND_ORIGINAL_INVALID');
  const refunded = await tx.getFirstAsync<{ total: string | null }>('SELECT CAST(SUM(amountMinor) AS TEXT) AS total FROM "Transaction" WHERE refundOfTransactionId=? AND id<>?', originalId, excludeId ?? '');
  return { original, purchaseMinor: storedMinor(original.amountMinor), refundedMinor: summedMinor(refunded?.total ?? null) };
}

/** FR-TRN-010: read the original and its refunds inside the writer's exclusive transaction, then reject without writing. */
async function validateRefund(tx: SqlConnection, id: string, input: TransactionInput, amount: number, old: Transaction | null) {
  if (input.type !== 'expense' || input.toAccountId !== null || !input.refundOfTransactionId || input.refundOfTransactionId === id) throw new AppError('INVALID_COMMAND');
  const status = await refundStatus(tx, uuidValue(input.refundOfTransactionId), id);
  // The refund inherits the purchase category, which may since have been archived (FR-TRN-002).
  if (status.original.categoryId !== input.categoryId) throw new AppError('REFUND_ORIGINAL_INVALID');
  const account = await tx.getFirstAsync<AccountRow>('SELECT * FROM Account WHERE id=?', uuidValue(input.accountId));
  if (!account || (account.isArchived && old?.accountId !== input.accountId)) throw new AppError('ACTIVE_ACCOUNT_REQUIRED');
  if (status.refundedMinor + BigInt(amount) > status.purchaseMinor) throw new AppError('REFUND_EXCEEDS_PURCHASE');
}

function summedMinor(value: string | null): bigint {
  if (value === null) return 0n;
  if (!/^-?\d+$/.test(value)) throw new AppError('INVALID_AMOUNT');
  return BigInt(value);
}

async function summaryQuery(tx: SqlConnection, month: string): Promise<MonthSummary> {
      const groups = await tx.getAllAsync<{ type: Transaction['type']; expenseEffect: Transaction['expenseEffect']; amountMinor: number; accountingDate: string; count: number }>(`
        SELECT type,expenseEffect,amountMinor,accountingDate,COUNT(*) AS count FROM "Transaction" WHERE accountingDate>=? AND accountingDate<=? AND type<>'transfer'
        GROUP BY type,expenseEffect,amountMinor,accountingDate`, `${month}-01`, `${month}-31`);
      const result: MonthSummary = { incomeMinor: 0n, expenseMinor: 0n, days: {} };
      let processed = 0;
      for (const row of groups) {
        if (!Number.isSafeInteger(row.count)) throw new AppError('AMOUNT_OUT_OF_RANGE');
        const amount = storedMinor(row.amountMinor) * BigInt(row.count);
        if (row.type === 'income') result.incomeMinor += amount;
        else result.expenseMinor += row.expenseEffect === 'refund' ? -amount : amount;
        result.days[row.accountingDate] = (result.days[row.accountingDate] ?? 0n) + (row.type === 'income' || row.expenseEffect === 'refund' ? amount : -amount);
        if (++processed % 128 === 0) await yieldTask();
      }
      return result;
}

function versionStamp(row: { updatedAtUtc: string } | null, expected: string | null, now: string): string {
  if (!row) throw new AppError('ENTITY_MISSING');
  if (row.updatedAtUtc !== expected) throw new AppError('STALE_WRITE');
  return new Date(Math.max(Date.parse(now), Date.parse(row.updatedAtUtc) + 1)).toISOString();
}

async function validateTargets(tx: SqlConnection, input: TransactionInput, old: Transaction | null) {
  const account = await tx.getFirstAsync<AccountRow>('SELECT * FROM Account WHERE id=?', uuidValue(input.accountId));
  if (!account || (account.isArchived && old?.accountId !== input.accountId)) throw new AppError('ACTIVE_ACCOUNT_REQUIRED');
  if (input.type === 'transfer') {
    if (input.categoryId !== null || !input.toAccountId || input.accountId === input.toAccountId) throw new AppError('TRANSFER_TARGET_REQUIRED');
    const target = await tx.getFirstAsync<AccountRow>('SELECT * FROM Account WHERE id=?', uuidValue(input.toAccountId));
    if (!target || (target.isArchived && old?.toAccountId !== input.toAccountId)) throw new AppError('TRANSFER_TARGET_REQUIRED');
  } else {
    if (!input.categoryId || input.toAccountId !== null) throw new AppError('MATCHING_CATEGORY_REQUIRED');
    const category = await tx.getFirstAsync<CategoryRow>('SELECT * FROM Category WHERE id=?', uuidValue(input.categoryId));
    if (!category || category.type !== input.type || (category.isArchived && old?.categoryId !== input.categoryId)) throw new AppError('MATCHING_CATEGORY_REQUIRED');
  }
}

async function references(tx: SqlConnection, kind: 'account' | 'category', id: string): Promise<ReferenceCounts> {
  const account = kind === 'account';
  const row = await tx.getFirstAsync<ReferenceCounts>(`SELECT
    (SELECT COUNT(*) FROM "Transaction" WHERE ${account ? 'accountId=? OR toAccountId=?' : 'categoryId=?'}) AS transactions,
    ${account ? '0' : '(SELECT COUNT(*) FROM Budget WHERE categoryId=?)'} AS budgets,
    (SELECT COUNT(*) FROM RecurringRuleRevision WHERE ${account ? 'payloadAccountId' : 'payloadCategoryId'}=?) AS revisions,
    (SELECT COUNT(*) FROM RecurringOccurrenceLedger WHERE ${account ? 'snapshotAccountId' : 'snapshotCategoryId'}=?) AS occurrences`,
  id, id, id, id);
  if (!row) throw new AppError('DATABASE_FAILURE');
  return row;
}
