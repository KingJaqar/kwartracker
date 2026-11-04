export const APP_SCHEMA_VERSION = 1;
export const PORTABLE_BACKUP_VERSION = 6;

const money = 'INTEGER NOT NULL CHECK (typeof(amountMinor) = \'integer\' AND amountMinor BETWEEN 1 AND 1000000000000)';
const payload = `TEXT NOT NULL CHECK (json_valid(payload)),
  payloadAccountId TEXT NOT NULL REFERENCES Account(id) ON DELETE RESTRICT CHECK (COALESCE(payloadAccountId = json_extract(payload, '$.accountId'),0)),
  payloadCategoryId TEXT NOT NULL REFERENCES Category(id) ON DELETE RESTRICT CHECK (COALESCE(payloadCategoryId = json_extract(payload, '$.categoryId'),0))`;

/** App schema 1 stores the v6 entities; payload references are constrained local projections. */
export const SCHEMA_SQL = `
CREATE TABLE Account (
  id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  icon TEXT NOT NULL CHECK(length(icon) BETWEEN 1 AND 120),
  openingBalanceMinor INTEGER NOT NULL CHECK(typeof(openingBalanceMinor) = 'integer' AND openingBalanceMinor BETWEEN -1000000000000 AND 1000000000000),
  isArchived INTEGER NOT NULL CHECK(isArchived IN (0,1)), createdAtUtc TEXT NOT NULL, updatedAtUtc TEXT NOT NULL
);
CREATE TABLE Category (
  id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL CHECK(type IN ('income','expense')),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120), icon TEXT NOT NULL CHECK(length(icon) BETWEEN 1 AND 120),
  isArchived INTEGER NOT NULL CHECK(isArchived IN (0,1)), createdAtUtc TEXT NOT NULL, updatedAtUtc TEXT NOT NULL
);
CREATE TABLE WriteReceipt (
  operationToken TEXT PRIMARY KEY NOT NULL, requestHash TEXT NOT NULL CHECK(length(requestHash)=64),
  operation TEXT NOT NULL CHECK(operation IN ('create','edit','delete','archive','restore','confirm','generate_backlog','exclude_backlog','skip','pause','resume','remove')),
  entityType TEXT NOT NULL CHECK(entityType IN ('account','category','transaction','budget','preferences','recurring_rule','recurring_occurrence','recurrence_batch')),
  entityId TEXT NOT NULL, committedAtUtc TEXT NOT NULL
);
CREATE TABLE PreferencesPortable (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1), currencySign TEXT NOT NULL CHECK(length(currencySign) BETWEEN 1 AND 12),
  currencyPosition TEXT NOT NULL CHECK(currencyPosition IN ('prefix','suffix')),
  displayDecimalPlaces INTEGER NOT NULL CHECK(displayDecimalPlaces IN (0,2)),
  notesVisibleInList INTEGER NOT NULL CHECK(notesVisibleInList IN (0,1)),
  uiMode TEXT NOT NULL, theme TEXT NOT NULL, dailyReminderTime TEXT
);
INSERT INTO PreferencesPortable VALUES(1,'₱','prefix',2,1,'system','kwartracker',NULL);
CREATE TABLE Budget (
  id TEXT PRIMARY KEY NOT NULL, categoryId TEXT NOT NULL REFERENCES Category(id) ON DELETE RESTRICT,
  month TEXT NOT NULL CHECK(length(month)=7),
  limitMinor INTEGER NOT NULL CHECK(typeof(limitMinor)='integer' AND limitMinor BETWEEN 1 AND 1000000000000),
  createdAtUtc TEXT NOT NULL, updatedAtUtc TEXT NOT NULL, UNIQUE(categoryId,month)
);
CREATE TABLE RecurringRule (
  id TEXT PRIMARY KEY NOT NULL, schedulingTimeZoneId TEXT NOT NULL,
  initialStartDate TEXT NOT NULL, evaluatedThroughDate TEXT NOT NULL,
  isPaused INTEGER NOT NULL CHECK(isPaused IN (0,1)), deletedAtUtc TEXT,
  createdAtUtc TEXT NOT NULL, updatedAtUtc TEXT NOT NULL
);
CREATE TABLE RecurringRuleRevision (
  id TEXT PRIMARY KEY NOT NULL, ruleId TEXT NOT NULL REFERENCES RecurringRule(id) ON DELETE RESTRICT,
  revisionSequence INTEGER NOT NULL CHECK(revisionSequence BETWEEN 1 AND 2147483647),
  effectiveFromDate TEXT NOT NULL, payload ${payload}, createdAtUtc TEXT NOT NULL,
  UNIQUE(ruleId,revisionSequence)
);
CREATE TABLE RecurringPausePeriod (
  id TEXT PRIMARY KEY NOT NULL, ruleId TEXT NOT NULL REFERENCES RecurringRule(id) ON DELETE RESTRICT,
  firstExcludedDate TEXT NOT NULL, firstIncludedDate TEXT,
  CHECK(firstIncludedDate IS NULL OR firstIncludedDate >= firstExcludedDate)
);
CREATE TABLE RecurringOccurrenceLedger (
  id TEXT PRIMARY KEY NOT NULL, ruleId TEXT NOT NULL REFERENCES RecurringRule(id) ON DELETE RESTRICT,
  ruleRevisionId TEXT NOT NULL REFERENCES RecurringRuleRevision(id) ON DELETE RESTRICT,
  occurrenceDate TEXT NOT NULL,
  disposition TEXT NOT NULL CHECK(disposition IN ('deferred_backlog','pending','confirmed','skipped_user','excluded_user','excluded_pause','skipped_target_archived','deleted_transaction','cancelled_rule_deleted')),
  payloadSnapshot TEXT NOT NULL CHECK(json_valid(payloadSnapshot)),
  snapshotAccountId TEXT NOT NULL REFERENCES Account(id) ON DELETE RESTRICT,
  snapshotCategoryId TEXT NOT NULL REFERENCES Category(id) ON DELETE RESTRICT,
  amountOverrideMinor INTEGER CHECK(amountOverrideMinor IS NULL OR (typeof(amountOverrideMinor)='integer' AND amountOverrideMinor BETWEEN 1 AND 1000000000000)),
  transactionId TEXT UNIQUE REFERENCES "Transaction"(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  evaluatedAtUtc TEXT NOT NULL, resolvedAtUtc TEXT,
  UNIQUE(ruleId,occurrenceDate),
  CHECK(COALESCE(snapshotAccountId=json_extract(payloadSnapshot,'$.accountId'),0)),
  CHECK(COALESCE(snapshotCategoryId=json_extract(payloadSnapshot,'$.categoryId'),0)),
  CHECK((disposition='confirmed')=(transactionId IS NOT NULL)),
  CHECK((disposition IN ('pending','deferred_backlog'))=(resolvedAtUtc IS NULL))
);
CREATE TABLE "Transaction" (
  id TEXT PRIMARY KEY NOT NULL, idempotencyToken TEXT NOT NULL UNIQUE REFERENCES WriteReceipt(operationToken) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  type TEXT NOT NULL CHECK(type IN ('income','expense','transfer')),
  expenseEffect TEXT CHECK(expenseEffect IN ('purchase','refund')), amountMinor ${money},
  accountingDate TEXT NOT NULL CHECK(length(accountingDate)=10), occurredAtUtc TEXT NOT NULL,
  createdTimeZoneId TEXT NOT NULL, createdUtcOffsetMinutes INTEGER NOT NULL CHECK(createdUtcOffsetMinutes BETWEEN -840 AND 840),
  note TEXT CHECK(note IS NULL OR length(note)<=4000),
  accountId TEXT NOT NULL REFERENCES Account(id) ON DELETE RESTRICT,
  categoryId TEXT REFERENCES Category(id) ON DELETE RESTRICT,
  toAccountId TEXT REFERENCES Account(id) ON DELETE RESTRICT,
  refundOfTransactionId TEXT REFERENCES "Transaction"(id) ON DELETE RESTRICT,
  originOccurrenceId TEXT UNIQUE REFERENCES RecurringOccurrenceLedger(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED,
  originKind TEXT NOT NULL CHECK(originKind IN ('manual','recurring')),
  originRuleTitleSnapshot TEXT, originScheduleSnapshot TEXT CHECK(originScheduleSnapshot IS NULL OR json_valid(originScheduleSnapshot)),
  originOccurrenceDate TEXT, createdAtUtc TEXT NOT NULL, updatedAtUtc TEXT NOT NULL,
  CHECK((type='expense' AND expenseEffect IS NOT NULL) OR (type<>'expense' AND expenseEffect IS NULL)),
  CHECK((type='transfer' AND toAccountId IS NOT NULL AND toAccountId<>accountId AND categoryId IS NULL)
     OR (type<>'transfer' AND toAccountId IS NULL AND categoryId IS NOT NULL)),
  CHECK((expenseEffect IS NOT NULL AND expenseEffect='refund' AND refundOfTransactionId IS NOT NULL AND originKind='manual')
     OR ((expenseEffect IS NULL OR expenseEffect='purchase') AND refundOfTransactionId IS NULL)),
  CHECK((originKind='manual' AND originOccurrenceId IS NULL AND originRuleTitleSnapshot IS NULL AND originScheduleSnapshot IS NULL AND originOccurrenceDate IS NULL)
     OR (originKind='recurring' AND type<>'transfer' AND originOccurrenceId IS NOT NULL AND originRuleTitleSnapshot IS NOT NULL AND originScheduleSnapshot IS NOT NULL AND originOccurrenceDate IS NOT NULL))
);
CREATE INDEX transaction_records_page ON "Transaction"(accountingDate DESC,occurredAtUtc DESC,id DESC);
CREATE INDEX transaction_account ON "Transaction"(accountId);
CREATE INDEX transaction_destination ON "Transaction"(toAccountId);
CREATE INDEX transaction_refund ON "Transaction"(refundOfTransactionId);
CREATE INDEX transaction_category_date ON "Transaction"(categoryId,accountingDate);
CREATE INDEX revision_effective ON RecurringRuleRevision(ruleId,effectiveFromDate,revisionSequence);
CREATE INDEX occurrence_disposition ON RecurringOccurrenceLedger(disposition,occurrenceDate);
CREATE TRIGGER category_type_immutable BEFORE UPDATE OF type ON Category
WHEN OLD.type<>NEW.type BEGIN SELECT RAISE(ABORT,'CATEGORY_TYPE_IMMUTABLE'); END;
CREATE TRIGGER receipt_immutable BEFORE UPDATE ON WriteReceipt
BEGIN SELECT RAISE(ABORT,'RECEIPT_IMMUTABLE'); END;
CREATE TRIGGER revision_immutable BEFORE UPDATE ON RecurringRuleRevision
BEGIN SELECT RAISE(ABORT,'REVISION_IMMUTABLE'); END;
`;
