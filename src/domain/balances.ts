import { storedMinor } from './money.ts';
import { AppError } from './errors.ts';

export type BalanceTransaction = {
  type: 'income' | 'expense' | 'transfer'; expenseEffect: 'purchase' | 'refund' | null;
  amountMinor: number; accountId: string; toAccountId: string | null;
};

export function accountBalance(accountId: string, openingBalanceMinor: number, transactions: Iterable<BalanceTransaction>): bigint {
  let total = storedMinor(openingBalanceMinor, true);
  for (const transaction of transactions) {
    const amount = storedMinor(transaction.amountMinor);
    if (transaction.type === 'transfer') {
      if (!transaction.toAccountId || transaction.toAccountId === transaction.accountId || transaction.expenseEffect !== null) throw new AppError('INVALID_COMMAND');
      if (transaction.accountId === accountId) total -= amount;
      if (transaction.toAccountId === accountId) total += amount;
    } else {
      if (transaction.toAccountId !== null || (transaction.type === 'income' ? transaction.expenseEffect !== null : !transaction.expenseEffect)) throw new AppError('INVALID_COMMAND');
      if (transaction.accountId === accountId) total += transaction.type === 'income' || transaction.expenseEffect === 'refund' ? amount : -amount;
    }
  }
  return total;
}
