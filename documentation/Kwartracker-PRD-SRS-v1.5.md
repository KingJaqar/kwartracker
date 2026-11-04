# Kwartracker — Product Requirements Document & Software Requirements Specification

**Product:** Kwartracker — offline-first personal expense tracker for iOS and Android

**Document type:** Combined PRD/SRS and release-acceptance baseline

**Version:** 1.5

**Date:** 2026-09-24

**Status:** **Approved MVP baseline**

**Implementation baseline:** Expo SDK 57 (`expo ~57.0.24`), React Native 0.86, TypeScript, Expo Router

Version 1.5 resolves every MVP decision that remained open in v1.3 and the four product/release risks identified after v1.4: recoverable capped recurrence, executable verification ownership, reference-device lifecycle, and true Expense-refund accounting. The product, engineering, QA, security/privacy, and release obligations in this document are normative. The original source PDF, recurring-rules addendum, forensic review, older decision register, change log, and generation prompt were not located in the repository during this revision. They are therefore historical evidence only and are not required to interpret or implement this baseline. No claim in this document depends on their availability.

## Table of contents

- [0. Authority, evidence, and requirement language](#0-authority-evidence-and-requirement-language)
- [1. Document control](#1-document-control)
- [2. Product vision, objectives, and scope](#2-product-vision-objectives-and-scope)
- [3. Personas and use cases](#3-personas-and-use-cases)
- [4. Feature catalogue](#4-feature-catalogue)
- [5. Business rules](#5-business-rules)
- [6. Information architecture and user experience](#6-information-architecture-and-user-experience)
- [7. Functional requirements](#7-functional-requirements)
- [8. Non-functional requirements](#8-non-functional-requirements)
- [9. Technical architecture](#9-technical-architecture)
- [10. Project structure](#10-project-structure)
- [11. Data model and storage](#11-data-model-and-storage)
- [12. Service boundaries and state transitions](#12-service-boundaries-and-state-transitions)
- [13. Validation and error handling](#13-validation-and-error-handling)
- [14. Security and privacy](#14-security-and-privacy)
- [15. Testing and verification](#15-testing-and-verification)
- [16. Release plan and gates](#16-release-plan-and-gates)
- [17. Traceability matrix](#17-traceability-matrix)
- [18. Decision resolution register](#18-decision-resolution-register)
- [19. Requirements change log](#19-requirements-change-log)
- [20. Final consistency audit](#20-final-consistency-audit)

## 0. Authority, evidence, and requirement language

This version is the authoritative MVP specification. The instruction to resolve all prior choices supplies the approval authority for the decisions recorded in Section 18. Requirements use the following statuses:

| Status | Meaning | Release effect |
|---|---|---|
| Approved MVP | Normative for the MVP; uses “shall,” “must,” or “must not” | Must be implemented and verified or the release is blocked |
| Confirmed source | Behavior retained from the source description and adopted into this baseline | Same effect as Approved MVP |
| Deferred | Non-normative Phase 2/3 work | No MVP implementation or release dependency |
| Out of scope | Explicitly excluded | No implementation or release dependency |
| Historical | Retained only to explain provenance or a superseded decision | No implementation or release dependency |

There are no Proposed, Assumption, Recommended, or Open Question statuses on the MVP critical path. External platform documentation establishes capability and constraints; it does not prove that the application implements a requirement correctly. Implementation evidence is supplied by the verification artifacts in Section 15.

In this document, **atomic** means that every listed database change occurs in one exclusive SQLite transaction and all changes commit or all roll back. **Durable** means the state survives app/process restart, participates in backup/restore when portable, and cannot disappear through a normal feature action except full Delete & Reset. **Supported backup** means exactly a schema/version accepted by the matrix in Section 11. **Eligible recurring date** means a date that falls within the applicable immutable rule revision, matches a selected weekday, and is not outside its inclusive start/end bounds; pause and target state determine its disposition rather than erasing its evaluation history.

## 1. Document control

| Field | Value |
|---|---|
| Document title | Kwartracker PRD/SRS v1.5 |
| Owner | Product Owner; requirement-quality stewardship by Product/Requirements Engineering |
| Approval | Approved MVP baseline by the authority of this revision request |
| Change control | A change to an Approved MVP objective, BR, FR, NFR, data contract, decision, test oracle, or release gate requires a version increment and corresponding updates to Sections 11, 15, 17, 18, 19, and 20 where affected. |
| Source status | v1.3 is the immediate predecessor. Referenced supporting artifacts were not located and are not treated as current authority. |
| Backup schema | `backupSchemaVersion = 5`; compatibility policy is defined in FR-BKP-010 and Section 11. |

### Revision history

- **v1.0–v1.3:** Historical drafts summarized in v1.3.
- **v1.4:** Resolves the independent review findings; approves the MVP decisions; introduces a durable recurring-occurrence ledger, immutable accounting dates, fixed-scale currency storage, safe staged restore, portable-versus-device-local preference rules, complete access-control and telemetry policies, reproducible performance criteria, complete verification artifacts, and corrected traceability.
- **v1.5:** Replaces irreversible recurrence-cap exclusion with a durable user-controlled backlog; defines linked Expense refunds and their account, Budget, Analysis, PDF, deletion, and restore behavior; assigns verification suites and cadence; adds reference-device review/replacement rules; and increments the backup schema to v5.

## 2. Product vision, objectives, and scope

### Vision

Kwartracker is a private, offline-first personal finance tracker for people who want manual control over income, expenses, transfers, budgets, and recurring entries without an account, cloud service, subscription, or network dependency for core use.

### Approved objectives

| ID | Objective and measurement |
|---|---|
| O1 | A returning user with an existing account and category and the last-used transaction type selected shall record a simple Income or Expense in a median of 10 seconds or less over five scripted runs on each reference device. The measurement starts when the Records “+” control is activated and ends when the saved row appears. Amount digit/operator taps are counted separately; no more than five non-keypad control activations are permitted. |
| O2 | A user shall obtain current-month total Income, net Expense, and the largest positive net Expense category in no more than two screen views, without manual arithmetic. Results shall use only confirmed transactions and the immutable accounting date; Expense refunds shall reduce Expense rather than appear as Income. |
| O3 | Core data shall remain on-device unless the user explicitly initiates backup, PDF export, or opts into crash reporting. A user who forgets the app passcode can regain use by resetting local data and may recover financial data only from a valid, supported external backup. No recovery is promised when no usable backup exists. |
| O4 | Recurring rules shall reduce repeated entry without silently changing financial totals. Every evaluated eligible date shall acquire a durable disposition so repeated evaluation, deletion, edits, backup, and restore cannot recreate or omit an occurrence unintentionally. When more than 30 occurrences are due, older occurrences shall remain recoverable until the user explicitly generates or excludes them. |

### MVP scope

The MVP includes Records; Income, purchase Expense, linked Expense-refund, and Transfer entry/edit/delete; Accounts; Categories; monthly category Budgets; one Analysis overview; versioned backup and replace-only restore; PDF export; a six-digit app passcode; optional biometric unlock; local reset and restore recovery; preferences; one local daily reminder; the accessibility baseline; and weekday-based recurring rules evaluated while the app is active.

### Deferred scope

Phase 2: background recurrence using the current supported Expo background-task API at implementation time; CSV/XLSX export; extended analysis views; budget rollover; encrypted user-created backups; optional database encryption; and additional accessibility certification.

Phase 3: home-screen widgets, additional themes, and any Free/Pro entitlement. Widget design must be revalidated against the then-current Expo and platform APIs; no v1.5 requirement assumes that an extension can directly open the application database.

### Out of scope

Server or multi-device sync, collaborative budgets, bank linking, merge restore, in-widget transaction entry, cloud accounts, advertising, session replay, behavioral analytics, and any network dependency for core financial functions are out of scope.

## 3. Personas and use cases

Personas P1–P3 from v1.3 are approved planning aids: daily cash tracker, multi-account professional, and irregular-income earner. They do not create requirements beyond the following use cases.

| ID | Use case | Screens |
|---|---|---|
| UC-01 | Create an Income or Expense | SCR-01, SCR-05 |
| UC-02 | Create a Transfer | SCR-05, SCR-06 |
| UC-03 | Edit, refund, correct, or delete a transaction | SCR-01, SCR-05 |
| UC-04 | Create, edit, archive, restore, or delete an account | SCR-06 |
| UC-05 | Create, edit, archive, restore, or delete a category | SCR-07 |
| UC-06 | Create, edit, and monitor a monthly category budget | SCR-04 |
| UC-07 | Review totals and category analysis | SCR-01, SCR-02 |
| UC-08 | Create a portable backup | SCR-08 |
| UC-09 | Replace local data from a supported backup | SCR-08 |
| UC-10 | Export confirmed records to PDF | SCR-08 |
| UC-11 | Enroll, use, and recover from app lock | SCR-09, SCR-11 |
| UC-12 | Configure local preferences | SCR-09 |
| UC-13 | Configure and receive a local daily reminder | SCR-09, system UI |
| UC-14 | Create a weekday recurring rule | SCR-05, SCR-10 |
| UC-15 | Review pending and deferred-backlog recurring occurrences; explicitly generate or exclude backlog | SCR-10 |
| UC-16 | Pause, resume, edit, archive, restore, or permanently remove a recurring rule from active use | SCR-10 |
| UC-17 | Delete and reset local data, then optionally restore a supported backup | SCR-11, SCR-08 |

## 4. Feature catalogue

| Feature | MVP disposition | Governing references |
|---|---|---|
| Transactions, Expense refunds, and Transfers | Approved MVP | BR-01–BR-04, BR-23; FR-TRN |
| Accounts and Categories | Approved MVP | BR-08–BR-10; FR-ACC; FR-CAT |
| Monthly Budgets | Approved MVP | BR-11; FR-BUD |
| Analysis overview | Approved MVP | FR-ANA |
| Weekday recurring rules | Approved MVP, active-app evaluation only | BR-12–BR-17; FR-REC |
| Backup/replace restore | Approved MVP, schema v5 only | BR-18–BR-20; FR-BKP |
| PDF export | Approved MVP | FR-PDF |
| Passcode and biometrics | Approved MVP; access gate, not encryption | BR-21; FR-SEC |
| Daily local reminder | Approved MVP | FR-NOT |
| Opt-in crash reporting | Approved MVP; default OFF and allowlisted | BR-22; FR-PRV |
| Accessibility baseline | Approved MVP | NFR-07 |
| Search/filter, multi-currency, rollover, widgets, background recurrence, spreadsheet export, encryption, entitlement | Deferred or out of scope | Section 2 |

## 5. Business rules

| ID | Approved rule |
|---|---|
| BR-01 | A Transaction is exactly one of Income, Expense, or Transfer. An Expense has `expenseEffect = purchase` or `expenseEffect = refund`; other types have no expense effect. Every amount is a positive canonical integer; negative and zero amounts are invalid. |
| BR-02 | Income increases one account; a purchase Expense decreases one account; an Expense refund increases its receiving account; Transfer decreases one source and increases one distinct destination by the same amount. Transfer has no category and is excluded from Income/Expense aggregates. A refund is never counted as Income. |
| BR-03 | An account balance equals `openingBalanceMinor + confirmed Income - confirmed purchase Expense + confirmed Expense refunds + incoming Transfers - outgoing Transfers`. Archive state never changes this calculation. |
| BR-04 | Creation, edit, deletion, and recurrence confirmation of a Transfer shall update both account effects in one exclusive SQLite transaction. |
| BR-05 | The canonical MVP monetary unit is one hundredth of the configured currency unit (`scale = 2`). Every opening balance, transaction, budget, and recurring amount is stored as a signed-safe 64-bit integer count of that unit. The user-facing decimal display preference never changes stored values. |
| BR-06 | Valid arithmetic entry is evaluated with decimal arithmetic and rounded once, at the write boundary, to scale 2 using round-half-up. A result that is negative, zero, or rounds to zero is rejected. Stored integers are never rescaled when preferences change. |
| BR-07 | MVP currency sign and position are presentation settings. `displayDecimalPlaces` is limited to 0 or 2. At 0, display formatting rounds half-up for display only; changing 2→0→2 must reveal the original scale-2 value unchanged. |
| BR-08 | A transaction's `accountingDate` is an immutable local civil date (`YYYY-MM-DD`) chosen or derived when the transaction is created. Month/day grouping uses it and never recomputes it after a timezone change. `occurredAtUtc` is used only for ordering and audit metadata. |
| BR-09 | Archiving an account or category hides it from new-entry pickers but does not remove or exclude historical confirmed transactions from balances, Budgets, Analysis, Records, or export. Restoring it makes it selectable again without changing history. |
| BR-10 | An account/category may be hard-deleted only if no Transaction, Budget, RecurringRule tombstone/revision, or RecurringOccurrenceLedger row references it. Otherwise archive is the only allowed removal action. |
| BR-11 | A Budget is unique per Expense category and accounting month. It is non-rolling; an edit replaces that month’s limit without prorating and never modifies transactions. |
| BR-12 | Absence of a `(ruleId, occurrenceDate)` ledger row means the occurrence has never been evaluated. Every evaluated eligible date receives exactly one durable ledger row; the unique key prevents regeneration across app sessions and restore. |
| BR-13 | Recurring disposition is one of `deferred_backlog`, `pending`, `confirmed`, `skipped_user`, `excluded_user`, `excluded_pause`, `skipped_target_archived`, `deleted_transaction`, or `cancelled_rule_deleted`. Only `confirmed` has an accounting effect. `deferred_backlog` is recoverable and non-terminal; `excluded_user` is terminal and requires an explicit confirmed user action. |
| BR-14 | A pending occurrence stores an immutable payload snapshot and has no Transaction row. Confirmation creates exactly one confirmed Transaction and links it to the ledger row in the same transaction. Direct-confirm rules create the ledger row and Transaction atomically. |
| BR-15 | Deleting a recurring-generated Transaction atomically changes its ledger disposition from `confirmed` to `deleted_transaction` before removing the Transaction. The date must never regenerate. |
| BR-16 | Rule edits are prospective from the next date in the rule’s scheduling timezone. Past and current-date ledger rows and transactions are never rewritten. Versioned rule revisions determine which schedule applied to each date. |
| BR-17 | Removing a recurring rule from active use sets `deletedAtUtc` and retains a tombstone, revisions, pause periods, occurrence ledger, and transaction-origin snapshots. Pending and deferred-backlog rows become `cancelled_rule_deleted` atomically. Confirmed transactions remain unchanged. |
| BR-18 | Backup schema v5 contains every portable entity and integrity metadata. Device-local secrets, authentication-enabled flags, biometric state, notification permission, and telemetry consent/queue are excluded or normalized as specified by FR-BKP-003. |
| BR-19 | Restore is replace-only and uses a validated same-volume staged database plus a durable restore journal. Startup recovery exposes either the complete pre-restore dataset or the complete replacement dataset, never a mixture. |
| BR-20 | Only backup schema v5 is supported in MVP. Unverified v1–v4 or unknown versions are rejected without modifying local data. Earlier schema numbers appeared only in unreleased specification drafts and have no approved canonical fixture or migration contract. |
| BR-21 | The passcode is a six-digit app credential. The app passcode and enrolled biometrics are the only unlock methods. OS device-passcode fallback must be disabled for the biometric prompt. |
| BR-22 | Crash reporting is OFF by default and the SDK must not initialize or transmit before opt-in. Only the FR-PRV-002 allowlist may leave the device. |
| BR-23 | A refund is a confirmed Expense with `expenseEffect = refund` linked to one confirmed purchase Expense. It uses the original Expense category, credits a selected active receiving account on the refund's own immutable accounting date, reduces Expense/Budget totals for that date, and must not cause cumulative non-deleted refunds to exceed the original purchase amount. Refunds cannot originate from recurring rules. |

## 6. Information architecture and user experience

| ID | Screen | Required behavior |
|---|---|---|
| SCR-01 | Records | Date-grouped confirmed transactions and month summary; recurring-origin marker; archived entity names remain visible |
| SCR-02 | Analysis | Confirmed Income and net-Expense totals plus ranked positive net Expense-category chart for an inclusive custom accounting-date range; refund-only/negative category results remain visible in the list |
| SCR-03 | Expense Flow | Deferred |
| SCR-04 | Budgets | Month selection, unique per-category limits, spent/remaining, non-color over-limit indication |
| SCR-05 | Transaction Input | Income/Expense/Transfer, linked Expense-refund action, arithmetic keypad, validation, duplicate-safe Save, optional recurrence creation for purchases only |
| SCR-06 | Accounts | Balances, create/edit/archive/restore/delete subject to BR-10 |
| SCR-07 | Categories | Income/Expense lists, create/edit/archive/restore/delete subject to BR-10 |
| SCR-08 | Data Management | Backup, restore, PDF export, and authenticated Delete & Reset |
| SCR-09 | Preferences | Currency presentation, appearance, reminder, crash-report consent, passcode/biometric enrollment |
| SCR-10 | Recurring Rules | Rules, revisions, pending and deferred-backlog counts, backlog review/generate/exclude, pause/resume/edit/remove actions |
| SCR-11 | Lock and Recovery | App passcode/biometric unlock and unauthenticated Forgot passcode → Delete & Reset |
| SCR-12 | Restore Recovery | Pre-authentication recovery UI when a restore journal requires automatic completion or rollback; no financial UI is mounted until recovery finishes |

The bottom tab bar links Records, Analysis, Budgets, Accounts, and Categories. Records supplies the “+” entry control. A drawer exposes Preferences, Data Management, and Recurring Rules. Lock and database-recovery gates wrap the root navigator; SCR-11 and SCR-12 are root-stack screens, not tabs.

First launch seeds the approved categories Food, Transport, Bills, Shopping, Health, Salary, and Other, then guides the user to create an account. The user may edit/archive them under the normal rules.

## 7. Functional requirements

Every requirement in this section is Approved MVP unless its row explicitly says Deferred.

### FR-TRN — Transactions

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-TRN-001 | The app shall create Income, purchase Expense, linked Expense refund, and Transfer transactions using BR-01–BR-08 and BR-23. | P0 | TC-01–TC-04, TC-39–TC-41, TC-83–TC-85 |
| FR-TRN-002 | Income and purchase Expense shall require one active Account and a Category whose type matches the transaction type. An Expense refund shall require one active receiving Account and shall inherit its original purchase's Expense Category; that inherited historical Category may be archived. Transfer shall require two distinct active Accounts and no Category. | P0 | TC-01–TC-03, TC-40, TC-83/84 |
| FR-TRN-003 | Amount entry shall support digits, decimal separator, `+ − × ÷`, and parentheses. It shall reject malformed expressions, division by zero, negative results, zero, overflow, and values that round to zero. | P0 | TC-30, TC-39 |
| FR-TRN-004 | A transaction may contain a free-text note. Notes must not enter logs or telemetry. | P1 | TC-01, INS-PRV-01 |
| FR-TRN-005 | The user shall select an accounting date and optional time. Saving shall persist immutable `accountingDate`, `occurredAtUtc`, and the creation timezone identifier/offset. | P0 | TC-04, TC-42 |
| FR-TRN-006 | Duplicating a transaction shall create a new draft with a new idempotency token and clear all recurring-origin IDs/snapshots and refund links. A duplicated refund becomes an ordinary purchase Expense draft with the same amount; its category is prefilled only if still active and otherwise cleared, and the user must choose active paying account/category fields before saving. The saved duplicate is an ordinary confirmed transaction. | P1 | TC-14, TC-31, TC-84 |
| FR-TRN-007 | Transfer create/edit/delete shall satisfy BR-02 and BR-04 and shall not change Income/Expense/Budget totals. | P0 | TC-02, TC-07, TC-29 |
| FR-TRN-008 | Editing an Income or purchase Expense shall atomically remove the old balance/category effect and apply the validated new effect. While one or more refunds reference a purchase Expense, its type, `expenseEffect`, and category shall be immutable and its amount shall not be reduced below the sum of its non-deleted refunds. A refund edit may change only amount, receiving account, accounting date/time, and note; it must revalidate the cumulative-refund limit atomically. | P0 | TC-41, TC-84/85 |
| FR-TRN-009 | Deleting a manual transaction removes its accounting effect atomically. A purchase Expense with a non-deleted refund reference must not be deleted. Deleting a refund reverses its account and Expense/Budget effects and frees that amount for a later refund. Deleting a recurring transaction additionally performs BR-15. | P0 | TC-07, TC-44, TC-84/85 |
| FR-TRN-010 | The app shall reject negative monetary inputs. A refund shall be created only through the Refund action on a confirmed purchase Expense; it is a positive linked Expense refund under BR-23, not Income. At commit, the repository shall lock/read the original and its refunds and reject a zero, over-refund, deleted/unconfirmed original, non-purchase original, archived receiving account, or incompatible link without writing. Corrections other than refunds use edit or delete. A Transfer cannot be used as an Income/Expense correction. | P0 | TC-40/41, TC-83–TC-85 |
| FR-TRN-011 | Repository writes shall persist a unique client-generated idempotency token. Replaying a committed token, including after app restart, shall return the original result and create no additional row. | P0 | TC-28, TC-43 |
| FR-TRN-012 | Search and advanced filtering are Deferred. | P3 | Not applicable to MVP |

**Acceptance criteria:** Given ₱12.34 is stored as `1234`, changing display decimals 2→0 displays ₱12 without changing the database, and changing back to 2 displays ₱12.34. Given `0.004`, `-1`, `1−2`, or an Income paired with an Expense category, Save is rejected and no row is written. Given a ₱100 purchase and two refunds of ₱30 and ₱70, the account and net Expense results reflect ₱0 remaining purchase cost; a further refund is rejected. Given a rapid double-tap or restart/replay with the same token, exactly one transaction exists.

### FR-REC — Recurring rules and occurrence ledger

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-REC-001 | A rule shall create only Income or purchase Expense, never Transfer or refund, and shall store its type, positive scale-2 amount, compatible account/category fields, optional note, non-empty weekdays, inclusive start date, optional inclusive end date, scheduling IANA timezone ID, and `confirmBeforeAdding` default ON. | P0 | TC-16, TC-22, TC-40 |
| FR-REC-002 | Evaluation shall run after database recovery/migration and unlock on every cold launch, every background→foreground transition, and the first financial-screen focus after the rule timezone’s date changes while continuously foregrounded. Runs shall serialize; a second trigger joins or waits for the active run. | P0 | TC-45 |
| FR-REC-003 | For each rule revision, evaluation shall consider dates from the later of its effective date or the day after the rule cursor through `today` in that revision’s timezone, inclusive. It shall create one ledger disposition for every scheduled date and advance `evaluatedThroughDate` only in the same whole-pass transaction. Dates beyond the generation cap receive `deferred_backlog`, not an exclusion. | P0 | TC-16, TC-23, TC-46 |
| FR-REC-004 | At most the 30 most recent due, non-paused dates per rule may become `pending` or `confirmed` in one automatic pass. Every older due date in the evaluated interval shall receive a `deferred_backlog` row containing its immutable revision/payload snapshot. Reopening shall neither generate nor exclude that row. SCR-10 shall show a persistent backlog count and date range and provide: (a) **Generate next batch**, which atomically transitions up to the 30 oldest deferred rows to `pending` or to `confirmed` plus Transactions according to each snapshot; and (b) **Exclude**, which requires confirmation showing count/date range and transitions only the selected rows to terminal `excluded_user`. No bulk action may silently operate on a larger set than its confirmation names. | P0 | TC-16, TC-46, TC-82 |
| FR-REC-005 | With confirmation ON, due occurrences become `pending` ledger rows with immutable payload snapshots and no Transaction. The batch shall support confirm-all, confirm-one, edit-amount-then-confirm, and skip-one. Editing a pending amount changes only its snapshot before confirmation. | P0 | TC-23, TC-47 |
| FR-REC-006 | With confirmation OFF, each due occurrence and its confirmed Transaction shall be created atomically. A post-run summary shall report the count. | P1 | TC-48 |
| FR-REC-007 | Confirming a pending row shall atomically validate its snapshotted targets, create one confirmed Transaction dated per FR-REC-013, set `transactionId`, and change disposition to `confirmed`. Skipping changes it to `skipped_user`. | P0 | TC-23, TC-47 |
| FR-REC-008 | Pausing shall open a pause interval; resuming shall close it. The interval is `[firstExcludedDate, firstIncludedDate)`. Pause and resume on the same scheduling date creates an empty interval. Scheduled dates inside a non-empty interval receive `excluded_pause` when evaluated. | P0 | TC-17, TC-24, TC-49 |
| FR-REC-009 | Rule edits shall create an immutable revision effective on the next scheduling-date after the edit. Current and earlier dates use the prior revision. No previously evaluated occurrence is invalidated or rewritten in MVP; therefore `invalidated_edit` is not an MVP disposition. | P0 | TC-50 |
| FR-REC-010 | Archiving a referenced target shall warn with the affected rule/pending/backlog counts and, after confirmation, atomically pause each affected rule and change its pending and deferred-backlog rows to `skipped_target_archived`. Archived targets shall not receive new or confirmed recurring transactions. Unarchive does not resume the rule or rewrite terminal dispositions. | P0 | TC-18, TC-51 |
| FR-REC-011 | Removing a rule shall perform BR-17 in one exclusive transaction. The user shall see the exact pending and deferred-backlog counts that will become `cancelled_rule_deleted` and that historical financial records and terminal dispositions will be retained before confirmation. | P0 | TC-52 |
| FR-REC-012 | A confirmed recurring Transaction shall store immutable origin snapshots sufficient to display “Recurring,” the historical rule title/schedule, and occurrence date without reading an active rule. | P1 | TC-35, TC-52 |
| FR-REC-013 | `occurrenceDate` is the scheduled civil date in the applicable revision’s timezone. The generated Transaction uses that date as `accountingDate` and stores `occurredAtUtc` as local noon on that date converted to UTC. Budget allocation uses `accountingDate`. A later device-timezone change does not move it. | P0 | TC-42, TC-49 |
| FR-REC-014 | Deleting a generated Transaction shall perform BR-15; reopening, restoring, or editing the rule shall not regenerate that date. | P0 | TC-44, TC-53 |
| FR-REC-015 | A backup shall include rule tombstones, all revisions, pause intervals, ledger rows, origin snapshots, cursors, and links. Restore shall preserve every disposition and idempotency guarantee. | P0 | TC-53, TC-54 |
| FR-REC-016 | The complete recurrence evaluation pass across all rules shall be one exclusive SQLite transaction. Any validation, storage, or process failure before commit leaves all rule cursors, ledger rows, and Transactions at their pre-pass state. The next trigger retries the same dates safely. | P0 | TC-55, TC-56 |
| FR-REC-017 | Background recurrence is Deferred. Future implementation shall use the supported SDK API at that time and retain FR-REC-002 as fallback. | P3 | Not applicable to MVP |

**Acceptance criteria:** Given 40 missed eligible dates, the first run writes ten `deferred_backlog` and thirty pending/confirmed rows; a second automatic run writes none and the ten remain visible. Choosing Generate next batch transitions those ten exactly once; choosing Exclude instead requires confirmation and creates no Transactions. Given a confirmed generated row is deleted, its disposition becomes `deleted_transaction` and subsequent runs create no replacement. Given a rule is removed with confirmed, pending, deferred, skipped, and pause history, pending/deferred rows become `cancelled_rule_deleted`, confirmed financial rows remain with snapshots, all history restores successfully, and the rule never evaluates again.

### FR-ACC and FR-CAT — Accounts and categories

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-ACC-001 | The app shall create and edit accounts with name, icon, and scale-2 opening balance. Opening-balance edits affect the current computed balance but do not rewrite transactions. | P0 | TC-01, TC-38 |
| FR-ACC-002 | Account and All Accounts balances shall use BR-03 and include history tied to archived entities. | P0 | TC-01, TC-57 |
| FR-ACC-003 | Archive/restore/delete behavior shall follow BR-09/BR-10 and FR-REC-010. | P0 | TC-08, TC-51, TC-57 |
| FR-ACC-004 | The active picker shall exclude archived accounts while historical displays preserve their saved name/icon snapshot or resolvable archived entity. | P1 | TC-08, TC-32 |
| FR-ACC-005 | QA shall verify the scale target of 500 accounts; this is not a UI hard cap. | P2 | PERF-01 |
| FR-CAT-001 | The app shall create/edit separate Income and Expense categories with name and icon and shall enforce type compatibility everywhere. | P0 | TC-01, TC-38, TC-40 |
| FR-CAT-002 | Archive/restore/delete behavior shall follow BR-09/BR-10 and FR-REC-010. A category referenced only by a Budget still cannot be hard-deleted; the Budget must first be explicitly deleted. | P0 | TC-05, TC-51, TC-58 |
| FR-CAT-003 | The active picker shall exclude archived categories while historical displays retain them. | P1 | TC-05, TC-32 |
| FR-CAT-004 | The first-launch category seed shall use the list in Section 6. | P1 | TC-15 |
| FR-CAT-005 | QA shall verify the scale target of 200 categories; this is not a UI hard cap. | P2 | PERF-01 |

### FR-BUD — Budgets

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-BUD-001 | The app shall create at most one scale-2 limit per Expense category and `YYYY-MM` accounting month. | P0 | TC-06, TC-59 |
| FR-BUD-002 | Total Spent shall equal confirmed purchase Expense minus confirmed Expense refunds with the matching category and accounting month, including history tied to archived categories and confirmed recurring purchases. A refund is allocated by its own accounting month; Total Spent and remaining may therefore be negative or exceed the limit. | P0 | TC-06, TC-23, TC-57, TC-83/85 |
| FR-BUD-003 | The screen shall show limit, signed spent, remaining, and over-limit state using text/icon plus color. Negative spent caused by refunds shall be labeled “Net refund” and shall not be clamped to zero. | P0 | TC-06, TC-27, TC-85 |
| FR-BUD-004 | Budget limits do not roll over. Editing a limit replaces only that month’s limit immediately and does not prorate or modify spending. | P1 | TC-59 |
| FR-BUD-005 | Unbudgeted active Expense categories shall be listed with an action to create that month’s Budget. Archived categories with existing Budgets remain visible in historical months but cannot receive a new Budget until restored. | P1 | TC-60 |
| FR-BUD-006 | Weekly/yearly periods and rollover are Deferred. | P3 | Not applicable to MVP |

### FR-ANA — Analysis

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-ANA-001 | For an inclusive `fromAccountingDate…toAccountingDate` range, Analysis shall show confirmed Income and net Expense, where net Expense is purchase Expense minus Expense refunds whose own accounting dates are in the range. It shall exclude Transfers and every non-confirmed recurrence disposition; refunds shall not increase Income. | P0 | TC-61, TC-83/85 |
| FR-ANA-002 | Expense categories shall be ranked by signed net Expense descending, then name ascending for ties. The ranked list shall show zero and negative values and label a negative result “Net refund.” The chart shall include only categories with positive net Expense; each chart percentage is `positiveCategoryNet / sumOfPositiveCategoryNets × 100`, rounded half-up to one display decimal. When no category is positive, the chart shows an empty state and no “largest Expense category” is reported. | P0 | TC-61, TC-84 |
| FR-ANA-003 | The chart, ranked list, displayed net-Expense total, and underlying rows shall use the same date boundaries and transaction set, including archived categories. The chart denominator rule in FR-ANA-002 is the only permitted filtering difference. | P0 | TC-57, TC-61, TC-85 |
| FR-ANA-004 | Expense Flow and account-contribution charts are Deferred. | P3 | Not applicable to MVP |

### FR-BKP — Backup, restore, and reset

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-BKP-001 | The app shall export a canonical UTF-8 backup package with `backupSchemaVersion: 5`, creation time, application version, SHA-256 manifest hashes, record counts, and every portable table listed in Section 11. Export shall write to a temporary file, flush and validate it, then rename it to the user-selected final name; failure shall delete the temporary file. | P0 | TC-09, TC-36, INS-BKP-01 |
| FR-BKP-002 | Backup shall include financial Preferences but exclude passcode hash/salt/KDF data, failed-attempt state, lockout state, `passcodeEnabled`, `biometricEnabled`, notification authorization, telemetry consent, install identifier, and queued telemetry. `dailyReminderEnabled` shall export as false; its selected time may be retained. | P0 | TC-62, INS-BKP-01 |
| FR-BKP-003 | After reset or restore, the app shall be unlocked with passcode, biometrics, daily reminder, and telemetry disabled. It shall offer—but never require—the user to re-enroll a new passcode/biometrics, re-enable the reminder after permission review, and opt into crash reporting. A backup field claiming security was enabled shall be ignored and reported as normalized. | P0 | TC-26, TC-62 |
| FR-BKP-004 | Restore preflight shall parse the full package, verify manifest hashes and counts, enforce schema v5, validate types/ranges/enums/unique constraints/foreign keys and every BR-01–BR-23 invariant, check required free space, and build/migrate a staging SQLite database without modifying the live database. It shall reject refund links whose original is missing/ineligible, cumulative refunds above the purchase, or recurrence backlog/dispositions inconsistent with Section 11. | P0 | TC-10, TC-34, TC-63, TC-82–TC-85 |
| FR-BKP-005 | Restore shall acquire a maintenance lock before preflight. All repository writes during the lock shall fail without side effects with `RESTORE_IN_PROGRESS`; forms retain unsaved input and may retry after restore completes. Reads may continue until the commit phase begins. | P0 | TC-64 |
| FR-BKP-006 | The commit shall use a same-volume staged swap: close live/staging handles; fsync the validated staging database and its directory where supported; write and fsync a journal containing live, staging, rollback paths and phase; rename live→rollback; rename staging→live; validate/open live; mark committed; then delete rollback and journal. Equivalent platform primitives are acceptable only if they prove the same old-or-new outcome in REC-BKP-01. | P0 | TC-65, REC-BKP-01 |
| FR-BKP-007 | On launch, `DbGate` shall process the restore journal before any financial screen or writer mounts. Before the staging→live rename, it restores/keeps the old live database. After that rename, it keeps the new database only if validation succeeds; otherwise it restores rollback. Cleanup is idempotent. The observable result shall be the complete pre-restore or complete replacement dataset, never a mixture. | P0 | TC-65, TC-66, REC-BKP-01 |
| FR-BKP-008 | Parse, validation, unsupported schema, insufficient space, migration, rename, open, or integrity failure shall produce a specific error code/message, release the maintenance lock after recovery, and preserve the complete pre-restore dataset. No partial output or staging artifact remains after successful cleanup. | P0 | TC-10, TC-34, TC-63, TC-65, TC-66 |
| FR-BKP-009 | Delete & Reset shall require two confirmations, create a durable reset journal, clear all portable tables in one exclusive transaction, clear device-local security/telemetry/reminder state, and return to the unlocked first-launch state. If interrupted, `DbGate` shall finish the already-authorized reset before mounting the app. | P0 | TC-26, TC-67 |
| FR-BKP-010 | MVP supports only schema v5. Files declaring schema v1–v4 shall be rejected as `UNSUPPORTED_LEGACY_SCHEMA` because no released canonical schemas, field mappings, or golden fixtures exist. Versions greater than 5 shall be rejected as `BACKUP_FROM_NEWER_APP`; missing/non-integer versions shall be malformed. Rejection shall not modify local data. | P0 | TC-68 |
| FR-BKP-011 | A future version may add a legacy version only with a documented field-by-field mapping, defaults, refund-link and status/pause/backlog/ledger reconstruction, golden fixture, and passing migration tests added to this section before release. Unknown fields in v5 are rejected unless explicitly declared ignorable in the v5 schema. | P1 | INS-BKP-02 |
| FR-BKP-012 | Merge restore is Deferred. | P3 | Not applicable to MVP |

**Restore acceptance criteria:** Given power loss or termination at every journal phase, the next launch exposes either all pre-restore record counts/hashes or all replacement counts/hashes. Given disk-full after live→rollback, launch recovery restores the old live database. Given a v4 file, restore reports unsupported legacy schema and leaves every current row and device-local security setting unchanged.

### FR-PDF — PDF export

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-PDF-001 | The app shall generate a PDF for an inclusive accounting-date range containing confirmed transactions only. | P1 | TC-35, TC-69 |
| FR-PDF-002 | Transfers shall appear as labeled line items excluded from Income/Expense totals. Expense refunds shall appear as “Refund,” credit the receiving account, reduce the matching category and net-Expense total on their own accounting date, and never appear in Income. Confirmed recurring rows shall carry “Recurring” and their immutable occurrence date. Archived entity names shall remain readable. | P1 | TC-35, TC-57, TC-83/85 |
| FR-PDF-003 | Generation shall use a temporary cache file and the OS share/save sheet. Cancel leaves no durable exported copy; storage failure removes the temporary file and preserves app data. | P1 | TC-36, TC-69 |
| FR-PDF-004 | CSV/XLSX export is Deferred. | P3 | Not applicable to MVP |

### FR-SEC — Authentication and access control

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-SEC-001 | Enrollment shall require entering and confirming an exactly six-digit app passcode. Sequential/repeated digits are allowed but the UI shall warn, not block. The plaintext shall exist only during entry/KDF execution and shall not be logged or persisted. | P0 | TC-70, INS-SEC-01 |
| FR-SEC-002 | The app shall store a random 128-bit salt, PBKDF2-HMAC-SHA-256 verifier with 600,000 iterations and 256-bit output, algorithm/version metadata, and lockout state in SecureStore. Comparison shall be constant-time. SEC-REV-01 shall benchmark verification at no more than 750 ms on each reference device and review parameters before each major release. | P0 | TC-71, SEC-REV-01 |
| FR-SEC-003 | Optional biometric unlock may be enabled only after passcode enrollment and successful biometric capability/enrollment checks. The prompt shall disable device-credential fallback. Failure, cancellation, lockout, enrollment change, or unavailability returns to the app-passcode field and never unlocks the app. | P0 | TC-72, INS-SEC-02 |
| FR-SEC-004 | The app shall lock on cold launch and after 60 seconds continuously in the background. It shall not lock for a background interval under 60 seconds. Device lock or protected-data unavailability shall lock immediately when observed. | P0 | TC-37 |
| FR-SEC-005 | Failed app-passcode attempts use this persisted state machine: attempts 1–4: no delay; attempt 5: 30 seconds; attempt 6: 60 seconds; attempt 7: 5 minutes; attempt 8 and every later failure: 15 minutes. No attempt is accepted before `lockoutUntilUtc`. After a delay expires, the next failure advances the tier. Successful app-passcode or biometric authentication resets count/tier; app termination and reboot do not. | P0 | TC-11, TC-25, TC-73 |
| FR-SEC-006 | SecureStore shall persist `failedCount`, `lockoutUntilUtc`, and `lastObservedUtc`. If current wall time is earlier than `lastObservedUtc`, the app shall treat it as clock rollback and start the current tier’s full delay from the new current time before permitting another attempt. | P0 | TC-73 |
| FR-SEC-007 | Forgot passcode shall offer only Delete & Reset under FR-BKP-009 and state that recovery requires a valid supported external backup. It shall not reveal or reset a credential in place. | P0 | TC-26 |
| FR-SEC-008 | App lock is an access gate and must not be described as database or backup encryption. Database and user-created backup encryption are Deferred. | P0 | INS-SEC-03 |
| FR-SEC-009 | Sensitive financial data, credentials, backup contents, and user-entered text must not appear in production logs, diagnostics, or telemetry. | P0 | INS-PRV-01 |

### FR-SET, FR-NOT, and FR-PRV — Preferences, notifications, and privacy

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-SET-001 | Currency sign and prefix/suffix position are global presentation settings. `displayDecimalPlaces` shall accept only 0 or 2 and obey BR-05–BR-07. | P0 | TC-13, TC-39 |
| FR-SET-002 | Notes visibility, system-following appearance, and the single MVP theme shall persist locally and apply without restart. Additional themes are Deferred. | P1 | TC-38 |
| FR-SET-003 | Security, reminder, and telemetry settings shall obey their specialized requirements and shall not be treated as portable Preferences. | P0 | TC-62 |
| FR-NOT-001 | The app shall let the user select a local daily reminder time and shall request notification permission only when enabling it. Denial leaves the toggle OFF and shows instructions to open OS settings. | P1 | TC-12, TC-74 |
| FR-NOT-002 | Enabling shall create exactly one daily local notification; changing time shall replace it; disabling shall cancel all Kwartracker reminder requests. | P1 | TC-74 |
| FR-NOT-003 | On app launch after device restart, reinstall/update, timezone change, or detected schedule absence, the app shall reconcile the desired enabled state to exactly one future request, subject to OS permission and OEM delivery behavior. | P1 | TC-75 |
| FR-NOT-004 | The UI shall state that the OS controls final delivery and battery optimization may delay it. An absent/denied permission shall never crash or block core use. | P1 | TC-12, TC-75 |
| FR-PRV-001 | Android cloud backup and device-to-device transfer shall exclude the SQLite database, app files containing financial/preferences data, restore/reset journals, and telemetry queues. iOS files containing those data shall be excluded from iCloud/iTunes backup. Release builds shall verify generated native configuration. User-created backup/PDF files leave the sandbox only by explicit share/save action. | P0 | INS-PRV-02, TC-76 |
| FR-PRV-002 | Crash reporting is opt-in and default OFF. The permitted payload is limited to app version/build, OS name/version, device model, non-user-derived route identifier, exception type, scrubbed stack frames, and enumerated application error codes. It must not include transaction/account/category/budget/rule values or IDs, notes/names, database/query contents, backup/file paths, screenshots, session replay, UI text breadcrumbs, request bodies/headers, IP-derived location, user identity, locale, contacts, or advertising identifiers. | P0 | TC-77, INS-PRV-01 |
| FR-PRV-003 | The crash SDK shall not initialize, open a network connection, assign an installation/user identifier, or persist an event before consent. Opt-out shall stop the SDK and delete unsent local events immediately. Previously transmitted anonymous events follow the published retention policy; the consent screen and privacy policy shall disclose that limit. Usage analytics, tracing, profiling, session replay, and automatic network/UI breadcrumbs shall remain disabled. | P0 | TC-77, INS-PRV-03 |
| FR-PRV-004 | A release build shall pass payload inspection through a controlled test transport for every enabled capture path, including JavaScript error, handled exception, unhandled native crash where testable, and offline-queued delivery. A generic filtering hook alone is not acceptable evidence. | P0 | PRIV-VER-01 |
| FR-PRV-005 | Before store submission, the Release Manager and Privacy Owner shall publish/review the privacy policy and make Apple App Privacy and Google Play Data Safety declarations match the inspected release configuration, including optional crash collection and excluded OS backup. | P0 | PRIV-VER-02 |

### FR-NAV and FR-ERR — Navigation and failures

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-NAV-001 | Navigation shall implement Section 6 through Expo Router routes under `src/app/`; non-route code shall remain outside `src/app/`. | P0 | TC-78, INS-ARC-01 |
| FR-NAV-002 | Database recovery and lock gates shall complete before mounting the financial navigator. First launch shall use the guided state in Section 6. | P0 | TC-15, TC-66 |
| FR-ERR-001 | Every local financial write shall use an exclusive transaction where isolation is required and shall either commit its complete specified effect or leave prior state unchanged. | P0 | TC-07, TC-29, TC-41, TC-55 |
| FR-ERR-002 | Storage exhaustion during transaction save, recurrence evaluation, backup, PDF, restore, or reset shall map to `INSUFFICIENT_STORAGE`, leave the operation’s pre-commit state intact, remove temporary output where safe, and show a non-technical message. Restore/reset journal recovery requirements take precedence after a commit phase starts. | P0 | TC-36, TC-56, TC-63, TC-65, TC-79 |
| FR-ERR-003 | At launch, SQLite integrity and foreign-key checks shall run after journal recovery and migration. Failure shall prevent financial UI access and offer supported-backup restore or Delete & Reset; it shall never silently recreate an empty database over the corrupt file. | P0 | TC-80 |
| FR-ERR-004 | Permission denial, invalid input, or recoverable local failure shall preserve user input where it remains valid and provide a stable error code plus accessible message. | P1 | TC-12, TC-22, TC-30 |

## 8. Non-functional requirements

| ID | Approved requirement | Verification |
|---|---|---|
| NFR-01 | Every core create/read/edit/delete, balance, Budget, Analysis, recurrence-on-open, backup/restore selection, and PDF-generation workflow shall work in airplane mode. Explicit share targets and opted-in crash transmission may require connectivity. | TC-81 |
| NFR-02 | Financial data shall follow O3 and FR-PRV-001–005. No implicit OS-managed financial-data backup is allowed. | INS-PRV-02, PRIV-VER-01 |
| NFR-03 | Performance shall meet the reproducible PERF-01 protocol below. | PERF-01 |
| NFR-04 | At release, the app shall support the two most recent major Android releases and the two most recent major iOS releases that SDK 57 supports. Exact tested OS/build/device identifiers shall be recorded in REL-EVD-01. QA and Engineering shall review the supported-OS window and PERF-01 reference devices before every major app release, Expo SDK upgrade, or supported-OS-window change under PERF-GOV-01. | COMPAT-01, PERF-GOV-01 |
| NFR-05 | Monetary values shall obey BR-05–BR-07 without floating-point storage artifacts or silent rescaling. | TC-13, TC-30, TC-39 |
| NFR-06 | Core transaction entry shall remain usable one-handed in portrait and shall meet O1. | UX-01 |
| NFR-07 | Every MVP screen shall expose meaningful labels/roles/states to VoiceOver and TalkBack; interactive targets shall be at least 44×44 dp; state shall not rely on color alone; text shall remain operable at 200% font scale without clipped controls or hidden financial values; normal text contrast shall be ≥4.5:1 and large text/essential icons ≥3:1. | A11Y-01 |
| NFR-08 | Backup/restore/reset and recurrence operations shall be crash-consistent and idempotent as defined in BR-12–BR-20. | REC-BKP-01, TC-53, TC-55, TC-65–TC-68 |

### PERF-01 reproducible benchmark

- **Build:** signed/minified release build, Hermes enabled, development tools/logging disabled, airplane mode except where the measured feature requires none.
- **Reference devices:** the initial anchors are a physical Samsung Galaxy A14 5G with 4 GB RAM and a physical iPhone 11, each running the oldest OS in the current NFR-04 support window. REL-EVD-01 records exact model, OS, build, free storage, battery/thermal state, and app commit. PERF-GOV-01 shall review these anchors before every major app release, Expo SDK upgrade, or NFR-04 OS-window change. A device shall be replaced if it cannot run that oldest supported OS, is no longer procurable/maintainable for repeatable testing, or measured market/performance evidence shows it no longer represents the intended lower-performance tier. The replacement must be in the same or a lower performance tier; where both devices remain operable, QA shall run the same seeded build on old and new anchors and retain the comparison and all historical results in REL-EVD-01.
- **Dataset:** 10,000 confirmed transactions spread across 36 months, 500 accounts, 200 categories, 120 monthly Budgets, 50 active recurring rules, 500 retained non-confirmed ledger rows, and representative archived entities.
- **Scroll procedure:** after one untimed warm-up, continuously scroll Records, Analysis, and Budgets for 60 seconds each, three runs per screen. Measure platform UI frame intervals with the platform profiler; JS render-work duration is reported separately and is not called frame time.
- **Pass criteria:** each run averages at least 55 rendered frames/second, fewer than 1% of frames exceed 100 ms, and no user action has a measured response-to-next-frame p95 above 200 ms.
- **Catch-up procedure:** from a clean warm start, evaluate 50 rules producing exactly 1,500 new occurrence/Transaction pairs plus 500 `deferred_backlog` rows; five runs. Median whole-pass commit time shall be ≤2.0 seconds and every run ≤3.0 seconds. A failure rolls back the entire pass under FR-REC-016.
- **Evidence:** raw profiler exports, seed hash, run results, and pass/fail calculation are stored as REL-EVD-01.

## 9. Technical architecture

The approved architecture is Expo SDK 57, React Native 0.86, TypeScript, Expo Router, `expo-sqlite`, and `expo-secure-store`. `expo-sqlite` is the financial source of truth. SecureStore is limited to the credential verifier and lockout state. UI state may use Context/reducers or a lightweight store but must not duplicate authoritative financial values.

SQLite shall enable foreign keys and WAL where supported. Exclusive transactions shall be used for Transfer changes, transaction replacement effects, recurrence passes, archive-driven pending cancellation, idempotent writes, and other multi-row invariants. Restore uses the staged-swap protocol because its commit spans a complete database replacement.

The app uses Continuous Native Generation: generated `ios/` and `android/` folders are not committed. Native behavior is configured in app configuration/config plugins. Release builds—not Expo Go—are the acceptance environment. Expo Go may be used only where its bundled modules and behavior match the feature under development; no blanket claim is made that every native module requires a development build.

PDF generation uses the SDK 57 Print API and OS sharing. Local reminders use SDK 57 Notifications. Biometrics use SDK 57 LocalAuthentication with device fallback disabled. Future background recurrence shall use the supported SDK background-task API at that time; the deprecated `expo-background-fetch` API is not an approved dependency.

## 10. Project structure

Expo Router routes reside only under `src/app/`, consistent with repository instructions:

```text
src/app/
  _layout.tsx                 # providers > DbGate > LockGate > root Stack
  recovery/index.tsx         # SCR-12
  lock/index.tsx              # SCR-11
  lock/reset.tsx
  (main)/_layout.tsx          # drawer
  (main)/(tabs)/_layout.tsx
  (main)/(tabs)/index.tsx     # SCR-01
  (main)/(tabs)/analysis.tsx  # SCR-02
  (main)/(tabs)/budgets.tsx   # SCR-04
  (main)/(tabs)/accounts.tsx  # SCR-06
  (main)/(tabs)/categories.tsx# SCR-07
  (main)/transaction/new.tsx  # SCR-05 create
  (main)/transaction/[id].tsx # SCR-05 edit
  (main)/recurring-rules/*    # SCR-10
  (main)/preferences/*        # SCR-09
  (main)/data/*               # SCR-08
src/db/                       # schema, migrations, journals, gates
src/domain/                   # money, accounting dates, balances, recurrence
src/repositories/             # transactional persistence and idempotency
src/services/                 # backup, restore, reset, PDF, notifications, security, privacy
src/components/               # reusable UI outside routes
tests/                        # unit, repository, component, integration fixtures
```

The exact filenames below `src/` are engineering-controlled. The boundaries and route placement above are normative; a change must preserve all referenced requirements.

## 11. Data model and storage

All IDs are UUID text. All timestamps are UTC ISO-8601 instants. All civil dates use validated `YYYY-MM-DD`. All monetary columns are signed-safe 64-bit integer minor units at fixed scale 2.

### Portable entities in backup schema v5

| Entity | Required fields and constraints |
|---|---|
| Account | `id`, `name`, `icon`, `openingBalanceMinor`, `isArchived`, timestamps |
| Category | `id`, `type: income or expense`, `name`, `icon`, `isArchived`, timestamps |
| Transaction | `id`, `idempotencyToken UNIQUE`, `type`, `expenseEffect: purchase or refund` only when type is Expense, `amountMinor > 0`, `accountingDate`, `occurredAtUtc`, `createdTimeZoneId`, `createdUtcOffsetMinutes`, `note?`, `accountId`, `categoryId?`, `toAccountId?`, `refundOfTransactionId?`, `originOccurrenceId? UNIQUE`, `originKind: manual or recurring`, immutable `originRuleTitleSnapshot?`, `originScheduleSnapshot?`, `originOccurrenceDate?`, timestamps. A refund has `type=expense`, `expenseEffect=refund`, a required indexed `refundOfTransactionId` with `ON DELETE RESTRICT`, the same `categoryId` as the referenced confirmed purchase Expense, `originKind=manual`, and no recurrence link. Income/Transfer and purchase Expense have null `refundOfTransactionId`; field combinations obey BR-01/BR-02/BR-23. The Transaction↔Occurrence links use deferred foreign-key checks inside the confirmation transaction so neither half can commit alone. |
| Budget | `id`, `categoryId`, `month`, `limitMinor > 0`, timestamps; `UNIQUE(categoryId, month)`; category must be Expense |
| PreferencesPortable | single row: `currencySign`, `currencyPosition`, `displayDecimalPlaces: 0 or 2`, `notesVisibleInList`, `uiMode`, `theme`, `dailyReminderTime`; restored reminder state is always disabled |
| RecurringRule | `id`, `title`, `confirmBeforeAdding`, `schedulingTimeZoneId`, `isPaused`, `evaluatedThroughDate?`, `deletedAtUtc?`, timestamps. Deletion is a retained tombstone. |
| RecurringRuleRevision | `id`, `ruleId`, `effectiveFromDate`, transaction payload fields, weekday bitmask, inclusive `startDate`, inclusive `endDate?`, scheduling timezone snapshot, timestamps; non-overlapping effective ranges per rule |
| RecurringPausePeriod | `id`, `ruleId`, `firstExcludedDate`, `firstIncludedDate?`; ranges do not overlap; open range means still paused |
| RecurringOccurrenceLedger | `id`, `ruleId`, `ruleRevisionId`, `occurrenceDate`, `disposition`, immutable payload snapshot including `confirmBeforeAdding`, `transactionId?`, `evaluatedAtUtc`, `resolvedAtUtc?`; `UNIQUE(ruleId, occurrenceDate)`; `transactionId` required only for confirmed and null for all other dispositions. Allowed dispositions and transitions are exactly BR-13 and Section 12. `deferred_backlog` rows are retained until explicit generation/exclusion, target archive, or rule removal. |

### Device-local data excluded from backups

`PasscodeCredential` in SecureStore contains KDF version/algorithm/parameters, salt, verifier, and enrollment time. `LockoutState` contains failed count, tier, lockout-until, and last-observed time. Biometric opt-in, analytics consent, install identifiers, notification authorization/scheduled request IDs, telemetry queue, and restore/reset working files are device-local and are not portable.

### Referential actions and retention

- Financial entities referenced by history use `RESTRICT`; hard deletion is allowed only under BR-10.
- `refundOfTransactionId` uses `RESTRICT`. A purchase Expense cannot be deleted while any refund row references it; refund deletion removes only the refund and its accounting effects. Refund and original are both portable and their link must survive restore.
- RecurringRule uses tombstone deletion. Revisions, pauses, ledger rows, and transaction origin snapshots are retained for the life of the database and included in backup.
- Deleting a recurring Transaction removes that financial row only after its ledger row changes to `deleted_transaction`.
- Retention is user-controlled through full Delete & Reset. Individual history is not automatically purged.

### Backup compatibility matrix

| Schema | MVP action | Mapping/defaults | Verification |
|---|---|---|---|
| 5 | Accept after full validation | Exact schema above, including refund links and recoverable backlog; device-local fields excluded/normalized | TC-09, TC-53/54, TC-62–TC-66, TC-82–TC-85 |
| 1–4 | Reject conservatively | No mapping: these numbers appeared only in unreleased drafts and no approved canonical schemas/fixtures exist | TC-68 |
| >5 | Reject as newer app | No mapping | TC-68 |
| Missing, non-integer, malformed | Reject as malformed | None | TC-10, TC-68 |

## 12. Service boundaries and state transitions

- **Repositories** enforce schema invariants and accept a transaction handle for multi-row operations. No service may bypass validation by writing directly to SQLite.
- **Money service** parses decimal arithmetic without binary floating-point persistence, applies one half-up rounding at scale 2, and enforces range/positive constraints.
- **Accounting-date service** creates/validates immutable civil dates and converts recurring local noon to UTC using the revision timezone.
- **Recurrence service** serializes lifecycle triggers, evaluates every rule in one exclusive transaction, writes durable ledger dispositions, advances cursors only at commit, and performs each user-authorized backlog batch as one separate exclusive transaction.
- **Restore service** owns maintenance lock, staging, journal phases, recovery, and post-restore security normalization.
- **Reset service** owns the reset journal and idempotent completion across SQLite and device-local stores.
- **Privacy service** owns consent before SDK initialization, a code-level payload allowlist, queue deletion, and test-transport injection.

### Recurring occurrence transitions

```text
no ledger row
  -> deferred_backlog -> pending -> confirmed -> deleted_transaction
                      -> confirmed -> deleted_transaction
                      -> excluded_user
                      -> skipped_target_archived
                      -> cancelled_rule_deleted
  -> pending -> confirmed -> deleted_transaction
             -> skipped_user
             -> skipped_target_archived
             -> cancelled_rule_deleted
  -> confirmed -> deleted_transaction
  -> excluded_pause
```

Every arrow is transactional. `deferred_backlog` is non-terminal and has no accounting effect. Terminal states are `skipped_user`, `excluded_user`, `excluded_pause`, `skipped_target_archived`, `cancelled_rule_deleted`, and `deleted_transaction`. `confirmed` remains linked to one Transaction until that Transaction is deleted. No transition returns to absence or causes regeneration.

### Restore journal phases

`STAGING_VALIDATED → OLD_RENAMED → NEW_RENAMED → NEW_VALIDATED → COMMITTED`. The journal and filesystem state jointly determine recovery under FR-BKP-007. A release cannot pass REC-BKP-01 if any injected termination point produces a partial mixture.

## 13. Validation and error handling

The same validation functions shall run for manual create/edit, recurring-rule/revision create, pending confirmation, and restore preflight. Restore may normalize only fields explicitly listed by FR-BKP-002/003; it must reject rather than silently change financial values.

| Validation | Result |
|---|---|
| Malformed/divide-by-zero/negative/zero/rounds-to-zero/overflow amount | Reject before write; preserve input |
| Income/Expense category mismatch | Reject |
| Refund without an eligible confirmed purchase Expense, mismatched category, recurring origin, archived receiving account, or cumulative amount above the original purchase | Reject atomically; preserve input and existing rows |
| Transfer same/missing source or destination, category present, or non-positive amount | Reject |
| Recurring no weekday, invalid date/timezone, end before start, invalid target/type | Reject |
| Archive target while pending/backlog exists | Show affected counts; after confirmation archive + rule pause + pending/deferred→`skipped_target_archived` atomically |
| Delete referenced account/category | Reject with reference counts and Archive action |
| Delete category referenced only by Budget | Reject and offer explicit Budget deletion first |
| Duplicate idempotency token | Return existing committed result; no new effect |
| Restore value outside v5 schema/invariant | Reject whole restore; no normalization except FR-BKP-003 |
| Corrupt live DB | Block financial UI; preserve file; offer restore/reset |
| Insufficient storage | Apply FR-ERR-002 and operation-specific journal recovery |

## 14. Security and privacy

The threat model covers casual unauthorized access to an unlocked device, offline guessing of a stolen verifier, accidental financial-data disclosure through logs/telemetry/OS backup, and destructive recovery mistakes. The MVP passcode gate does not defend a fully compromised/rooted device and does not encrypt the database or user-created backup.

The approved KDF is PBKDF2-HMAC-SHA-256 with the exact parameters in FR-SEC-002. A major release may strengthen parameters through versioned verifier migration but must not lower them without Security approval and a document revision.

Android build configuration shall exclude all listed app data from cloud backup and device-to-device extraction rules. iOS financial files shall carry the excluded-from-backup resource value. SecureStore’s own platform backup rules shall remain correctly configured. INS-PRV-02 inspects the generated native configuration and performs a backup/restore smoke test on both platforms.

Crash reporting is the only permitted network telemetry. The consent screen names the provider, data allowlist, purpose, retention link, and opt-out effect. Production logging uses stable error codes rather than user-derived strings. Privacy/store declarations are release artifacts, not inferred from the presence of an SDK.

### Authoritative platform and security references

These references establish the constraints used by this baseline and must be rechecked for an SDK upgrade or store submission:

- [Expo SDK 57 reference](https://docs.expo.dev/versions/v57.0.0/), including [SQLite](https://docs.expo.dev/versions/v57.0.0/sdk/sqlite/), [SecureStore](https://docs.expo.dev/versions/v57.0.0/sdk/securestore/), [LocalAuthentication](https://docs.expo.dev/versions/v57.0.0/sdk/local-authentication/), [Notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/), and [Print](https://docs.expo.dev/versions/v57.0.0/sdk/print/).
- [Android Auto Backup](https://developer.android.com/identity/data/autobackup) and [Apple excluded-from-backup resource value](https://developer.apple.com/documentation/foundation/urlresourcevalues/isexcludedfrombackup).
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) for the approved PBKDF2-HMAC-SHA-256 floor.
- [Apple App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/) and [Google Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469) for release disclosures.

## 15. Testing and verification

An automated test, scripted device test, inspection, or review passes only when its stated outcome is observed and its evidence is attached to REL-EVD-01. “Not run” is a failure for an MVP gate unless the referenced requirement is Deferred.

### Verification execution plan

The 85 test IDs are acceptance scenarios, not 85 separate manual sessions. `QA-PLAN-01` shall map each ID to an executable test name, suite, owner, target environment, result, and evidence link. The following allocation is normative; overlapping suites may reuse one recorded run only when its assertions satisfy every referenced pass criterion.

| Suite | Required scope and cadence | Accountable owner |
|---|---|---|
| `AUTO-PR` | Automated domain, repository, component, and fault-injection tests for TC-01–TC-10, TC-13–TC-19, TC-22–TC-24, TC-28–TC-32, TC-34, TC-38–TC-68, TC-79/80, and TC-82–TC-85. The affected subset runs on every pull request; the complete suite runs on the protected main branch and must pass before an RC is cut. TC-20 is a retired identifier and has no executable case. | Engineering Lead |
| `NIGHTLY` | Long-running scale, replay, storage-exhaustion, journal interruption, and offline automation for TC-21, TC-33, TC-36, TC-43, TC-46, TC-53–TC-56, TC-63–TC-68, TC-75, and TC-79–TC-81. It runs nightly against the latest main-branch release build; a failure blocks the next RC until triaged and passed. | QA Lead |
| `RC-DEVICE` | Scripted physical-device checks for TC-11/12, TC-25–TC-27, TC-33, TC-35–TC-37, TC-62, TC-65–TC-78, TC-81, and every named inspection/review artifact below. It runs once per RC on the applicable reference/compatibility devices; all required cases must pass on the final submission build. | QA Lead; Security, Privacy, UX, Product, and Release owners sign their named artifacts |

P0, P1, and P2 labels prioritize implementation and diagnosis; they do not permit an Approved MVP test to be skipped. A requirement may leave the MVP gate only through an approved document revision that marks the requirement Deferred and updates Sections 16–20. QA may sequence exploratory work separately, but the release evidence shall contain every required result.

### Functional and data-integrity tests

| ID | Test and pass criterion | Covers |
|---|---|---|
| TC-01 | Create positive Income and Expense with matching categories; each appears once and changes its account by the exact integer amount. | FR-TRN-001/002, FR-ACC-001/002 |
| TC-02 | Transfer 100000 minor units A→B; A decreases and B increases by 100000 in one commit; Income/Expense/Budget totals do not change. | BR-02/04, FR-TRN-007 |
| TC-03 | Reject Transfer with identical, missing, or archived target; database remains byte-for-byte logically unchanged. | FR-TRN-002 |
| TC-04 | Create records around midnight and DST transitions; selected accounting dates and month membership remain exactly as saved. | BR-08, FR-TRN-005 |
| TC-05 | Archive/restore a referenced Category; pickers hide/show it while historical rows and aggregates remain unchanged. | BR-09, FR-CAT-002/003 |
| TC-06 | Cross a Budget limit with confirmed Expenses; exact spent/remaining and text/icon warning appear. | FR-BUD-002/003 |
| TC-07 | Delete a Transfer with a fault injected between its two conceptual account effects; either both effects disappear or neither does. | BR-04, FR-TRN-007/009 |
| TC-08 | Archive/restore a referenced Account; active pickers and historical balance/display obey BR-09. | FR-ACC-003/004 |
| TC-09 | Export v5 and restore on a fresh install; portable table hashes/counts, refund links, recurrence backlog, and terminal dispositions match while device-local settings are normalized. | FR-BKP-001–008 |
| TC-10 | Truncate/corrupt backup and alter a manifest hash; each restore is rejected before live mutation. | FR-BKP-004/008/010 |
| TC-11 | Fail passcode five times; fifth failure imposes exactly 30 seconds and no early attempt is accepted. | FR-SEC-005 |
| TC-12 | Deny notification permission; toggle remains OFF, accessible guidance appears, core use continues. | FR-NOT-001/004 |
| TC-13 | With stored 1234 minor units, display 2→0→2 yields 12.34→12→12.34 and no stored column changes. | BR-05–07, FR-SET-001 |
| TC-14 | Duplicate manual, recurring, and refund Transactions; each new draft has a new token and no recurrence/refund link. A duplicated refund is a purchase Expense draft, and an archived inherited category is cleared and blocks Save until an active category is selected. | FR-TRN-006 |
| TC-15 | Fresh install seeds the approved categories and guides account creation without dead-end navigation. | FR-CAT-004, FR-NAV-002 |
| TC-16 | Evaluate a weekday rule across a 40-date gap; exactly 10 oldest become `deferred_backlog`, 30 newest become pending/confirmed, the persistent backlog notice shows 10 and its date range, and immediate automatic reopen changes nothing. | FR-REC-003/004 |
| TC-17 | Pause across five scheduled dates, resume, and evaluate; those dates are `excluded_pause` and never generate Transactions. | FR-REC-008 |
| TC-18 | Archive a target of an active rule; the warning shows affected pending/backlog counts, the rule pauses, pending and deferred rows become `skipped_target_archived`, and unarchive does not resume or rewrite them. | FR-REC-010 |
| TC-19 | Attempt hard-delete of an entity referenced by active, paused, or tombstoned recurrence history; every attempt is rejected. | BR-10, FR-ACC-003, FR-CAT-002 |
| TC-20 | Superseded by TC-68; no legacy-success claim remains. | FR-BKP-010 |
| TC-21 | Run the recurrence portion of PERF-01 and meet all five-run thresholds. | NFR-03 |
| TC-22 | Reject rule with empty weekdays, invalid timezone, end before start, invalid targets, or non-positive/round-to-zero amount. | FR-REC-001, FR-ERR-004 |
| TC-23 | Pending rows affect no Records/balance/Budget/Analysis/PDF surface; confirmation atomically creates one Transaction; skip remains permanently absent. | BR-13/14, FR-REC-005/007 |
| TC-24 | Two disjoint pause/resume cycles produce exactly two non-overlapping exclusion intervals and exclude only dates in `[start,end)`. | FR-REC-008 |
| TC-25 | Fail four times, restart, fail fifth, reboot mid-delay; counter and remaining delay survive. | FR-SEC-005/006 |
| TC-26 | Forgot passcode→two-confirmation reset→supported restore; app is unlocked afterward and offers fresh enrollment without restoring old credentials. | FR-BKP-003/009, FR-SEC-007 |
| TC-27 | Budgets expose labels, ≥44dp targets, 200% scaling, and non-color warning; automated contrast scan meets NFR-07. | FR-BUD-003, NFR-07 |
| TC-28 | Rapid double Save produces one committed token and one Transaction. | FR-TRN-011 |
| TC-29 | Edit Transfer amount and destination with injected fault; each edit commits both account effects or neither. | BR-04, FR-TRN-007 |
| TC-30 | Evaluate terminating/non-terminating arithmetic and malformed forms; integer output follows half-up scale-2 or rejects with no write. | FR-TRN-003, NFR-05 |
| TC-31 | Duplicate recurring-origin Transaction; saved duplicate is `originKind=manual` with no origin snapshot/link. | FR-TRN-006 |
| TC-32 | Archived entities are absent from all new-entry/new-rule/reassignment pickers yet render in historical views. | FR-ACC-004, FR-CAT-003 |
| TC-33 | Run the scroll portion of PERF-01 and meet every per-run threshold. | NFR-03 |
| TC-34 | A schema-v5 file with unresolved FK, duplicate unique key, refund/backlog inconsistency, or invariant violation is rejected before live mutation. | FR-BKP-004/008 |
| TC-35 | PDF containing Transfer, recurring purchase, and Expense refund labels them correctly; it excludes Transfer, subtracts Refund from Expense, and never adds Refund to Income. | FR-PDF-001/002 |
| TC-36 | Exhaust storage during backup and PDF creation; no final/partial output remains and app data is unchanged. | FR-BKP-001, FR-PDF-003, FR-ERR-002 |
| TC-37 | Background 59 seconds: unlocked; background 60 seconds: locked; cold launch/device-lock signal: locked. | FR-SEC-004 |
| TC-38 | Edit Account, Category, and portable Preferences; restart and verify exact persisted values and effects. | FR-ACC-001, FR-CAT-001, FR-SET-002 |
| TC-39 | Store ₱12.34, switch 2→0→2, and enter values requiring rounding; stored financial columns never rescale and zero-after-rounding rejects. | BR-05–07, FR-TRN-003, FR-SET-001 |
| TC-40 | Reject negative expressions/values and category mismatch across manual entry, purchase/refund entry, rule creation, confirmation, edit, and restore. A rule cannot create a refund. | FR-TRN-002/003/010, FR-REC-001 |
| TC-41 | Edit/correct Income and purchase Expense with fault injection; the old effect is replaced atomically. With a linked refund, reject original type/category change and any amount below cumulative refunds without changing either row. | FR-TRN-008/010, FR-ERR-001 |
| TC-42 | Create recurrence in `Asia/Manila`, travel to another timezone, and evaluate around midnight/DST elsewhere; occurrence/accounting date remains the rule-zone date and UTC time represents rule-zone noon. | FR-TRN-005, FR-REC-013 |
| TC-43 | Commit a token, terminate/relaunch, replay token through repository API; original result returns and counts/totals do not change. | FR-TRN-011 |
| TC-44 | Delete a generated Transaction, reopen twice, and evaluate after rule edit; ledger is `deleted_transaction` and no replacement appears. | BR-15, FR-REC-014 |
| TC-45 | Trigger cold launch, foreground resume, and same-date concurrent triggers; each eligible interval evaluates once and concurrent calls serialize/join. | FR-REC-002 |
| TC-46 | Evaluate capped history twice and after backup/restore; all keys remain unique, deferred rows remain recoverable and unchanged without user action, backlog count/date range matches, and no duplicate Transaction appears. | FR-REC-003/004/015 |
| TC-47 | Confirm-all, confirm-one, edited-amount confirm, and skip; each pending row reaches exactly one legal terminal/confirmed state with correct amount. | FR-REC-005/007 |
| TC-48 | Confirmation OFF creates ledger+Transaction atomically and shows exact post-run count; injected failure creates neither. | FR-REC-006/016 |
| TC-49 | Pause/resume same scheduling day before evaluation yields empty interval; pause through next date excludes that date; boundary dates follow `[start,end)`. | FR-REC-008/013 |
| TC-50 | Edit weekdays/amount/timezone today; current/past and deferred-backlog rows retain the old revision snapshot, the next rule-zone date uses the new revision, and existing rows never change. | BR-16, FR-REC-009 |
| TC-51 | Archive a target with multiple rules and pending/deferred rows; all dependent rules pause and both row types skip in one commit; injected failure changes nothing. | FR-REC-010, FR-ACC-003, FR-CAT-002 |
| TC-52 | Remove rule containing confirmed, pending, deferred-backlog, skipped, pause, and revision history; pending/deferred rows cancel, history remains, and the rule never evaluates. | BR-17, FR-REC-011/012 |
| TC-53 | Delete generated transaction, remove rule, backup, restore, reopen; tombstone/history/snapshot/dispositions match and no regeneration occurs. | FR-REC-014/015, FR-BKP-001–008 |
| TC-54 | Backup/restore every recurrence disposition, including deferred backlog and explicit exclusion, plus each cursor; logical hashes, visible backlog, and next evaluation result match the source device. | FR-REC-015 |
| TC-55 | Inject failure after each rule during a multi-rule pass; the entire pass rolls back and retry creates the exact intended rows once. | FR-REC-016, FR-ERR-001 |
| TC-56 | Exhaust storage during multi-rule pass; no cursor/ledger/Transaction changes persist, error appears, and next trigger retries successfully after space is freed. | FR-REC-016, FR-ERR-002 |
| TC-57 | Archive entities with history; balances, Budget spent, Analysis, Records, and PDF remain numerically identical and labels remain visible. | BR-03/09, FR-ACC-002, FR-BUD-002, FR-ANA-003, FR-PDF-002 |
| TC-58 | Category referenced only by Budget cannot delete; after explicit Budget deletion and with no other references, category delete succeeds. | BR-10, FR-CAT-002 |
| TC-59 | Attempt duplicate category/month Budget; unique constraint rejects it. Edit mid-month and cross month boundary; current limit replaces immediately and no value rolls forward. | BR-11, FR-BUD-001/004 |
| TC-60 | Verify active unbudgeted list; archive a category with historical Budget and confirm historical visibility but no new Budget action until restore. | FR-BUD-005 |
| TC-61 | Use a fixture with ties, Transfers, pending/skipped rows, archived categories, boundary dates, purchases, refunds, and a no-positive-net category range; verify exact net totals, order, positive-only chart denominator, “Net refund” labels, empty state, and shared result set. | FR-ANA-001–003 |
| TC-62 | Inspect v5 backup and restore: portable preferences survive; credential, lockout, biometric, telemetry consent/queue, permission, and enabled reminder do not; post-restore is unlocked/default-off. | BR-18, FR-BKP-002/003 |
| TC-63 | Fail restore for insufficient preflight space and fail staging migration/write; live hashes remain unchanged and artifacts clean up. | FR-BKP-004/008, FR-ERR-002 |
| TC-64 | Attempt writes from every repository while restore lock is held; each returns `RESTORE_IN_PROGRESS`, retains draft input, and commits nothing. | FR-BKP-005 |
| TC-65 | Terminate or exhaust storage at every restore journal phase; restart reaches complete old or new hashes only, then removes rollback/journal. | FR-BKP-006–008, FR-ERR-002 |
| TC-66 | Corrupt new live after `NEW_RENAMED`; startup recovery restores valid rollback before any financial route mounts. | FR-BKP-007, FR-NAV-002 |
| TC-67 | Terminate reset before/after SQLite commit and during SecureStore clear; restart completes reset and opens unlocked empty first launch. | FR-BKP-009 |
| TC-68 | Submit valid-shaped schemas 1,2,3,4,6, missing, non-integer, and unknown; each receives the specified error and leaves live/device-local state unchanged. Schema 5 succeeds. | BR-20, FR-BKP-010/011 |
| TC-69 | Generate, cancel share, complete share, and fail PDF storage; verify inclusive boundaries, confirmed-only content, and temporary-file cleanup. | FR-PDF-001/003 |
| TC-70 | Enroll only exactly six matching digits; plaintext does not appear in logs, storage, snapshots, or telemetry transport. | FR-SEC-001/009 |
| TC-71 | Inspect verifier fields, recompute PBKDF2 test vector, verify constant-time comparison review, and meet device timing bound. | FR-SEC-002 |
| TC-72 | Test biometric success, failure, cancel, OS lockout, no enrollment, enrollment change, and device-passcode attempt; only biometric success unlocks and every other path shows app passcode. | FR-SEC-003 |
| TC-73 | Exercise attempts 1–10, success reset, biometric reset, restart, reboot, and clock rollback; observed delays/state exactly match FR-SEC-005/006. | FR-SEC-005/006 |
| TC-74 | Enable, change time, enable repeatedly, and disable reminder; exactly one/correct/zero requests exist respectively. | FR-NOT-001/002 |
| TC-75 | Reboot/change timezone/delete scheduled request; launch reconciliation restores exactly one request when authorized/enabled and none when disabled/denied. | FR-NOT-003/004 |
| TC-76 | Platform backup smoke test confirms financial files and device-local protected state do not restore through OS backup/device transfer; explicit v5 backup still works. | FR-PRV-001 |
| TC-77 | With consent OFF, assert no SDK init/network/identifier/queue. With ON, inspect all capture paths; opt out offline and verify queued files deleted and later connectivity sends nothing. | FR-PRV-002/003 |
| TC-78 | Deep-link and navigate every SCR route; lock/recovery screens precede financial shell and all routes live under `src/app/`. | FR-NAV-001 |
| TC-79 | Exhaust storage during manual transaction save; no transaction/idempotency partial state remains and draft input is retained. | FR-ERR-002 |
| TC-80 | Launch with corrupted/truncated DB and failing foreign-key check; financial UI does not mount, file is preserved, and Restore/Reset options work. | FR-ERR-003 |
| TC-81 | In airplane mode execute all NFR-01 core workflows; no core action attempts or requires network access. | NFR-01 |
| TC-82 | With 75 deferred occurrences, Generate next batch processes exactly the 30 oldest once; reopening does nothing; then explicitly exclude 20 selected rows and confirm the named count/range. Verify 25 remain deferred, zero unintended Transactions exist, and the state persists across restart and backup/restore. | BR-13, FR-REC-004/015/016 |
| TC-83 | Create a ₱100 purchase and ₱30 refund to a different active account in a later month. Verify original account −₱100, receiving account +₱30, Income unchanged, purchase-month Expense ₱100, refund-month net Expense/Budget −₱30, Records/PDF label Refund, and backup/restore preserves the link and totals. | BR-02/03/23, FR-TRN-001/002/010, FR-BUD-002, FR-ANA-001, FR-PDF-002 |
| TC-84 | Against a ₱100 purchase, create/edit/delete partial refunds and race two final refunds. Cumulative committed refunds never exceed ₱100; exactly one racing write succeeds when capacity allows one; original deletion/type/category change and amount below refunded total are rejected; deleting a refund restores its accounting effects and available refundable amount. | BR-23, FR-TRN-008–011, FR-ERR-001 |
| TC-85 | Use purchases/refunds across range and month boundaries, including a category whose refunds exceed purchases in the selected range. Verify signed net Expense, “Net refund,” largest-positive-category behavior, positive-only chart denominator, Budget values, PDF totals, and rejection of malformed or orphaned refund links during restore. | FR-TRN-010, FR-BUD-002, FR-ANA-001–003, FR-BKP-004, FR-PDF-002 |

### Required inspections and release artifacts

| ID | Pass criterion | Covers |
|---|---|---|
| INS-BKP-01 | Schema/manifest/export inspection proves exact v5 portable fields, refund/backlog constraints, and temporary-file discipline. | FR-BKP-001/002 |
| INS-BKP-02 | Compatibility table and fixtures include every accepted schema; currently only v5. | FR-BKP-010/011 |
| REC-BKP-01 | Automated termination matrix for every restore phase proves old-or-new hashes only on both platforms. | BR-19, NFR-08 |
| INS-SEC-01 | Production log/storage inspection finds no plaintext passcode. | FR-SEC-001 |
| INS-SEC-02 | Release native configuration and device behavior prove biometric device fallback disabled. | FR-SEC-003 |
| INS-SEC-03 | UI/store/privacy copy never equates app lock with encryption. | FR-SEC-008 |
| SEC-REV-01 | Security signs KDF parameters, test vector, constant-time implementation, dependency provenance, and timing results. | FR-SEC-002 |
| INS-PRV-01 | Static rules plus captured logs/telemetry contain no prohibited user/financial fields. | FR-TRN-004, FR-SEC-009, FR-PRV-002 |
| INS-PRV-02 | Generated Android/iOS configuration and device smoke tests prove OS-backup exclusion. | FR-PRV-001, NFR-02 |
| INS-PRV-03 | SDK configuration proves analytics/tracing/profiling/session replay/automatic breadcrumbs disabled and consent gates initialization. | FR-PRV-003 |
| PRIV-VER-01 | Controlled transport captures every enabled telemetry path and contains only the allowlist; offline queue and opt-out behavior pass. | FR-PRV-004 |
| PRIV-VER-02 | Published privacy policy and both store declarations match PRIV-VER-01 and name retention/processor details. | FR-PRV-005 |
| INS-ARC-01 | Architecture review confirms Expo SDK 57 APIs, `src/app/` routing, generated native folders, and no deprecated background-fetch dependency. | FR-NAV-001, Section 9 |
| PERF-01 | Raw evidence satisfies every Section 8 performance criterion. | NFR-03 |
| PERF-GOV-01 | QA and Engineering record each trigger review, current supported-OS window, keep/replace decision for both reference devices, evidence/rationale, overlap benchmark where possible, and retained historical results. | NFR-04, PERF-01 |
| COMPAT-01 | Full gated suite passes on both OS majors per platform and exact devices/builds are recorded. | NFR-04 |
| UX-01 | Five O1 runs per reference device meet time/action limits and one-handed use review passes. | O1, NFR-06 |
| A11Y-01 | Automated contrast plus manual VoiceOver/TalkBack audit covers every SCR screen/control at default and 200% font size. | NFR-07 |
| REL-EVD-01 | Immutable release evidence index links app commit/build, environment, every required TC result, every artifact above, approvers, and any superseding approved specification revision. A failed or missing normative result cannot be recorded as an accepted deviation under the same baseline. | All release gates |
| QA-PLAN-01 | The release evidence maps every non-retired TC and named artifact to its suite, accountable owner, executable test/procedure, result, and evidence link; no Approved MVP item is unassigned or marked not run. | Sections 15–17 |

## 16. Release plan and gates

The MVP defined in Section 2 may be submitted only when every gate below is PASS. A failed normative test cannot be waived merely by recording it; changing the requirement or accepting a residual risk requires a new document version and the named owner’s approval.

| Gate | Owner | PASS criterion | Evidence |
|---|---|---|---|
| RG-01 Product behavior | Product Owner | O1–O4 and all P0/P1 product FR tests pass; deferred features remain absent from MVP dependency paths | TC-01–TC-85 as mapped; UX-01 |
| RG-02 Financial integrity | Engineering Lead + Product Owner | Fixed-scale money, Transfer symmetry, linked-refund constraints, immutable dates, archive invariance, and Budget/Analysis/PDF calculations pass | TC-01–TC-07, TC-13, TC-29/30, TC-39–TC-42, TC-57–TC-61, TC-83–TC-85 |
| RG-03 Recurrence durability | Engineering Lead + QA Lead | Every disposition, backlog/reopen/user action, delete/reopen, edit, archive, tombstone, backup/restore, and whole-pass rollback test passes | TC-16–TC-24, TC-42, TC-44–TC-56, TC-82 |
| RG-04 Backup/recovery | Engineering Lead + QA Lead | v5 export/restore, compatibility rejection, refund/backlog integrity, maintenance lock, journal fault matrix, reset recovery, and device-state normalization pass | TC-09/10, TC-26, TC-34/36, TC-53/54, TC-62–TC-68, TC-82–TC-85, REC-BKP-01 |
| RG-05 Security | Security Owner | Passcode/biometrics/lockout/KDF/logging tests and reviews pass; lock copy makes no encryption claim | TC-11, TC-25/26/37, TC-70–TC-73, INS-SEC-01–03, SEC-REV-01 |
| RG-06 Privacy/store compliance | Privacy Owner + Release Manager | OS backup exclusion, telemetry consent/allowlist/opt-out, privacy policy, and store declarations match the release build | TC-76/77, INS-PRV-01–03, PRIV-VER-01/02 |
| RG-07 Notifications | QA Lead | Permission, exactly-one scheduling, change/disable, restart/timezone reconciliation, and limitation copy pass | TC-12, TC-74/75 |
| RG-08 Accessibility | UX Lead + QA Lead | Every MVP screen passes NFR-07; no blocking issue remains | TC-27, A11Y-01 |
| RG-09 Performance/compatibility/offline | Engineering Lead + QA Lead | PERF-01, PERF-GOV-01, COMPAT-01, UX-01, and TC-81 pass on recorded release builds | PERF-01, PERF-GOV-01, COMPAT-01, UX-01, TC-81 |
| RG-10 Architecture/documentation | Engineering Lead + Requirements Owner | Schema v5, generated native config, routes, dependencies, test ownership/cadence, traceability, and REL-EVD-01 match this baseline | INS-BKP-01/02, INS-ARC-01, QA-PLAN-01, REL-EVD-01 |

### Release disposition

- **MVP:** everything marked Approved MVP or Confirmed source in Sections 2–14.
- **Phase 2/3:** only the explicitly Deferred items in Sections 2, 4, and the relevant FR rows. They do not block any RG gate.
- **Not applicable:** a Deferred test row has no MVP evidence requirement and must not be counted as a pass.

## 17. Traceability matrix

The matrix maps every normative objective/rule/requirement group to concrete verification and a release gate. Row-level verification in Sections 7–8 remains authoritative; this matrix shows cross-cutting semantic coverage rather than mere ID existence.

| Objective / rules | Requirements | Data / screens | Verification | Gate |
|---|---|---|---|---|
| O1; NFR-06 | FR-TRN-001–003, FR-NAV-001/002 | Transaction; SCR-01/05 | TC-01, TC-30, TC-39, TC-78, UX-01 | RG-01, RG-09 |
| O2; BR-01–BR-11; BR-23 | FR-TRN-001–011, FR-ACC, FR-CAT, FR-BUD, FR-ANA | Account, Category, Transaction/refund link, Budget; SCR-01/02/04/05/06/07 | TC-01–TC-08, TC-13/14, TC-28–TC-32, TC-38–TC-43, TC-57–TC-61, TC-83–TC-85 | RG-01, RG-02 |
| O3; BR-18–BR-22 | FR-BKP, FR-PDF, FR-SEC, FR-PRV, FR-SET-003, FR-ERR-002/003 | All portable data, SecureStore, journals; SCR-08/09/11/12 | TC-09/10, TC-26, TC-34–TC-37, TC-53/54, TC-62–TC-80; all BKP/SEC/PRV artifacts | RG-04–RG-06, RG-10 |
| O4; BR-12–BR-17 | FR-REC-001–016 | Rule, Revision, Pause, Ledger, Transaction; SCR-05/10 | TC-16–TC-24, TC-42, TC-44–TC-56, TC-82 | RG-03 |
| BR-01–BR-04 | FR-TRN-001/002/007–010, FR-ERR-001 | Transaction, Account | TC-01–TC-03, TC-07, TC-29, TC-40/41 | RG-02 |
| BR-05–BR-07 | FR-TRN-003, FR-SET-001, NFR-05 | Every monetary entity | TC-13, TC-30, TC-39 | RG-02 |
| BR-08 | FR-TRN-005, FR-REC-013, FR-ANA-001, FR-BUD-001/002 | Transaction accountingDate | TC-04, TC-42, TC-49, TC-59/61 | RG-02, RG-03 |
| BR-09/10 | FR-ACC-003/004, FR-CAT-002/003, FR-BUD-005, FR-REC-010 | Account, Category and all references | TC-05/08/18/19, TC-32, TC-51, TC-57/58/60 | RG-02, RG-03 |
| BR-11 | FR-BUD-001/004 | Budget | TC-59 | RG-02 |
| BR-12–BR-17 | FR-REC-003–016 | Recurrence entities | TC-16–TC-24, TC-44–TC-56, TC-82 | RG-03 |
| BR-18–BR-20 | FR-BKP-001–012 | Backup v5, staging, journals | TC-09/10, TC-34/36, TC-53/54, TC-62–TC-68, TC-82–TC-85; INS-BKP-01/02; REC-BKP-01 | RG-04 |
| BR-23 | FR-TRN-001/002/006/008–010, FR-BUD-002, FR-ANA-001–003, FR-BKP-004, FR-PDF-002 | Transaction refund link; SCR-01/02/04/05/08 | TC-35/40/41/61, TC-83–TC-85 | RG-01, RG-02, RG-04 |
| BR-21 | FR-SEC-001–007 | SecureStore; SCR-09/11 | TC-11, TC-25/26/37, TC-70–TC-73; SEC-REV-01 | RG-05 |
| BR-22 | FR-PRV-002–005 | Consent, telemetry queue/config | TC-77; INS-PRV-01/03; PRIV-VER-01/02 | RG-06 |
| FR-PDF-001–003 | UC-10 | Transaction snapshots; SCR-08 | TC-35/36/57/69 | RG-01, RG-04 |
| FR-SET-001–003 | UC-12 | Portable/device Preferences; SCR-09 | TC-13/38/39/62 | RG-01, RG-02, RG-04 |
| FR-NOT-001–004 | UC-13 | Device-local reminder; SCR-09/system | TC-12, TC-74/75 | RG-07 |
| FR-NAV-001/002 | All use cases | `src/app`, gates, every SCR | TC-15/66/78; INS-ARC-01 | RG-01, RG-10 |
| FR-ERR-001–004 | Cross-cutting | Repositories, journals, gates | TC-07/12/22/29/30/36/41/55/56/63/65/79/80 | RG-02–RG-05 |
| NFR-01 | All core use cases | All MVP screens/services | TC-81 | RG-09 |
| NFR-02 | O3 | Storage/config/telemetry | TC-76/77; INS-PRV-01–03 | RG-06 |
| NFR-03 | Scale and recurrence | All high-volume screens/services | TC-21/33; PERF-01 | RG-09 |
| NFR-04 | Platform support and benchmark-anchor lifecycle | Release builds/reference devices | COMPAT-01, PERF-GOV-01 | RG-09 |
| NFR-05 | Monetary correctness | Every monetary entity | TC-13/30/39 | RG-02 |
| NFR-06 | O1 | SCR-01/05 | UX-01 | RG-01, RG-09 |
| NFR-07 | All screens | SCR-01–12 | TC-27; A11Y-01 | RG-08 |
| NFR-08 | Recovery/idempotency | Ledger, backup/reset journals | TC-43/53/55/65–TC-68; REC-BKP-01 | RG-03, RG-04 |

Deferred FR-TRN-012, FR-REC-017, FR-BUD-006, FR-ANA-004, FR-BKP-012, and FR-PDF-004 are intentionally absent from MVP release gates. Section 2’s other Deferred items likewise have no normative MVP dependency.

## 18. Decision resolution register

Every v1.3 unresolved decision/assumption and every product or release choice raised after v1.4 is resolved below. “Approved Deferred” means the deferral itself is approved and creates no MVP obligation.

| ID / former ref | Selected decision and rationale | Status | Owner | Dependent sections | Release impact |
|---|---|---|---|---|---|
| D-01 / #1, AUD-02 | Use Expo SQLite for relational financial data; SecureStore only for credentials/lockout. Indexed relations and atomic transactions are required. | Approved MVP | Engineering Lead | 9, 11, 12 | RG-02/03/04 |
| D-02 / #2, AUD-03 | No Free/Pro entitlement in MVP; unified feature set. Avoids a backend/entitlement dependency. | Approved MVP | Product Owner | 2, 4 | None beyond scope inspection |
| D-03 / #3, AUD-04 | Passcode is an access gate; database/backup encryption deferred and must not be claimed. | Approved MVP / Approved Deferred | Product Owner + Security Owner | 2, 7 FR-SEC, 14 | RG-05 |
| D-04 / #4, AUD-05 | Widgets are Phase 3 and require a fresh feasibility review; no current SQLite/widget limitation is asserted as fact. | Approved Deferred | Engineering Lead | 2, 4, 9 | None |
| D-05 / #5, AUD-06 | QA scale targets are 500 accounts/200 categories plus the complete PERF-01 dataset. No UI hard cap. | Approved MVP | QA + Engineering Leads | 7, 8, 15 | RG-09 |
| D-06 / #6, AUD-08 | Restore replaces all portable data; merge is Deferred. | Approved MVP / Approved Deferred | Product Owner | FR-BKP, BR-19 | RG-04 |
| D-07 / #7, AUD-09 | Transfer is a dedicated two-account type excluded from Income/Expense/Budget aggregates. | Approved MVP | Product Owner | BR-02/04, FR-TRN | RG-02 |
| D-08 / #8, AUD-10 | Referenced entities cannot hard-delete; archive preserves all history. Budget and recurrence references are included. | Approved MVP | Product Owner | BR-09/10, FR-ACC/CAT | RG-02/03 |
| D-09 / #9, AUD-11 | Balances are computed from opening balance plus confirmed transactions; archive does not exclude history. | Approved MVP | Engineering Lead | BR-03, FR-ACC | RG-02 |
| D-10 / #10, AUD-12 | Monthly Budgets do not roll over or prorate; edits replace one month’s limit. | Approved MVP | Product Owner | BR-11, FR-BUD | RG-02 |
| D-11 / #11, AUD-13 | Use immutable accounting dates and recurrence revision timezone; do not regroup history after travel. | Approved MVP | Engineering Lead | BR-08, FR-TRN-005, FR-REC-013 | RG-02/03 |
| D-12 / #12, AUD-14 | Search/filter remains Deferred; recurring rules are MVP. | Approved MVP / Approved Deferred | Product Owner | 2, FR-TRN-012, FR-REC | RG-01/03 |
| D-13 / #13 | PDF is the only MVP report export; spreadsheet export Deferred. | Approved MVP / Approved Deferred | Product Owner | FR-PDF | RG-01 |
| D-14 / #14 | Use the initial PERF-01 reference devices, but review and replace them under PERF-GOV-01 when release, SDK, OS-window, availability, or representative-tier triggers occur. This preserves comparable evidence without freezing obsolete hardware. | Approved MVP | QA Lead + Engineering Lead | NFR-03/04, PERF-01, PERF-GOV-01 | RG-09 |
| D-15 / #15, AUD-15 | Cap automatic generation/review at 30 per rule per pass. Older due dates become durable, recoverable `deferred_backlog` rows; only an explicit named user action may generate or terminally exclude them. | Approved MVP | Product Owner | O4, BR-12/13, FR-REC-003/004 | RG-03 |
| D-16 / #16, AUD-16 | Backup includes complete recurrence/tombstone/revision/pause/ledger history. | Approved MVP | Engineering Lead | FR-REC-015, FR-BKP | RG-03/04 |
| D-17 / #17, AUD-17 | Pause intervals are date-based `[start,end)` and never backfilled. | Approved MVP | Product Owner | FR-REC-008 | RG-03 |
| D-18 / #18, AUD-18 | Archive auto-pauses rules, terminally skips pending rows, and never auto-resumes. | Approved MVP | Product Owner | FR-REC-010 | RG-03 |
| D-19 / #19 | Seed Food, Transport, Bills, Shopping, Health, Salary, Other. | Approved MVP | Product Owner | Section 6, FR-CAT-004 | RG-01 |
| D-20 / #20, AUD-19 | Use a separate durable ledger; pending is not a Transaction. Confirmed creates one Transaction; all other dispositions have no accounting effect. | Approved MVP | Product + Engineering Leads | BR-12–15, FR-REC | RG-03 |
| D-21 / #21, AUD-20 | Retain date-based pause periods plus immutable rule revisions; boolean pause alone is insufficient. | Approved MVP | Engineering Lead / Data Architect | 11, FR-REC-008/009 | RG-03 |
| D-22 / #22, AUD-21 | Use the persisted escalating lockout state machine in FR-SEC-005/006. | Approved MVP | Security Owner | FR-SEC, 14 | RG-05 |
| D-23 / #23, AUD-22 | Forgot passcode performs journaled Delete & Reset; recovery requires a supported external backup and reenrollment. | Approved MVP | Product + UX + Security | O3, FR-BKP-003/009, FR-SEC-007 | RG-04/05 |
| D-24 / #24, AUD-23 | NFR-07 is the mandatory MVP accessibility baseline; formal certification Deferred. | Approved MVP / Approved Deferred | Product + UX Leads | NFR-07, A11Y-01 | RG-08 |
| D-25 / #25, AUD-24 | Permit opt-in crash reporting only under the explicit allowlist/configuration and release disclosure process; provider selection may change only if identical requirements pass. | Approved MVP | Privacy Owner + Release Manager | FR-PRV | RG-06 |
| D-26 / #26, AUD-25 | UI disables Save and repository persists/replays a unique idempotency token across restart. | Approved MVP | Engineering Lead | FR-TRN-011 | RG-02 |
| D-27 / #27, AUD-26 | Transfer edits/deletes use one exclusive transaction and fault-injection proof. | Approved MVP | Engineering Lead | BR-04, FR-TRN-007 | RG-02 |
| D-28 / #28, AUD-27 | Fixed scale 2, decimal arithmetic, half-up at write, 0/2 display-only preference, reject non-positive/rounded-zero. | Approved MVP | Product + Engineering | BR-05–07, FR-TRN-003 | RG-02 |
| D-29 / #29, AUD-28 | Duplicate clears recurrence/refund links and receives a new idempotency token; a duplicated refund becomes a purchase Expense draft. | Approved MVP | Product + Engineering | FR-TRN-006 | RG-02 |
| D-30 / #30, AUD-29 | Archived entities are hidden from active pickers and remain in all historical accounting. | Approved MVP | Product Owner | BR-09, FR-ACC/CAT | RG-02 |
| D-31 / #31, AUD-30 | Use PERF-01’s reproducible frame, response, dataset, build, backlog-inclusive catch-up protocol, and PERF-GOV-01 device lifecycle. | Approved MVP | Engineering + QA Leads | NFR-03/04 | RG-09 |
| D-32 / #32, AUD-31 | Support only defined schema v5; reject unverifiable earlier draft formats. | Approved MVP | Product + Engineering | BR-20, FR-BKP-010/011 | RG-04 |
| D-33 / #33, AUD-32 | Restore validates staging completely and uses journaled old-or-new swap/recovery. | Approved MVP | Engineering Lead | BR-19, FR-BKP-004–008 | RG-04 |
| D-34 / #34, AUD-33 | PDF shows labeled Transfers outside totals and immutable recurring-origin text. | Approved MVP | Product + Design | FR-PDF-002 | RG-01 |
| D-35 / #35, AUD-34 | Objectives use the measurable text in Section 2; O1 uses time and non-keypad actions. | Approved MVP | Product Owner | O1–O4 | RG-01/09 |
| D-36 / #36, AUD-35 | Every disk-full path has operation-specific rollback/journal behavior; recurrence is whole-pass atomic. | Approved MVP | Engineering + QA Leads | FR-ERR-002, FR-REC-016, FR-BKP | RG-03/04 |
| D-37 / OQ-01 | Re-lock after 60 seconds background; immediate for cold launch/device-lock signal. | Approved MVP | Security Owner | FR-SEC-004 | RG-05 |
| D-38 / OQ-02 | NFR-07 baseline required; certification beyond it Deferred. | Approved MVP / Approved Deferred | UX Lead | NFR-07 | RG-08 |
| D-39 / OQ-03 | A published privacy policy matching release behavior is mandatory. | Approved MVP | Privacy Owner | FR-PRV-005 | RG-06 |
| D-40 / OQ-04 | MVP release markets are those explicitly entered in REL-EVD-01; Privacy/Release must review applicable requirements for each before submission. No country-specific compliance is assumed without that review. | Approved MVP | Privacy Owner + Release Manager | FR-PRV-005, RG-06 | RG-06 |
| D-41 / former CRUD/navigation assumptions | Former FR-TRN-009, FR-ACC-004, FR-CAT-003/005, FR-PDF-002, FR-SET-008, FR-NOT-002, and FR-NAV-004 are adopted in revised FR-TRN-008–010, FR-ACC-001, FR-CAT-001/004, FR-PDF-003, FR-SET-002, FR-NOT-001, and FR-NAV-002 with exact tests. | Approved MVP | Product Owner | FR-TRN/ACC/CAT/PDF/SET/NOT/NAV | RG-01/02/07 |
| D-42 / former resilience assumptions | Former FR-BKP-005, FR-ERR-001/003/005, NFR-02, and NFR-06 are adopted and made precise in FR-BKP-004–009, FR-ERR-001–004, NFR-02/06, and their journal/privacy/UX artifacts. Failed writes preserve prior state/input; corrupt DB never auto-overwrites. | Approved MVP | Engineering Lead | FR-ERR, FR-BKP, NFR-02/06 | RG-04/06/09 |
| D-43 / former Vision/persona/local-only assumptions | The former Vision, persona, and “no backend planned” assumptions are approved as Sections 2–3 and the local-only architecture in Sections 9/14. Only traced objectives/requirements create release obligations. | Approved MVP | Product Owner | 2, 3, 9, 14, 17 | RG-01/06 |
| D-44 / review F-01/F-02 | Retained rule tombstones, revisions, ledger, and transaction snapshots resolve deletion and regeneration without deleting financial history. | Approved MVP | Product + Engineering Leads | BR-12–17, 11, FR-REC | RG-03 |
| D-45 / review F-04/F-05 | Restore uses staged swap; security state is non-portable and normalized OFF after restore/reset. | Approved MVP | Engineering + Security | BR-18/19, FR-BKP | RG-04/05 |
| D-46 / review F-07 | Archive never changes historical aggregates; Budget is a deletion-restricting reference; pending rows skip on target archive. | Approved MVP | Product Owner | BR-09/10, FR-REC-010 | RG-02/03 |
| D-47 / review F-13 | Implicit OS-managed backup of financial data is prohibited; only explicit export may leave the sandbox. | Approved MVP | Privacy + Engineering | FR-PRV-001 | RG-06 |
| D-48 / review F-14–F-16 | Adopt exact KDF/lockout/authentication and telemetry allowlist/verification rules. | Approved MVP | Security + Privacy Owners | FR-SEC, FR-PRV | RG-05/06 |
| D-49 / post-v1.4 recurrence-cap risk | Preserve capped occurrences as a visible backlog and require explicit generate/exclude actions. Silent irreversible exclusion would make lapsed-user history unrecoverable. | Approved MVP | Product Owner | O4, BR-13, SCR-10, FR-REC-003/004/010/011/015/016, Sections 11–13, TC-16/46/52/54/82 | RG-03/04 |
| D-50 / post-v1.4 verification-capacity risk | Keep all finance/security acceptance coverage and execute it through three owned suites with PR, nightly, and RC cadence. Test IDs are assertions and may share automated runs; scope may leave a gate only by approved document revision. | Approved MVP | Engineering Lead + QA Lead | Section 15, QA-PLAN-01, RG-01/RG-10 | RG-01–RG-10 |
| D-51 / post-v1.4 device-drift risk | Review the OS window and performance anchors at each stated trigger, use same-or-lower-tier replacements, overlap benchmark where possible, and retain historical evidence. | Approved MVP | QA Lead + Engineering Lead | NFR-04, PERF-01, PERF-GOV-01 | RG-09 |
| D-52 / post-v1.4 refund-reporting risk | Model a refund as a positive linked Expense refund that credits an account and reduces Expense/Budget on its own accounting date. It is never Income; cumulative refunds cannot exceed the purchase and recurrence cannot create one. | Approved MVP | Product Owner + Engineering Lead | O2, BR-01–03/23, FR-TRN/BUD/ANA/BKP/PDF, Sections 11–13, TC-83–TC-85 | RG-01/02/04 |

## 19. Requirements change log

| Change | Affected IDs | Reason |
|---|---|---|
| Replaced irreversible cap exclusion with recoverable backlog and explicit user resolution | O4; BR-13/17; SCR-10; FR-REC-003/004/010/011/015/016; Sections 11–13; TC-16/46/52/54/82; D-15/49 | Preserve lapsed-user occurrences without silently changing totals or creating an unbounded review batch |
| Replaced refund-as-Income with linked Expense-refund accounting | O2; BR-01–03/23; FR-TRN-001/002/006/008–010; FR-BUD-002; FR-ANA-001–003; FR-BKP-004; FR-PDF-002; Sections 11/13; TC-35/40/41/61/83–85; D-52 | Keep Income truthful and define account, range, Budget, deletion, concurrency, export, and restore semantics |
| Added verification execution ownership and cadence | Section 15; QA-PLAN-01; RG-01/RG-10; D-50 | Make the acceptance set executable by a small MVP team without dropping required financial/security evidence |
| Added performance-device lifecycle governance | NFR-04; PERF-01; PERF-GOV-01; RG-09; D-14/31/51 | Prevent benchmark anchors from becoming incompatible or unrepresentative as OS support moves |
| Incremented portable backup format to schema v5 | BR-18/20; FR-BKP-001/004/010/011; Section 11; backup tests/artifacts | Encode the new refund and recurrence-backlog contracts and reject undocumented draft formats conservatively |
| Added durable occurrence ledger and immutable rule revisions/tombstones | BR-12–17; FR-REC-003–016; Section 11 | Prevent regeneration after caps, skip, deletion, edits, rule removal, and restore |
| Replaced pending Transaction model with pending ledger snapshot | Former FR-REC-002/003/015/016 → FR-REC-003/005/007 | Keep unconfirmed items outside the financial ledger while retaining idempotency |
| Defined whole-pass recurrence atomicity | FR-REC-016; FR-ERR-002 | Eliminate ambiguous partial success and retry behavior |
| Fixed canonical money at scale 2 and made 0/2 decimals display-only | BR-05–07; FR-TRN-003; FR-SET-001 | Prevent silent rescaling and define rounding/zero/negative behavior |
| Added complete correction/category validation in v1.4; v1.5 supersedes its refund-as-Income rule | FR-TRN-002/003/008/010; FR-REC-001; Section 13 | Align every write/import path with one accounting model |
| Replaced read-time local grouping with immutable accounting dates | BR-08; FR-TRN-005; FR-REC-013 | Prevent travel/timezone/DST reshuffling |
| Defined archive and Budget-reference behavior | BR-09/10; FR-ACC; FR-CAT; FR-BUD-005; FR-REC-010 | Preserve history and reject unsafe hard deletion |
| Replaced generic restore atomicity with staged swap/journal recovery | BR-19; FR-BKP-004–009; SCR-12 | Guarantee complete old-or-new state after failure |
| Replaced universal legacy compatibility with a single defined-version matrix; current version is v5 | BR-20; FR-BKP-010/011 | Reject unverifiable formats conservatively |
| Split portable Preferences from device-local security/privacy state | BR-18; FR-BKP-002/003; Section 11 | Prevent restored backups from recreating inaccessible locks or consent |
| Replaced fixed short lockout with complete state machine and KDF | BR-21; FR-SEC-001–007 | Make authentication deterministic and reviewable |
| Added OS-backup prohibition and telemetry allowlist/lifecycle | BR-22; FR-PRV-001–005 | Enforce privacy-by-default and store disclosure accuracy |
| Expanded notification behavior | FR-NOT-001–004 | Cover permission, exactly-one scheduling, disable, reboot, and timezone reconciliation |
| Replaced performance wording with PERF-01 | NFR-03 | Create reproducible release acceptance criteria |
| Expanded accessibility to all MVP screens and contrast evidence | NFR-07; A11Y-01 | Close partial screen/contrast coverage |
| Corrected Expo/API and route claims | Sections 9–10; FR-NAV-001 | Use SDK 57/CNG language, `src/app/`, and avoid deprecated BackgroundFetch |
| Replaced representative 38-test list with complete verification plan, then extended it for v1.5 | TC-01–TC-85 and named artifacts | Supply explicit evidence for every normative area |
| Replaced proposed/open/assumption statuses with approved decisions or approved deferrals | Entire document; D-01–D-52 | Remove conditional downstream behavior |
| Rebuilt release gates and semantic traceability | Sections 16–17 | Make release disposition evidence-based |

### Identifier disposition from v1.3

| v1.3 identifiers | v1.5 disposition |
|---|---|
| BR-01–BR-12 | Modified and expanded into BR-01–BR-23. Former archive, currency, recurrence, restore, authentication, privacy, and refund rules are separated so each has a testable concern. |
| FR-TRN-001–010, 013–014 | Modified/split into FR-TRN-001–011. Former duplicate-origin helper FR-TRN-014 is incorporated into FR-TRN-006; atomic edit/delete behavior is consolidated under FR-TRN-007–009. |
| Former FR-TRN-011 | Renumbered FR-TRN-012 and remains Deferred. |
| Former superseded FR-TRN-012 placeholder | Removed; FR-REC is the only recurrence requirement group. |
| FR-REC-001–016 | Materially rewritten and expanded to FR-REC-001–017 around a separate occurrence ledger, rule revisions, tombstones, deterministic dates, and whole-pass rollback. |
| FR-ACC-001–009 | Consolidated into FR-ACC-001–005; unlimited-source wording becomes a no-UI-cap scale target, while archive/picker/history requirements are combined. |
| FR-CAT-001–007 | Consolidated into FR-CAT-001–005; seed content is approved and Budget references are added to deletion guards. |
| FR-BUD-001–008 | Consolidated into FR-BUD-001–006; uniqueness, accounting-date range, archive behavior, mid-month edit, and non-rollover are explicit. |
| FR-ANA-001–006 | Consolidated into FR-ANA-001–004; custom ranges, ranking/ties/percentages/zero state share one defined result set; two future charts remain Deferred. |
| FR-BKP-001–011 | Rewritten/expanded into FR-BKP-001–012. Blanket older-schema success is removed; staged swap, journal recovery, maintenance lock, security normalization, reset recovery, and v5-only policy are added. |
| FR-PDF-001–005 | Consolidated into FR-PDF-001–004; content, temporary-file lifecycle, storage failure, and deferred spreadsheet export are separated. |
| FR-SEC-001–010 | Rewritten into FR-SEC-001–009 plus SEC-REV-01. Exact passcode, KDF, lockout, fallback, recovery, limitation, and logging behavior replace recommended/open wording. |
| FR-SET-001–009 | Presentation/preferences remain FR-SET-001–003; former analytics/disclosure content moves to dedicated FR-PRV-001–005; extra themes remain Deferred. |
| FR-NOT-001–004 | Modified in place to define permission, exactly-one scheduling, disable, restart/timezone reconciliation, and delivery limitations. |
| FR-WDG-001–006 | Removed from normative FRs and recorded as Phase 3 Deferred scope; no MVP architecture or release gate depends on a widget. |
| FR-NAV-001–004 | Consolidated into FR-NAV-001–002 and corrected to `src/app/` with explicit database/lock gates. |
| FR-ERR-001–010 | Reorganized into FR-ERR-001–004; domain validation moves to its owning FRs/Section 13 and operation-specific recovery moves to FR-REC/FR-BKP/FR-PRV. |
| NFR-01–07 | Modified/expanded into NFR-01–08. Performance becomes PERF-01; OS backup, accessibility, and crash consistency are explicit. |
| SCR-01–11 | Modified and supplemented with SCR-12 Restore Recovery. |
| UC-01–17 | Modified for approved archive/restore/rule-removal/recovery behavior; IDs retained. |
| TC-01–38 | Retained IDs with revised or superseding pass criteria; former legacy-success TC-20 is explicitly superseded by conservative TC-68. |
| TC-39–85 and named artifacts | Added for previously uncovered calculations, state transitions, failure paths, privacy/security controls, platform inspection, recurrence backlog, refunds, and release gates. |

## 20. Final consistency audit

### Confirmed by document inspection

- No Proposed, Assumption, Recommended, or Open Question status remains on the MVP critical path.
- Every material High review finding is addressed by normative rules, storage behavior, failure/recovery behavior, at least one acceptance scenario, and a release-gated test or artifact.
- Financial history is not deleted to simplify recurring-rule or entity referential integrity. Rule removal uses retained tombstones and immutable origin snapshots.
- Existing money is never silently rescaled; the 2→0→2 behavior is explicit and tested.
- Every evaluated recurring date has a durable disposition; capped dates remain recoverable until an explicit user action, and deletion, edits, archive, rule removal, repeated opens, backup, and restore have deterministic outcomes.
- Restore and reset specify startup recovery. Restore exposes a complete old or new dataset, and restored security/consent state is normalized OFF.
- Expense refunds are linked to their purchase, never counted as Income, constrained against over-refund, and traced through balances, Budgets, Analysis, PDF, deletion, concurrency, backup, and restore tests.
- The compatibility claim is limited to schema v5, the only schema defined and testable in this baseline.
- Every Approved MVP objective, BR, FR, NFR, security/privacy obligation, and release gate maps to a named Section 15 test or verification artifact; QA-PLAN-01 assigns execution ownership and cadence.
- Deferred Phase 2/3 work has no MVP release dependency: background recurrence, widgets, search/filter, spreadsheet export, budget rollover, extended charts, multi-currency, encryption, entitlement, extra themes, and formal certification beyond NFR-07.

### Residual risks

- A specification cannot prove implementation correctness. Restore crash consistency, native backup exclusion, biometric fallback, native crash payloads, OS notification behavior, and performance require the device/build evidence mandated in Section 15.
- SDK 57 and store/platform rules can change after this baseline. Any SDK upgrade or later store submission requires version-matched documentation review and a compatibility/security/privacy re-run.
- Schema v1–v4 backups are intentionally unsupported because those identifiers came from unreleased drafts and authoritative canonical schemas/fixtures are unavailable. Supporting them later requires the controlled process in FR-BKP-011.
- The recurrence cap now preserves rather than discards older occurrences, but a large backlog remains pending until the user explicitly generates or excludes it; the persistent count/date-range UI is required to keep that trade-off visible.
- Refunds are allocated by their receipt accounting date. A selected range may therefore show negative net Expense for a category even when the original purchase lies outside the range; the required “Net refund” label communicates that result.
- App lock does not encrypt local financial data or exported backups. The UI and store copy must maintain that limitation; encryption remains deferred.

This audit confirms internal specification readiness and traceability. It does not claim that an application build has passed the gates until REL-EVD-01 contains the required evidence.
