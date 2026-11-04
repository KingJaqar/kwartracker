import { accountingDate } from './dates.ts';
import { AppError } from './errors.ts';
import { formatMoney, type MoneyPreferences } from './money.ts';
import type { Transaction } from './portable.ts';

export function uuidValue(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) throw new AppError('INVALID_COMMAND');
  return value;
}

export function shortText(value: string): string {
  const result = value.trim();
  if (!result || [...result].length > 120) throw new AppError('INVALID_NAME');
  return result;
}

export function monthValue(value: string): string {
  if (!/^\d{4}-\d{2}$/.test(value)) throw new AppError('INVALID_DATE');
  accountingDate(`${value}-15`);
  return value;
}

export function localDate(value = new Date()): string {
  return `${value.getFullYear().toString().padStart(4, '0')}-${(value.getMonth() + 1).toString().padStart(2, '0')}-${value.getDate().toString().padStart(2, '0')}`;
}

export function shiftedMonth(value: string, delta: -1 | 1): string {
  monthValue(value);
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5));
  const next = new Date(0);
  next.setUTCFullYear(year, month - 1 + delta, 15);
  return monthValue(next.toISOString().slice(0, 7));
}

export function minorExpression(value: number): string {
  const minor = BigInt(value);
  const magnitude = minor < 0n ? -minor : minor;
  return `${minor < 0n ? '-' : ''}${magnitude / 100n}.${(magnitude % 100n).toString().padStart(2, '0')}`;
}

export function transactionAmount(value: bigint, type: Transaction['type'], effect: Transaction['expenseEffect'], preferences: MoneyPreferences, separator = '.'): string {
  const prefix = type === 'income' || effect === 'refund' ? '+' : type === 'expense' ? '−' : '';
  return `${prefix}${formatMoney(value, preferences, separator)}`;
}

export function decimalSeparator(): string {
  return new globalThis.Intl.NumberFormat(undefined).formatToParts(1.1).find(part => part.type === 'decimal')?.value ?? '.';
}
