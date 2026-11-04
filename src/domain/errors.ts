export type ErrorCode =
  | 'INVALID_AMOUNT' | 'DIVISION_BY_ZERO' | 'INPUT_TOO_COMPLEX' | 'AMOUNT_OUT_OF_RANGE'
  | 'INVALID_DATE' | 'INVALID_TIME_ZONE' | 'NONEXISTENT_LOCAL_TIME' | 'AMBIGUOUS_LOCAL_TIME'
  | 'INSUFFICIENT_STORAGE' | 'DATABASE_BUSY' | 'DATABASE_CORRUPT' | 'DATABASE_UNSUPPORTED'
  | 'DATABASE_FAILURE' | 'RESTORE_IN_PROGRESS' | 'RECOVERY_REQUIRED' | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_COMMAND' | 'CANCELLED' | 'DEADLINE_EXCEEDED' | 'INJECTED_FAILURE' | 'PROBE_FAILED'
  | 'INVALID_NAME' | 'INVALID_NOTE' | 'ENTITY_MISSING' | 'ENTITY_REFERENCED' | 'STALE_WRITE'
  | 'ACTIVE_ACCOUNT_REQUIRED' | 'MATCHING_CATEGORY_REQUIRED' | 'TRANSFER_TARGET_REQUIRED'
  | 'CATEGORY_TYPE_FIXED' | 'RECURRING_ACTIVITY' | 'LINKED_REFUNDS' | 'UNSUPPORTED_EDIT'
  | 'REFUND_ORIGINAL_INVALID' | 'REFUND_EXCEEDS_PURCHASE' | 'BUDGET_EXISTS' | 'BUDGET_CATEGORY_REQUIRED' | 'INVALID_DATE_RANGE';

export class AppError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode) {
    super(code);
    this.name = 'AppError';
    this.code = code;
  }
}

export function databaseError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : '';
  if (/SQLITE_FULL|database or disk is full|not enough (?:disk )?space|ENOSPC/i.test(message)) {
    return new AppError('INSUFFICIENT_STORAGE');
  }
  if (/SQLITE_BUSY|SQLITE_LOCKED|database is locked/i.test(message)) return new AppError('DATABASE_BUSY');
  if (/SQLITE_CORRUPT|SQLITE_NOTADB|malformed|not a database/i.test(message)) return new AppError('DATABASE_CORRUPT');
  return new AppError('DATABASE_FAILURE');
}

export function errorMessage(error: unknown): string {
  const code = error instanceof AppError ? error.code : 'DATABASE_FAILURE';
  switch (code) {
    case 'INVALID_NAME': return 'Enter a name and icon with 1 to 120 characters.';
    case 'INVALID_NOTE': return 'Keep the note within 4,000 characters.';
    case 'ENTITY_MISSING': return 'This item is no longer available. Go back and choose another item.';
    case 'ENTITY_REFERENCED': return 'This item is used by saved records or schedules. Archive it to keep that history.';
    case 'STALE_WRITE': return 'This item changed after you opened it. Your input is kept. Go back and reopen the latest version before editing.';
    case 'ACTIVE_ACCOUNT_REQUIRED': return 'Choose an active account before saving.';
    case 'MATCHING_CATEGORY_REQUIRED': return 'Choose an active category that matches Income or Expense.';
    case 'TRANSFER_TARGET_REQUIRED': return 'Choose two different active accounts for the transfer.';
    case 'CATEGORY_TYPE_FIXED': return 'A category keeps its original type. Create a new category to use a different type.';
    case 'RECURRING_ACTIVITY': return 'This item has pending scheduled entries. Resolve them before archiving.';
    case 'LINKED_REFUNDS': return 'Linked refunds must be kept consistent. The purchase cannot be deleted or reduced below its refunds.';
    case 'REFUND_ORIGINAL_INVALID': return 'A refund needs its original purchase Expense and that purchase’s category. Reopen the purchase and choose Refund again.';
    case 'REFUND_EXCEEDS_PURCHASE': return 'Refunds for this purchase cannot add up to more than the purchase. Enter a smaller amount.';
    case 'BUDGET_EXISTS': return 'This category already has a Budget for this month. Edit that Budget instead.';
    case 'BUDGET_CATEGORY_REQUIRED': return 'Choose an active Expense category for this Budget.';
    case 'INVALID_DATE_RANGE': return 'Choose a From date on or before the To date.';
    case 'UNSUPPORTED_EDIT': return 'This entry needs its linked history controls, which are not available in this version.';
    case 'INVALID_AMOUNT': return 'Enter a valid amount greater than zero. Check the calculation before saving.';
    case 'DIVISION_BY_ZERO': return 'A calculation cannot divide by zero. Change the calculation before saving.';
    case 'INPUT_TOO_COMPLEX': return 'This calculation is too long or has too many nested brackets. Simplify it before saving.';
    case 'AMOUNT_OUT_OF_RANGE': return 'The amount is larger than the supported limit. Enter a smaller amount.';
    case 'INVALID_DATE': return 'Choose a valid date and time.';
    case 'INVALID_TIME_ZONE': return 'Choose a time zone supported by this device.';
    case 'NONEXISTENT_LOCAL_TIME': return 'This local time does not exist because the clocks change. Choose another time.';
    case 'AMBIGUOUS_LOCAL_TIME': return 'This local time occurs twice because the clocks change. Choose one of the displayed time offsets.';
    case 'INVALID_COMMAND': return 'Some values in this action are not supported. Review them before trying again.';
    case 'INSUFFICIENT_STORAGE': return 'Your device is low on storage. Free some space, then try again. Your previous data has been kept.';
    case 'DATABASE_BUSY': return 'Your data is in use. Wait for the current operation to finish, then try again.';
    case 'DATABASE_UNSUPPORTED': return 'This data needs a compatible version of Kwartracker. Your file has been kept. Open it with the compatible app before restoring or resetting.';
    case 'DATABASE_CORRUPT': return 'Your data could not be checked safely. Your file has been kept. Recovery with a supported backup or a confirmed reset is required.';
    case 'RECOVERY_REQUIRED': return 'Data recovery must finish before Kwartracker can open. Your files have been kept.';
    case 'RESTORE_IN_PROGRESS': return 'Data replacement is in progress. Wait for it to finish before making changes.';
    case 'IDEMPOTENCY_CONFLICT': return 'This action changed while it was being saved. Start a new action to continue.';
    case 'CANCELLED': return 'The operation was cancelled. No unfinished changes were saved.';
    case 'DEADLINE_EXCEEDED': return 'The operation took too long and stopped safely. Try again when your device is ready.';
    case 'PROBE_FAILED': return 'This synthetic check could not finish. Your financial data was not changed. Review the native test setup before trying again.';
    default: return 'Kwartracker could not open your data safely. Your file has been kept. You can try again.';
  }
}
