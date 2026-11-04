import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import { canonicalJson, type CanonicalValue } from '../../src/domain/canonical.ts';
import type { PortableData, RecurringPayload, Transaction } from '../../src/domain/portable.ts';

export const PERF_SEED = 'kwartracker-perf-01-v1';
const uuid = (kind: number, index: number) => `${kind.toString(16).padStart(8, '0')}-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
const timestamp = '2026-10-01T00:00:00.000Z';
const hash = (text: string) => bytesToHex(sha256(utf8ToBytes(text)));

/** Pure, fixed synthetic data. No device IDs, credentials, clock or Math.random inputs. */
export function generatePerfFixture(): { data: PortableData; seed: string; seedHash: string } {
  const data: PortableData = {
    Account: Array.from({ length: 500 }, (_, i) => ({ id: uuid(1, i), name: `Synthetic account ${i}`, icon: 'wallet', openingBalanceMinor: i % 2 ? -50000 : 50000, isArchived: i >= 490, createdAtUtc: timestamp, updatedAtUtc: timestamp })),
    Category: Array.from({ length: 200 }, (_, i) => ({ id: uuid(2, i), name: `Synthetic category ${i}`, type: i < 100 ? 'expense' : 'income', icon: i < 100 ? 'food' : 'salary', isArchived: i >= 195, createdAtUtc: timestamp, updatedAtUtc: timestamp })),
    Transaction: [], Budget: [], RecurringRule: [], RecurringRuleRevision: [], RecurringPausePeriod: [], RecurringOccurrenceLedger: [], WriteReceipt: [],
    PreferencesPortable: [{ currencySign: '₱', currencyPosition: 'prefix', displayDecimalPlaces: 2, notesVisibleInList: true, uiMode: 'system', theme: 'kwartracker', dailyReminderTime: null }],
  };
  for (let i = 0; i < 10000; i++) {
    const income = i % 3 === 0;
    const monthIndex = i % 36;
    const date = `${2023 + Math.floor(monthIndex / 12)}-${(monthIndex % 12 + 1).toString().padStart(2, '0')}-${(i % 28 + 1).toString().padStart(2, '0')}`;
    const transaction: Transaction = {
      id: uuid(3, i), idempotencyToken: uuid(4, i), type: income ? 'income' : 'expense', expenseEffect: income ? null : 'purchase',
      amountMinor: 1 + (i * 7919 % 1000000), accountingDate: date, occurredAtUtc: `${date}T04:00:00.000Z`,
      createdTimeZoneId: 'Asia/Manila', createdUtcOffsetMinutes: 480, note: null,
      accountId: uuid(1, i % 500), categoryId: uuid(2, (income ? 100 : 0) + i % 100), toAccountId: null, refundOfTransactionId: null,
      originOccurrenceId: null, originKind: 'manual', originRuleTitleSnapshot: null, originScheduleSnapshot: null, originOccurrenceDate: null,
      createdAtUtc: timestamp, updatedAtUtc: timestamp,
    };
    data.Transaction.push(transaction);
    const { createdAtUtc: _created, updatedAtUtc: _updated, ...input } = transaction;
    data.WriteReceipt.push({ operationToken: transaction.idempotencyToken, requestHash: hash(canonicalJson({ operation: 'create', entityType: 'transaction', entityId: transaction.id, input } as CanonicalValue)), operation: 'create', entityType: 'transaction', entityId: transaction.id, committedAtUtc: timestamp });
  }
  for (let i = 0; i < 120; i++) data.Budget.push({ id: uuid(5, i), categoryId: uuid(2, i % 10), month: `2025-${(Math.floor(i / 10) + 1).toString().padStart(2, '0')}`, limitMinor: 50000, createdAtUtc: timestamp, updatedAtUtc: timestamp });
  for (let i = 0; i < 50; i++) {
    const ruleId = uuid(6, i);
    const payload: RecurringPayload = { title: `Synthetic rule ${i}`, type: 'expense', amountMinor: 15000, accountId: uuid(1, i), categoryId: uuid(2, i), note: null, weekdayMask: 127, startDate: '2026-09-01', endDate: null, schedulingTimeZoneId: 'Asia/Manila', confirmBeforeAdding: true };
    data.RecurringRule.push({ id: ruleId, schedulingTimeZoneId: 'Asia/Manila', initialStartDate: payload.startDate, evaluatedThroughDate: '2026-09-10', isPaused: false, deletedAtUtc: null, createdAtUtc: timestamp, updatedAtUtc: timestamp });
    data.RecurringRuleRevision.push({ id: uuid(7, i), ruleId, revisionSequence: 1, effectiveFromDate: payload.startDate, payload, createdAtUtc: timestamp });
    for (let day = 1; day <= 10; day++) data.RecurringOccurrenceLedger.push({
      id: uuid(8, i * 10 + day), ruleId, ruleRevisionId: uuid(7, i), occurrenceDate: `2026-09-${day.toString().padStart(2, '0')}`,
      disposition: day % 2 ? 'pending' : 'deferred_backlog', payloadSnapshot: payload, amountOverrideMinor: null, transactionId: null, evaluatedAtUtc: timestamp, resolvedAtUtc: null,
    });
  }
  return { data, seed: PERF_SEED, seedHash: hash(canonicalJson(data as unknown as CanonicalValue)) };
}
