import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountFromExpression, evaluateExpression, formatMoney, safeInteger, storedMinor } from '../src/domain/money.ts';
import { accountBalance } from '../src/domain/balances.ts';
import { accountingDate, captureCreationMetadata, localTimeCandidates, resolveAccountingTime } from '../src/domain/dates.ts';
import { canonicalJson } from '../src/domain/canonical.ts';
import { databaseError, errorMessage, AppError } from '../src/domain/errors.ts';
import { categoryColor, resolveAppearance } from '../src/theme/appearance.ts';

test('BR-05/06 exact rational arithmetic and one half-up write boundary', () => {
  for (const [expression, expected] of [['1.005', 101n], ['1/3', 33n], ['(0.1+0.2)*10', 300n], ['10−2×3', 400n], ['.5+1.', 150n], ['10000000000', 1000000000000n]] as const) {
    assert.equal(amountFromExpression(expression), expected, expression);
  }
  assert.equal(amountFromExpression('-1.005', { openingBalance: true }), -101n);
  assert.equal(amountFromExpression('0', { openingBalance: true }), 0n);
  assert.equal(amountFromExpression('1,005', { decimalSeparator: ',' }), 101n);
  assert.equal(amountFromExpression('1٫005', { decimalSeparator: '٫' }), 101n);
  assert.deepEqual(evaluateExpression('1/3+2/3'), { numerator: 1n, denominator: 1n });
});

test('FR-TRN-003 malformed, zero, negative, divide-by-zero, complexity and overflow reject', () => {
  for (const input of ['', '0.004', '-1', '1−2', '1/0', '1e3', '1,000', '1 2', '1..2', '()', '2(3)', '10000000000.005', '.']) {
    assert.throws(() => amountFromExpression(input), AppError, input);
  }
  assert.throws(() => evaluateExpression('1'.repeat(257)), { code: 'INPUT_TOO_COMPLEX' });
  assert.throws(() => evaluateExpression('('.repeat(17) + '1' + ')'.repeat(17)), { code: 'INPUT_TOO_COMPLEX' });
  assert.equal(amountFromExpression('('.repeat(16) + '1' + ')'.repeat(16)), 100n);
  assert.throws(() => storedMinor(Number.MAX_SAFE_INTEGER + 1));
  assert.throws(() => storedMinor(0));
  assert.throws(() => storedMinor(1.5));
  assert.throws(() => safeInteger(9007199254740992n));
});

test('BR-07 display 2→0→2 preserves scale-2 money, signed half ties and unbounded totals', () => {
  const preferences = { currencySign: '₱', currencyPosition: 'prefix', displayDecimalPlaces: 2 } as const;
  assert.equal(formatMoney(1234n, preferences), '₱12.34');
  assert.equal(formatMoney(1234n, { ...preferences, displayDecimalPlaces: 0 }), '₱12');
  assert.equal(formatMoney(1234n, preferences), '₱12.34');
  assert.equal(formatMoney(-150n, { ...preferences, displayDecimalPlaces: 0 }), '₱−2');
  assert.equal(formatMoney(900719925474099300n, preferences), '₱9007199254740993.00');
  assert.equal(formatMoney(1234n, { ...preferences, currencyPosition: 'suffix' }, ','), '12,34₱');
});

test('BR-02/03 account effects include refunds and both transfer sides; no archive filter', () => {
  const rows = [
    { type: 'income', expenseEffect: null, amountMinor: 5000, accountId: 'a', toAccountId: null },
    { type: 'expense', expenseEffect: 'purchase', amountMinor: 1000, accountId: 'a', toAccountId: null },
    { type: 'expense', expenseEffect: 'refund', amountMinor: 300, accountId: 'a', toAccountId: null },
    { type: 'transfer', expenseEffect: null, amountMinor: 500, accountId: 'a', toAccountId: 'b' },
  ] as const;
  assert.equal(accountBalance('a', -100, rows), 3700n);
  assert.equal(accountBalance('b', 0, rows), 500n);
  assert.equal(accountBalance('a', 0, Array.from({ length: 10000 }, () => ({ ...rows[0], amountMinor: 1000000000000 }))), 10000000000000000n);
});

test('BR-08/FR-TRN-005 local noon, travel stability, leap date, DST gap/fold and explicit offsets', () => {
  const saved = resolveAccountingTime('2026-10-24', 'Asia/Manila');
  assert.equal(saved.occurredAtUtc, '2026-10-24T04:00:00.000Z');
  assert.equal(saved.utcOffsetMinutes, 480);
  assert.equal(captureCreationMetadata('2026-10-24T00:00:00.000Z', 'Asia/Manila').createdUtcOffsetMinutes, 480);
  assert.equal(saved.accountingDate, '2026-10-24');
  assert.equal(accountingDate('2024-02-29'), '2024-02-29');
  assert.throws(() => accountingDate('2025-02-29'));
  assert.throws(() => accountingDate('1900-01-01'));
  assert.throws(() => resolveAccountingTime('2026-03-08', 'America/New_York', '02:30'), { code: 'NONEXISTENT_LOCAL_TIME' });
  assert.equal(localTimeCandidates('2026-11-01', 'America/New_York', '01:30').length, 2);
  assert.throws(() => resolveAccountingTime('2026-11-01', 'America/New_York', '01:30'), { code: 'AMBIGUOUS_LOCAL_TIME' });
  assert.equal(resolveAccountingTime('2026-11-01', 'America/New_York', '01:30', -300).occurredAtUtc, '2026-11-01T06:30:00.000Z');
  assert.throws(() => resolveAccountingTime('2026-11-01', 'America/New_York', '01:30', 480));
  assert.throws(() => resolveAccountingTime('2026-10-24', 'Unknown/Zone'), { code: 'INVALID_TIME_ZONE' });
  assert.throws(() => resolveAccountingTime('2026-10-24', ''), { code: 'INVALID_TIME_ZONE' });
  assert.throws(() => resolveAccountingTime('2026-10-24', '+08:00'), { code: 'INVALID_TIME_ZONE' });
  const creation = captureCreationMetadata('2026-10-24T00:00:00.000Z', 'America/New_York');
  assert.equal(creation.createdUtcOffsetMinutes, -240);
  assert.equal(resolveAccountingTime('2026-11-01', 'America/New_York', '01:30', -300).utcOffsetMinutes, -300);
  assert.equal(creation.createdUtcOffsetMinutes, -240);
  assert.equal(resolveAccountingTime('1900-01-02', 'Europe/Paris').occurredAtUtc, '1900-01-02T11:50:39.000Z');
});

test('canonical commands sort ASCII keys and preserve Unicode; reject unsafe integer/ill-formed strings', () => {
  assert.equal(canonicalJson({ z: null, a: ['₱', true, 123] }), '{"a":["₱",true,123],"z":null}');
  assert.throws(() => canonicalJson(1.5));
  assert.throws(() => canonicalJson('\ud800'));
  assert.throws(() => canonicalJson({ 'é': 1 }));
  const circular: { self?: import('../src/domain/canonical.ts').CanonicalValue } = {};
  circular.self = circular as import('../src/domain/canonical.ts').CanonicalValue;
  assert.throws(() => canonicalJson(circular as import('../src/domain/canonical.ts').CanonicalValue));
});

test('typed storage diagnostics never expose native exception strings to users', () => {
  assert.equal(databaseError(new Error('SQLITE_FULL: private note')).code, 'INSUFFICIENT_STORAGE');
  assert.equal(databaseError(new Error('database is locked')).code, 'DATABASE_BUSY');
  assert.equal(databaseError(new Error('file is not a database')).code, 'DATABASE_CORRUPT');
  assert.doesNotMatch(errorMessage(new Error('private note or SQL')), /SQL|private note/);
});

test('FR-DSN-001 appearance fallback and stable category identity', () => {
  assert.equal(resolveAppearance('light', 'dark'), 'light');
  assert.equal(resolveAppearance('system', 'dark'), 'dark');
  assert.equal(resolveAppearance('damaged', 'unspecified'), 'light');
  assert.equal(categoryColor('0000000b-0000-4000-8000-000000000000', 'dark'), '#DF3AA8');
});
