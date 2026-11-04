// Generated from backup-v6.schema.json by scripts/generate-contracts.mjs.
export type RecurringPayload = {
  title: string;
  type: "income" | "expense";
  amountMinor: number;
  accountId: string;
  categoryId: string;
  note: string | null;
  weekdayMask: number;
  startDate: string;
  endDate: string | null;
  schedulingTimeZoneId: string;
  confirmBeforeAdding: boolean;
};

export type Account = {
  id: string;
  name: string;
  icon: string;
  openingBalanceMinor: number;
  isArchived: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type Category = {
  id: string;
  type: "income" | "expense";
  name: string;
  icon: string;
  isArchived: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type Transaction = {
  id: string;
  idempotencyToken: string;
  type: "income" | "expense" | "transfer";
  expenseEffect: "purchase" | "refund" | null;
  amountMinor: number;
  accountingDate: string;
  occurredAtUtc: string;
  createdTimeZoneId: string;
  createdUtcOffsetMinutes: number;
  note: string | null;
  accountId: string;
  categoryId: string | null;
  toAccountId: string | null;
  refundOfTransactionId: string | null;
  originOccurrenceId: string | null;
  originKind: "manual" | "recurring";
  originRuleTitleSnapshot: string | null;
  originScheduleSnapshot: RecurringPayload | null;
  originOccurrenceDate: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type Budget = {
  id: string;
  categoryId: string;
  month: string;
  limitMinor: number;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type PreferencesPortable = {
  currencySign: string;
  currencyPosition: "prefix" | "suffix";
  displayDecimalPlaces: 0 | 2;
  notesVisibleInList: boolean;
  uiMode: "system" | "light" | "dark";
  theme: "kwartracker";
  dailyReminderTime: string | null;
};

export type RecurringRule = {
  id: string;
  schedulingTimeZoneId: string;
  initialStartDate: string;
  evaluatedThroughDate: string;
  isPaused: boolean;
  deletedAtUtc: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
};

export type RecurringRuleRevision = {
  id: string;
  ruleId: string;
  revisionSequence: number;
  effectiveFromDate: string;
  payload: RecurringPayload;
  createdAtUtc: string;
};

export type RecurringPausePeriod = {
  id: string;
  ruleId: string;
  firstExcludedDate: string;
  firstIncludedDate: string | null;
};

export type RecurringOccurrenceLedger = {
  id: string;
  ruleId: string;
  ruleRevisionId: string;
  occurrenceDate: string;
  disposition: "deferred_backlog" | "pending" | "confirmed" | "skipped_user" | "excluded_user" | "excluded_pause" | "skipped_target_archived" | "deleted_transaction" | "cancelled_rule_deleted";
  payloadSnapshot: RecurringPayload;
  amountOverrideMinor: number | null;
  transactionId: string | null;
  evaluatedAtUtc: string;
  resolvedAtUtc: string | null;
};

export type WriteReceipt = {
  operationToken: string;
  requestHash: string;
  operation: "create" | "edit" | "delete" | "archive" | "restore" | "confirm" | "generate_backlog" | "exclude_backlog" | "skip" | "pause" | "resume" | "remove";
  entityType: "account" | "category" | "transaction" | "budget" | "preferences" | "recurring_rule" | "recurring_occurrence" | "recurrence_batch";
  entityId: string;
  committedAtUtc: string;
};

export type PortableData = {
  Account: Account[];
  Category: Category[];
  Transaction: Transaction[];
  Budget: Budget[];
  PreferencesPortable: PreferencesPortable[];
  RecurringRule: RecurringRule[];
  RecurringRuleRevision: RecurringRuleRevision[];
  RecurringPausePeriod: RecurringPausePeriod[];
  RecurringOccurrenceLedger: RecurringOccurrenceLedger[];
  WriteReceipt: WriteReceipt[];
};
