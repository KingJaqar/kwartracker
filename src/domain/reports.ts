import { roundHalfUp } from './money.ts';

/**
 * FR-ANA-002 chart: only positive net-Expense categories, in the given ranked order. Each share is
 * positiveCategoryNet / sumOfPositiveCategoryNets x 100, rounded half-up once to one decimal (in tenths of a percent).
 */
export function chartShares<T extends { netMinor: bigint }>(ranked: readonly T[]): { row: T; tenths: bigint }[] {
  const positive = ranked.filter(row => row.netMinor > 0n);
  const total = positive.reduce((sum, row) => sum + row.netMinor, 0n);
  return positive.map(row => ({ row, tenths: roundHalfUp(row.netMinor * 1000n, total) }));
}

export function shareLabel(tenths: bigint): string { return `${tenths / 10n}.${tenths % 10n}%`; }

export type BudgetState = 'net_refund' | 'within' | 'reached' | 'over';
/** FR-BUD-003: signed spent is never clamped; the bar fraction is display-only from 0 to 1. */
export function budgetStatus(limitMinor: bigint, spentMinor: bigint): { state: BudgetState; remainingMinor: bigint; fraction: number } {
  const remainingMinor = limitMinor - spentMinor;
  if (spentMinor < 0n) return { state: 'net_refund', remainingMinor, fraction: 0 };
  if (spentMinor > limitMinor) return { state: 'over', remainingMinor, fraction: 1 };
  if (spentMinor === limitMinor) return { state: 'reached', remainingMinor, fraction: 1 };
  return { state: 'within', remainingMinor, fraction: Number(roundHalfUp(spentMinor * 1000n, limitMinor)) / 1000 };
}
