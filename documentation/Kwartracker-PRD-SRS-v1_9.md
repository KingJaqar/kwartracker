# Kwartracker — Product Requirements Document & Software Requirements Specification

**Product:** Kwartracker — offline-first personal expense tracker for iOS and Android

**Document type:** Combined PRD/SRS and release-acceptance baseline

**Version:** 1.9

**Date:** 2026-10-08

**Status:** **Approved MVP baseline**

**Implementation baseline:** Expo SDK 57 (`expo ~57.0.24`), React Native 0.86, TypeScript, Expo Router

Version 1.5 resolved every MVP decision that remained open in v1.3 and the four product/release risks identified after v1.4: recoverable capped recurrence, executable verification ownership, reference-device lifecycle, and true Expense-refund accounting. Version 1.6 adds an on-device, advisory-only assistive-suggestions feature set (O5, BR-24–27, FR-AUT-001–009, NFR-09/10, RG-11) and Deferred receipt-OCR pre-fill (FR-OCR-001), and amends FR-NOT-002 so disabling the daily reminder no longer cancels other features' scheduled notifications. Version 1.7 closes every open item raised by the independent post-v1.6 readiness audit: it replaces `SuggestionState`'s single hash-based key with explicit, kind-specific identity fields (resolving BR-27(b)'s orphan-pruning gap together with the related keying gap for `duplicate`, `budget_pace`, `low_balance`, `dormant_entity`, and `inactivity_nudge`, and BR-26's `expenseEffect` conflict); adds the occurrence counter FR-AUT-002's three-strikes rule requires; defines FR-AUT-003's previously-undefined dismiss/suppression behavior; scopes FR-AUT-009's arbitration to the same-screen collisions the architecture actually produces and rewrites TC-94 accordingly; resolves a self-contradiction in NFR-10's wording; places the FR-AUT-002 modal unambiguously on SCR-05 at Save time; extends payload-inspection coverage to FR-AUT; adds FR-BUD-007, a Budget-deletion requirement that FR-CAT-002 already presupposed but that was never itself specified; and broadens INS-SEC-02's device coverage for biometric-fallback verification. No prior Approved MVP behavior is weakened by this revision — each change either supplies a previously-missing mechanism or narrows previously-ambiguous wording to match behavior already intended elsewhere in this baseline. The product, engineering, QA, security/privacy, and release obligations in this document are normative. The original source PDF, recurring-rules addendum, forensic review, older decision register, change log, and generation prompt were not located in the repository during v1.5 and remain historical evidence only; no claim in this document depends on their availability.

Version 1.8 adds a normative design system, Section 6A, directly inside this baseline rather than as a separate document. It defines one theme with Dark and Light appearances, verified color tokens, bundled typography, a component catalogue, the amount keypad and entry layout, pop-up behavior, motion and haptics rules, performance and defect-prevention rules, and per-screen layouts, using BudgetFlow and CRED as design direction only. It adds FR-DSN-001–014, NFR-11, TC-97–TC-108, UI-PERF-01, DSG-REV-01, VIS-01, release gate RG-12, and decisions D-81–D-94. No existing objective, BR, FR, or data contract is weakened; FR-SET-002 is clarified so that Dark/Light are appearances of the single MVP theme.

Version 1.9 closes the three choices that v1.8 left loosely worded in Section 6A: the icon set is now named (Lucide, imported one icon per module, with a normative key-to-icon table), the list component is now named (`@shopify/flash-list` v2), and the screenshot-regression tolerance is now numeric. It adds decisions D-95–D-97 and changes no requirement's behavior.

## Table of contents

- [0. Authority, evidence, and requirement language](#0-authority-evidence-and-requirement-language)
- [1. Document control](#1-document-control)
- [2. Product vision, objectives, and scope](#2-product-vision-objectives-and-scope)
- [3. Personas and use cases](#3-personas-and-use-cases)
- [4. Feature catalogue](#4-feature-catalogue)
- [5. Business rules](#5-business-rules)
- [6. Information architecture and user experience](#6-information-architecture-and-user-experience)
- [6A. Design system](#6a-design-system)
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
| Document title | Kwartracker PRD/SRS v1.9 |
| Owner | Product Owner; requirement-quality stewardship by Product/Requirements Engineering |
| Approval | Approved MVP baseline by the authority of this revision request |
| Change control | A change to an Approved MVP objective, BR, FR, NFR, data contract, decision, test oracle, or release gate requires a version increment and corresponding updates to Sections 11, 15, 17, 18, 19, and 20 where affected. |
| Source status | v1.3 is the immediate predecessor of v1.5. Referenced supporting artifacts were not located and are not treated as current authority. |
| Backup schema | `backupSchemaVersion = 5`; compatibility policy is defined in FR-BKP-010 and Section 11. Unchanged by v1.6 through v1.9 (the v1.8 design system adds no Preferences field and defines only the allowed values of the existing `uiMode` and `theme`): the `SuggestionState` entity (Section 11) is device-local only, and v1.7's added fields on that entity carry no dependency on the portable schema version. |

### Revision history

- **v1.0–v1.3:** Historical drafts summarized in v1.3.
- **v1.4:** Resolves the independent review findings; approves the MVP decisions; introduces a durable recurring-occurrence ledger, immutable accounting dates, fixed-scale currency storage, safe staged restore, portable-versus-device-local preference rules, complete access-control and telemetry policies, reproducible performance criteria, complete verification artifacts, and corrected traceability.
- **v1.5:** Replaces irreversible recurrence-cap exclusion with a durable user-controlled backlog; defines linked Expense refunds and their account, Budget, Analysis, PDF, deletion, and restore behavior; assigns verification suites and cadence; adds reference-device review/replacement rules; and increments the backup schema to v5.
- **v1.6:** Adds an on-device, advisory-only assistive-suggestions feature set — recurring-pattern suggestion, duplicate-entry warning, category pre-fill, Budget pace alert, low-balance forecast, entry-cadence (inactivity) nudge, and dormant-entity review (O5; BR-24–27; FR-AUT-001–009; NFR-09/10; `SuggestionState`; RG-11) — plus Deferred on-device receipt-OCR pre-fill (FR-OCR-001). Amends FR-NOT-002 so the daily reminder's disable action cancels only its own scheduled notification, not every notification the app has scheduled, so it no longer conflicts with the new entry-cadence nudge. No backup-schema change and no new network dependency.
- **v1.7:** Resolves every item raised by the independent post-v1.6 readiness audit — see D-72–D-80 and the version-header summary above. Adds FR-BUD-007 (Budget deletion) and TC-96. No objective, BR, or FR is removed or weakened; all changes either add a previously-missing mechanism or correct ambiguous/self-contradictory wording. No backup-schema change.
- **v1.8:** Adds Section 6A (design system) and its requirements, tests, artifacts, release gate RG-12, and decisions D-81–D-94 — see the version-header summary above. FR-SET-002 is clarified; no other requirement is altered.
- **v1.9:** Names the icon set, the list component, and the VIS-01 tolerance in Section 6A and Section 15 (D-95–D-97). No requirement's behavior changes.

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
| O5 | Assistive suggestions (pattern detection, pace/forecast warnings, entry-cadence and dormant-entity nudges) shall reduce repeated manual entry and surface Budget/balance risk early, while never creating, editing, or deleting financial data without an explicit confirming user action, and never transmitting transaction content off-device. |

### MVP scope

The MVP includes Records; Income, purchase Expense, linked Expense-refund, and Transfer entry/edit/delete; Accounts; Categories; monthly category Budgets; one Analysis overview; versioned backup and replace-only restore; PDF export; a six-digit app passcode; optional biometric unlock; local reset and restore recovery; preferences; one local daily reminder; the accessibility baseline; weekday-based recurring rules evaluated while the app is active; and the assistive-suggestions feature set (O5).

Recurring-rule pattern suggestion, duplicate-entry warning, category pre-fill, Budget pace alert, low-balance forecast, entry-cadence (inactivity) nudge, and dormant-entity review are Approved MVP-additive scope: all but the entry-cadence nudge are read-derived from data the app already stores; the entry-cadence nudge additionally schedules a local OS notification (FR-AUT-006), a non-financial side effect distinct from a financial-data write. None require a backup-schema change and none add a network dependency.

### Deferred scope

Phase 2: background recurrence using the current supported Expo background-task API at implementation time; CSV/XLSX export; extended analysis views; budget rollover; encrypted user-created backups; optional database encryption; additional accessibility certification; and on-device receipt OCR pre-fill (FR-OCR-001), pending its own privacy review before approval.

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
| Assistive suggestions (recurring pattern, duplicate check, category hint, Budget pace, balance forecast, entry-cadence nudge, dormant-entity nudge) | Approved MVP addition (v1.6) | BR-24–27; FR-AUT |
| Receipt capture via on-device OCR | Approved Deferred (Phase 2/3) | FR-OCR-001 |
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
| BR-24 | No assistive/suggestion feature may create, edit, confirm, or delete a Transaction, Account, Category, Budget, or RecurringRule. Every suggestion is advisory; the resulting write, if any, occurs only through the normal FR-TRN/FR-ACC/FR-CAT/FR-BUD/FR-REC path after an explicit user action. |
| BR-25 | All pattern detection, category/duplicate heuristics, forecasting, and OCR processing run entirely on-device. No suggestion pipeline may open a network connection or transmit transaction content, note text, receipt images, or derived text off-device. |
| BR-26 | Dismissing a suggestion durably suppresses that specific pattern instance; it must not re-prompt identically. A materially changed pattern (e.g., a new qualifying occurrence that alters amount/cadence) may prompt again as a distinct instance. For FR-AUT-002, the pattern instance is the exact (account, `expenseEffect`, category, amount) combination already used as its suppression key — no separate "materially changed" case exists beyond a different combination. For FR-AUT-001, the pattern instance is its detection tuple (account, category, weekday set, amount bucket), so a changed amount bucket or weekday set is a distinct instance. For FR-AUT-003, the pattern instance is the (account, amount-bucket) combination; dismissing the pre-fill's "suggested" indicator suppresses a suggestion of the same category, and a different majority category for that combination is a materially changed instance. For FR-AUT-007, a materially changed instance is a later, distinct dormancy period for the same entity following an intervening confirmed transaction that ended the prior dormancy. BR-26's durable suppression applies only to features with a user dismiss/decline control (FR-AUT-001, 002, 003, 007); FR-AUT-004 and FR-AUT-005 are rate-limited notices (once per Budget per local day; once per account per app session) with no dismiss control, and FR-AUT-006 is a system notification, so none of those three creates BR-26 suppression state. |
| BR-27 | `SuggestionState` rows shall be pruned when (a) older than twice the owning feature's detection/lookback window — 120 days for FR-AUT-001's 60-day pattern window, 60 days for FR-AUT-005's 30-day forecast window, 10 days for FR-AUT-006's 5-day inactivity window, or 24 months for FR-AUT-007's 12-month dormancy window — (b) orphaned by a hard-deleted Account or Category whose id the row was derived from, or (c) a `budget_pace` row whose owning Budget's `YYYY-MM` accounting month is no longer the current month. `duplicate` (FR-AUT-002) and `category_hint` (FR-AUT-003) rows have no dated lookback window to double and are never pruned by (a) — their suppression is durable by design, not time-bound — so they are pruned only under (b), when orphaned. `budget_pace` (FR-AUT-004) rows are pruned by (c) rather than (a) or (b), since BR-11 makes a Budget non-rolling and specific to one accounting month, so its rows are neither bounded by a trailing window nor reliably cleaned up by a hard-delete — Budgets are not deleted merely because their month has passed. Pruning is best-effort and lazy (may run opportunistically at app open); an orphaned row that hasn't yet been pruned must never cause an error or block a suggestion pass. Rule (b) is a direct existence check of each row's plaintext `accountId`/`categoryId` (Section 11, resolved in v1.7) against the live Account/Category tables; no hash reversal is required. Deleting a Budget (FR-BUD-007) removes its `budget_pace` row immediately, independent of rule (c). |

## 6. Information architecture and user experience

| ID | Screen | Required behavior |
|---|---|---|
| SCR-01 | Records | Date-grouped confirmed transactions and month summary; recurring-origin marker; archived entity names remain visible; the entry-cadence nudge (FR-AUT-006) is a system notification, not a screen change here. The possible-duplicate warning (FR-AUT-002) is **not** presented on this screen — it appears on SCR-05 at Save time, before commit (see SCR-05) |
| SCR-02 | Analysis | Confirmed Income and net-Expense totals plus ranked positive net Expense-category chart for an inclusive custom accounting-date range; refund-only/negative category results remain visible in the list |
| SCR-03 | Expense Flow | Deferred |
| SCR-04 | Budgets | Month selection, unique per-category limits, spent/remaining, non-color over-limit indication; non-blocking Budget-pace banner, arbitrated per FR-AUT-009 (no other FR-AUT banner is assigned to this screen, so today the banner is shown whenever eligible, at most once per Budget per day; the arbitration rule applies automatically if a future FR-AUT feature is assigned here); a negative (net-refund) spent figure never qualifies for a pace alert (FR-AUT-004) |
| SCR-05 | Transaction Input | Income/Expense/Transfer, linked Expense-refund action, arithmetic keypad, validation, duplicate-safe Save, optional recurrence creation for purchases only; a possible-duplicate warning (FR-AUT-002) presented as a modal **at Save time, before the transaction is committed**, offering Save Anyway / Edit / Cancel, distinct from the explicit Duplicate clone action in FR-TRN-006 and labeled differently in the UI to avoid confusion; Category pre-fill for Income/purchase-Expense entry only (FR-AUT-003), shown with a small separately-dismissible "suggested" indicator; recurring-pattern suggestion prompt after Save when a qualifying pattern is detected (FR-AUT-001); none of the three suggestions applies to the Refund action |
| SCR-06 | Accounts | Balances, create/edit/archive/restore/delete subject to BR-10; optional "review dormant items" banner/list with a direct Archive action, excluding anything with an active RecurringRule or a non-terminal ledger row (FR-AUT-007); low-balance forecast banner, surfacing at most once per app session per account (FR-AUT-005) |
| SCR-07 | Categories | Income/Expense lists, create/edit/archive/restore/delete subject to BR-10; optional "review dormant items" banner/list with a direct Archive action, excluding anything with an active RecurringRule or a non-terminal ledger row (FR-AUT-007) |
| SCR-08 | Data Management | Backup, restore, PDF export, and authenticated Delete & Reset |
| SCR-09 | Preferences | Currency presentation, appearance, reminder, crash-report consent, passcode/biometric enrollment; single "Assistive suggestions" master toggle (FR-AUT-008); a "Reset suggestion history" action that clears all `SuggestionState` rows without affecting financial data (FR-AUT-008) |
| SCR-10 | Recurring Rules | Rules, revisions, pending and deferred-backlog counts, backlog review/generate/exclude, pause/resume/edit/remove actions; accepted recurring-pattern suggestions (FR-AUT-001) land in the normal FR-REC-001 rule-creation flow; declined suggestions do not appear here |
| SCR-11 | Lock and Recovery | App passcode/biometric unlock and unauthenticated Forgot passcode → Delete & Reset |
| SCR-12 | Restore Recovery | Pre-authentication recovery UI when a restore journal requires automatic completion or rollback; no financial UI is mounted until recovery finishes |

No new screens are added by the v1.6 assistive-suggestions feature set; the rows above are additive behavior on existing screens.

The bottom tab bar links Records, Analysis, Budgets, Accounts, and Categories. Records supplies the “+” entry control. A drawer exposes Preferences, Data Management, and Recurring Rules. Lock and database-recovery gates wrap the root navigator; SCR-11 and SCR-12 are root-stack screens, not tabs.

First launch seeds the approved categories Food, Transport, Bills, Shopping, Health, Salary, and Other, then guides the user to create an account. The user may edit/archive them under the normal rules.

## 6A. Design system

This section is normative. It is numbered 6A so that every existing cross-reference to Sections 7–20 stays valid. It defines the visual language, tokens, components, navigation chrome, pop-ups, motion, and performance rules that every MVP screen in Section 6 shall use. Requirements are FR-DSN-001–014 (Section 6A.14) and NFR-11 (Section 8). Where this section and a screen row in Section 6 differ, Section 6 defines *what* the screen does and Section 6A defines *how it looks, moves, and performs*; neither may weaken an FR/BR/NFR elsewhere.

### 6A.1 Reference direction and what is (and is not) borrowed

| Reference | Adopted as design direction | Deliberately not adopted |
|---|---|---|
| BudgetFlow (the iOS/macOS expense tracker) | Speed-first entry built around a purpose-made numeric keypad; calm card-based overview; native-feeling, low-clutter screens; category identity through simple icon tiles | Sync, widgets, Liquid Glass-style translucent materials, multi-"book" budgeting, and any other behavior outside this baseline's scope |
| CRED | Dark-first premium surfaces; confident, high-contrast typography; tactile buttons with a solid "pop" edge; one consistent component system; purposeful, restrained motion | CRED/NeoPOP brand assets, colors, typefaces, and trade dress; rewards and gamification; ornamental animation; inner-shadow neumorphism and blur (both are costly to render and fight the no-jank goal) |

References inform direction only. No third-party artwork, trademark, typeface file, or icon artwork is copied; Kwartracker's palette, type, and icons are original or openly licensed (attribution recorded in the third-party notices). The direction is derived from publicly described characteristics of those apps rather than a licensed pixel audit, so the authority for "does this match the intended feel" is the UX Lead's signature on DSG-REV-01, not resemblance to either app.

**Direction in one line: calm, tactile, numeric-first.** Surfaces are quiet so that money figures are the loudest thing on screen; controls feel physical through a small, fast, cheap-to-render press effect; nothing moves unless the movement explains a state change.

### 6A.2 Appearance model (FR-DSN-001)

Kwartracker has one theme, named `kwartracker`, with two appearances: **Dark** and **Light**. This is consistent with FR-SET-002 ("single MVP theme"): Dark/Light are appearance modes of that one theme, not additional themes. `PreferencesPortable.uiMode` takes the values `system` (default), `light`, or `dark`; `PreferencesPortable.theme` takes the single value `kwartracker`. A stored value outside these sets is read as the default and never raises an error. No Preferences field is added or removed, so the backup schema stays v5.

Dark is the primary design target and Light must reach parity on every screen and component. The first frame the user sees must already be in the correct appearance: native splash and app-config user-interface style are set to follow the system; the splash stays up until the database gate has resolved and `uiMode` has been read; screens that render before the database opens (SCR-12) use the system appearance.

### 6A.3 Color tokens

All colors are tokens. Values below are the only approved values. Ratios are WCAG 2.x contrast ratios computed from these exact hex values; TC-97 recomputes them from the token source so a changed value cannot ship unverified.

| Token | Dark | Light | Use |
|---|---|---|---|
| `bg` | `#0E0F13` | `#F5F6F8` | Screen background |
| `surface1` | `#16181E` | `#FFFFFF` | Cards, list rows, tab bar |
| `surface2` | `#1E2129` | `#F0F1F4` | Inputs, chips, nested containers |
| `surface3` | `#282C37` | `#E6E8ED` | Sheets, dialogs, pressed fills |
| `textPrimary` | `#F4F5F7` | `#13151A` | Money, titles, body (≥12.7:1 on every surface) |
| `textSecondary` | `#B3B9C6` | `#454B59` | Supporting text (≥7.0:1 on every surface) |
| `textTertiary` | `#9AA1B0` | `#5B6272` | Captions, placeholders (≥5.4:1 on `bg`, `surface1`, `surface2`) |
| `accent` | `#8B7CFF` | `#4F3FE0` | Primary action face, active tab, links (≥4.9:1 on `bg`, `surface1`, `surface2`) |
| `accentEdge` | `#5A4BD6` | `#3326A8` | Solid pop edge under accent buttons (decorative) |
| `onAccent` | `#0E0F13` | `#FFFFFF` | Label on `accent` (5.9:1 dark, 6.7:1 light) |
| `income` | `#4BE0A0` | `#0A6F48` | Income amounts and markers (≥8.2:1 dark; ≥5.0:1 light on every surface) |
| `expense` | `#FF8A80` | `#B3261E` | Over-limit and negative emphasis text (≥6.1:1 dark; ≥5.3:1 light) |
| `warning` | `#FFC15E` | `#8A5200` | Caution banners and pace alerts (≥10:1 dark; ≥5.6:1 light) |
| `danger` | `#FF6B6B` | `#B3261E` | Destructive button face and errors (≥5.7:1 on `bg`, `surface1`, `surface2`) |
| `dangerEdge` | `#C94A4A` | `#7F1913` | Pop edge under destructive buttons (decorative) |
| `onDanger` | `#0E0F13` | `#FFFFFF` | Label on `danger` (6.9:1 dark, 6.5:1 light) |
| `controlBorder` | `#6C7386` | `#7A8090` | Boundary of inputs, unselected chips, switch tracks (≥3.4:1 on `bg`, `surface1`, `surface2`, both appearances) |
| `divider` | `#262A33` | `#E1E3E8` | Decorative hairlines between rows and cards; never the only cue for a control |
| `scrim` | `#000000` at 56% | `#000000` at 40% | Behind sheets and dialogs |

Rules. `accent` and semantic colors may be used as text only on `bg`, `surface1`, and `surface2` (`textPrimary` and `textSecondary` may also be used on `surface3`). Color never carries meaning alone (NFR-07): over-limit pairs `expense`/`danger` with a warning icon and the words "Over by"; Income pairs `income` with a "+" sign and a down-arrow marker; every state marker has an icon or text twin.

**Money presentation convention.** Purchase Expenses are shown in `textPrimary` with a "−" sign, not in red, so a normal ledger stays calm and red keeps its alarm value. Income is shown in `income` with "+". An Expense refund is not Income (BR-23): it is shown in `textPrimary` with "+" and a "Refund" label, never in `income`. A Transfer is shown in `textSecondary` with a swap marker and no sign.

**Category identity color.** Category and Account records carry no color field and none is added. A category's color is derived deterministically: parse the first 8 hex characters of its UUID as an unsigned integer, take it modulo 12, and index the palette below. The same category therefore has the same color in every appearance, session, and restored backup. The icon tile is the palette color at 12% opacity over the row surface, with the icon drawn in the full palette color; every palette color is ≥3.4:1 against `bg`, `surface1`, and `surface2`, and ≥3.1:1 against the tinted tile.

| Index | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Dark | `#DF503A` | `#DF873A` | `#DFB63A` | `#C3DF3A` | `#7EDF3A` | `#3ADF71` | `#3ADFB6` | `#3AC3DF` | `#3A7EDF` | `#7065E6` | `#A34BE2` | `#DF3AA8` |
| Light | `#DD4831` | `#BD681F` | `#9A7919` | `#718415` | `#488C17` | `#189140` | `#178C6F` | `#1A889E` | `#3A7EDF` | `#5C50E2` | `#A550E2` | `#DD31A4` |

### 6A.4 Typography (FR-DSN-003)

One family keeps loading cheap and numerals consistent: **Inter**, weights 400, 500, 600, and 700, bundled into the app binary through the font config plugin so it works offline (NFR-01) and never downloads at runtime. Every monetary figure uses tabular numerals so columns of amounts align and digits do not jitter as values change. If a bundled font fails to load, the app falls back to the platform system font and continues; it never blocks launch or crashes. The native splash is held for fonts only up to 1.5 seconds beyond database-gate readiness.

| Role | Size / line (sp) | Weight | Use |
|---|---|---|---|
| `displayXL` | 40 / 48 | 700 | Month hero totals, entry amount |
| `displayL` | 32 / 40 | 700 | Account balance on cards |
| `titleL` | 24 / 32 | 700 | Screen titles |
| `titleM` | 20 / 28 | 600 | Section titles, sheet titles |
| `titleS` | 17 / 24 | 600 | Row titles, button labels |
| `body` | 16 / 24 | 400 | Body text, inputs |
| `bodyStrong` | 16 / 24 | 600 | Emphasis, amounts in rows |
| `label` | 14 / 20 | 500 | Chips, captions with action |
| `caption` | 12 / 16 | 500 | Metadata; no text anywhere is smaller than 12 sp |

Scaling and overflow rules. Text follows the user's font-size setting up to 200% (NFR-07). Money is never truncated, never ellipsized, and never hidden at any scale: money text wraps or, for the hero and entry displays only, shrinks to fit on one line down to 50% of its role size, and screen readers always receive the full value. Names truncate to one line with an ellipsis in rows, wrap to two lines at font scale ≥1.3, and show in full in edit screens. When font scale is ≥1.4, the tab bar shows icons only (each with its accessibility label) and the screen header always shows the current title, so navigation stays operable without clipped labels.

### 6A.5 Layout, shape, and elevation tokens

| Group | Tokens |
|---|---|
| Spacing (4 dp base) | `s1`=4, `s2`=8, `s3`=12, `s4`=16, `s5`=20, `s6`=24, `s8`=32, `s10`=40; screen horizontal padding `s4` |
| Radius | `rSm`=8, `rMd`=12, `rLg`=16, `rXl`=24 (sheet tops), `rFull`=999 |
| Touch targets | Minimum 44×44 dp (NFR-07); primary buttons 52 dp tall; keypad keys 56 dp tall (52 dp when the screen is shorter than 700 dp); floating entry button 56×56 dp |
| Elevation | Level 0: flat `bg`. Level 1: `surface1` plus a `divider` hairline; this is the only level used by cards and list rows. Level 2: `surface3` plus `scrim`, used by sheets and dialogs; one static, non-animated shadow is permitted here |

Elevation is communicated by tonal surface steps and hairlines, not by blur, translucency, gradients, or per-row shadows. These cost GPU and compositing time on mid-range Android devices and are exactly the effects that produce dropped frames in long lists.

### 6A.6 Iconography and category identity (FR-DSN-013)

Icons are a single outline family drawn on a 24 dp grid at 1.75 dp stroke. The approved icon set is **Lucide** (`lucide-react-native`, ISC license), rendered through `react-native-svg` and imported one icon per module (`lucide-react-native/icons/<name>`), never through the package's barrel export, so only the icons the registry uses are bundled. The package's full license text, including any notice it carries for inherited icons, is included in the third-party notices. Icons are addressed by registry key. `Account.icon` and `Category.icon` store registry keys. The registry shall include at least: `wallet`, `cash`, `bank`, `card`, `savings`, `ewallet`, `food`, `groceries`, `coffee`, `transport`, `fuel`, `bills`, `utilities`, `home`, `shopping`, `clothing`, `health`, `fitness`, `education`, `entertainment`, `travel`, `gifts`, `pets`, `kids`, `salary`, `business`, `investment`, `bonus`, `other`, plus the system glyphs the components below need. The seeded categories map to `food`, `transport`, `bills`, `shopping`, `health`, `salary`, and `other`. A key not present in the registry — for example one restored from a backup produced by a future build — renders the neutral `other` glyph; it never crashes, never blocks restore, and never alters stored data.

| Registry key | Lucide icon | Registry key | Lucide icon | Registry key | Lucide icon |
|---|---|---|---|---|---|
| `wallet` | `wallet` | `cash` | `banknote` | `bank` | `landmark` |
| `card` | `credit-card` | `savings` | `piggy-bank` | `ewallet` | `smartphone` |
| `food` | `utensils` | `groceries` | `shopping-basket` | `coffee` | `coffee` |
| `transport` | `bus` | `fuel` | `fuel` | `bills` | `receipt` |
| `utilities` | `zap` | `home` | `house` | `shopping` | `shopping-bag` |
| `clothing` | `shirt` | `health` | `heart-pulse` | `fitness` | `dumbbell` |
| `education` | `graduation-cap` | `entertainment` | `clapperboard` | `travel` | `plane` |
| `gifts` | `gift` | `pets` | `paw-print` | `kids` | `baby` |
| `salary` | `briefcase` | `business` | `store` | `investment` | `trending-up` |
| `bonus` | `sparkles` | `other` (fallback) | `circle-ellipsis` | | |

System glyphs: tabs use `receipt-text` (Records), `chart-column` (Analysis), `target` (Budgets), `wallet` (Accounts), and `layout-grid` (Categories). Actions and markers use `plus`, `x`, `check`, `delete` (keypad backspace), `menu`, `ellipsis`, `chevron-left`, `chevron-right`, `chevron-down`, `calendar`, `pencil`, `trash-2`, `copy` (Duplicate), `undo-2` (Refund), `archive`, `repeat` (recurring marker), `arrow-down-left` (Income), `arrow-up-right` (Expense), `arrow-left-right` (Transfer), `triangle-alert` (warning and over-limit), `info`, `lock`, `fingerprint`, and `settings`. If a name in this table does not exist in the pinned package version, the build fails in TC-107 and the nearest equivalent Lucide icon is substituted and recorded here; this is a mechanical rename, not a design decision.

### 6A.7 Navigation and chrome (FR-DSN-010)

- **Tab bar.** Five tabs (Records, Analysis, Budgets, Accounts, Categories) on `surface1` with a top `divider`, 64 dp tall plus the bottom safe-area inset, icon 24 dp with a 12 sp label, active tab in `accent` with a 3 dp bar above the icon, inactive in `textSecondary`. Switching tabs is instant: no cross-fade, no slide. Inactive tab screens stay mounted and are frozen, so they do not re-render on data writes until focused, and each tab keeps its scroll position and local state.
- **Entry control.** Records shows a 56 dp circular accent pop button with a "+" glyph, 16 dp from the right edge and 16 dp above the tab bar. It is the O1 start control. It never overlaps a list row's amount: Records list content has bottom padding equal to the control's height plus 32 dp.
- **Drawer.** Preferences, Data Management, and Recurring Rules open from a header menu button. The edge-swipe gesture is enabled only on the tab screens, never on pushed screens (entry, edit, sheets), so it cannot collide with the iOS back swipe or with horizontal controls.
- **Stack transitions.** Pushed screens (entry, edit, rule detail, Preferences pages) use the platform-native stack transition; no custom transition is built. Sheets and dialogs follow Section 6A.10.
- **Back.** The Android system back button and the iOS back swipe close the top-most layer first (sheet, then dialog, then screen). Back during a Save in progress is ignored until the write resolves.
- **Gates.** The lock and recovery gates (FR-NAV-002) render without any financial content visible beneath them; no financial text exists in the tree before unlock.
- **Orientation and form factor.** MVP supports phones in portrait only. Orientation is locked in app configuration and tablet layout is not a supported form factor. This removes a large class of layout-permutation defects (NFR-06 already defines one-handed portrait entry). A later revision may add landscape or tablet support.

### 6A.8 Component catalogue (FR-DSN-006)

Screens compose only these components. Each defines every state it can be in; a state not defined here is a defect.

| Component | Anatomy and size | States and behavior |
|---|---|---|
| **PopButton** (primary, secondary, destructive) | Height 52 dp, `rMd`, label `titleS`. Primary: `accent` face over a 3 dp solid `accentEdge` ledge. Secondary: `surface2` face, `controlBorder` outline, no ledge. Destructive: `danger` face over a 3 dp `dangerEdge` ledge | Pressed: face translates down 3 dp onto the ledge in 70 ms and springs back on release; transform only. Disabled: `surface3` face, `textTertiary` label, no ledge. Loading: label replaced by a 20 dp spinner at fixed button width, button disabled and announced as busy. A press is ignored while Loading, so a double-tap cannot fire twice |
| **GhostButton / TextButton** | 44 dp tall, `accent` label, no fill | Pressed: 60% opacity |
| **IconButton** | 44×44 dp hit area, 24 dp icon | Pressed: `surface3` circle fills |
| **Card** | `surface1`, `rLg`, `divider` hairline, padding `s4` | Static; tappable cards press to `surface2` |
| **HeroCard** | Card with `displayXL` total, `caption` label, a 2 dp `accent` top highlight | Used for the month summary and the Analysis totals |
| **TransactionRow** | Min height 64 dp: 40 dp icon tile (`rMd`), title `titleS`, subtitle `caption` (`textSecondary`; account, and note when `notesVisibleInList`), right-aligned amount `bodyStrong`; recurring marker and "Refund" label as small trailing badges | Pressed: `surface2`. Rows are pure display components memoized on primitive props |
| **Chip** | 40 dp tall, `rFull`, `label`; unselected `surface2` with `controlBorder`, selected `accent`-tinted fill with `accent` border and a check glyph | Selected state never relies on color alone |
| **SegmentedControl** | 44 dp, three segments (Income / Expense / Transfer) | Selected segment has a `surface3` pill and `textPrimary` label; the pill moves by a 150 ms transform |
| **AmountDisplay** | Two lines: expression (`titleM`, `textSecondary`, right-aligned, horizontally scrollable) and result (`displayXL`, `textPrimary`, fit-to-width) | Shows the exact formatted value at every instant; invalid state shows an inline error line under it, not a pop-up |
| **AmountKeypad** | See Section 6A.9 | See Section 6A.9 |
| **TextField** | 52 dp, `surface2`, `rMd`, `controlBorder`; floating-free label above the field | Focus: 2 dp `accent` border. Error: 2 dp `danger` border plus an icon and message below. Disabled: `surface3` |
| **Switch / ListRowToggle** | Platform switch with `controlBorder` track off, `accent` on | Row is the 44 dp+ hit area |
| **ProgressBar (Budget)** | 8 dp tall, `rFull`, `surface3` track, fill `accent`; at ≥100% fill is full-width `expense`/`danger` with a warning icon and "Over by ₱…" text | Rendered at its final value; not animated. Net refund (negative spent) renders an empty bar and the "Net refund" label |
| **Banner (FR-AUT-004/005/007 and notices)** | Card, `rMd`, 4 dp left accent bar (`accent` for suggestions, `warning` for cautions), 20 dp icon, text, up to two TextButtons | Rendered in a reserved header slot only when its screen gains focus, before the user interacts; never inserted during scrolling or typing; entrance is a 200 ms fade only |
| **SuggestedIndicator (FR-AUT-003)** | "Suggested" tag with a ✕, 40 dp tall with a 44×44 dp hit area, attached to the pre-selected category chip | Tapping ✕ dismisses the suggestion per BR-26 and clears the pre-selection; choosing any other chip changes the value without suppressing future suggestions |
| **Toast** | Bottom, 16 dp above the tab bar (or screen edge), `surface3`, `rMd`, `body` | One at a time, 3 s, announced politely to screen readers; used for non-critical success only. Anything needing a decision is a dialog or inline message |
| **Dialog** | See Section 6A.10 | See Section 6A.10 |
| **BottomSheet** | See Section 6A.10 | See Section 6A.10 |
| **EmptyState** | Centered 64 dp line illustration built from vector paths, `titleM` headline, `body` explanation, one PopButton | Used for: no accounts (first launch guidance), no transactions, no budgets, no categories after filtering, no recurring rules |
| **Skeleton** | Fixed-size `surface2` blocks matching the final layout | Shown only if the data has not arrived after 150 ms; no shimmer animation (a static block avoids constant repaint); disappears without layout shift |
| **RankedBarRow (Analysis chart)** | Category tile, name, net amount, percentage to one decimal as FR-ANA-002 defines, and a 6 dp bar whose width is the category's share | Rendered at final value, never animated. Used only for categories with positive net Expense, in the FR-ANA-002 order; when none is positive the chart area shows an EmptyState and no "largest category" text |
| **RankedListRow (Analysis list)** | Same anatomy as `TransactionRow` without a bar: tile, name, signed net amount | Shows every Expense category including zero and negative results; a negative result is labeled "Net refund" in `textPrimary` with its icon, per FR-ANA-002 |
| **Badge** | 20 dp pill, `caption` | Recurring marker, "Refund", "Archived" |

### 6A.9 Amount keypad and entry layout (FR-DSN-007)

The keypad is the heart of O1. Layout of SCR-05, top to bottom:

1. Header with Close and, for edits, an overflow action.
2. `SegmentedControl`: Income / Expense / Transfer, with the type of the most recently confirmed transaction preselected (derived from existing data, so no new stored field; Expense when no transaction exists). This is the state O1's measurement assumes.
3. `AmountDisplay`.
4. A scrollable region holding: **account chips** (one tap to choose; with more than five active accounts the row scrolls and ends with a "More" chip that opens a picker sheet), the **category chip grid** for the selected type (inline, one tap to choose, ending with "More" when the grid exceeds two rows; an FR-AUT-003 suggestion appears as a pre-selected chip carrying the `SuggestedIndicator`), a date chip (defaults to today; opens the native date/time picker), a collapsed note row, and the recurrence option for purchases. Inline chips are deliberate: O1 allows at most five non-keypad activations, and a minimal Expense then costs three (account chip, category chip, Save) rather than the five that two open-then-select pickers would consume.
5. A dock pinned to the bottom, always visible: the keypad and the Save PopButton.

**Keypad grid.** Four columns by five rows. Row 1: `(`, `)`, `⌫`, `÷`. Row 2: `7`, `8`, `9`, `×`. Row 3: `4`, `5`, `6`, `−`. Row 4: `1`, `2`, `3`, `+`. Row 5: `.` (the locale decimal separator), `0`, `00`, `=`. Digit keys use `surface2`; operator keys use `surface3`; `=` uses an accent outline. Save is a full-width PopButton under the grid. Key press: 60 ms fill to `surface3`, light haptic, no layout change.

**Behavior.** The display updates on the same frame as the tap. Evaluation of the expression follows FR-TRN-003 and is performed by the domain module, never by view code. A live result is shown while the expression is valid; errors (malformed, zero, negative, overflow, divide-by-zero, rounds to zero) appear as an inline message under the display only after `=` or Save, never while the user is mid-typing. Save is disabled until the form is valid; pressing it shows a spinner, ignores further presses, and on success returns to Records with the new row present. When the note field takes focus the keypad dock is replaced by the system keyboard and restored when it closes. Key components are memoized so a tap re-renders the display and the pressed key only.

### 6A.10 Pop-ups (FR-DSN-008)

| Type | Use | Contract |
|---|---|---|
| **BottomSheet** | Pickers (account, category, month, recurrence frequency), overflow actions, the FR-AUT-002 duplicate alert | `rXl` top corners, 36×4 dp grab handle, `surface3`, max height 90% of the screen, snap at content height. Opens with a 280 ms decelerate slide, closes with a 200 ms accelerate slide, both transforms. Scrim tap, downward swipe, and Android back dismiss it, except where the sheet is marked non-dismissible (below). Scrollable content scrolls first; the sheet drags only from its handle or when content is at the top |
| **Dialog** | Confirming destructive or irreversible actions: delete transaction, delete or archive account/category, remove recurring rule, restore (replaces data), Delete & Reset | Centered, `surface3`, `rLg`, max width 340 dp, `titleM` title, one to three sentences naming the consequence in plain words, stacked buttons: destructive PopButton first, Cancel below. Delete & Reset and restore confirmation are not dismissible by scrim tap or back; they require an explicit button |
| **Alert sheet (FR-AUT-002)** | Possible-duplicate warning at Save, on SCR-05, before commit | A BottomSheet that shows the existing matching transaction (amount, date, category, account) and offers **Edit** (primary), **Save Anyway** (secondary), **Cancel** (ghost). It is advisory: Save Anyway always completes the save |
| **Banner** | FR-AUT-004/005/007 notices on SCR-04/06/07 | As in Section 6A.8; at most one per screen view (FR-AUT-009) |
| **Suggestion sheet (FR-AUT-001)** | The "Create recurring rule?" prompt | A BottomSheet listing the detected account, category, weekday, and amount, with **Create rule** (primary; opens the normal FR-REC-001 flow, nothing is created until the user saves there) and **Not now** (ghost; declines per BR-26). It appears on the first screen that is interactive after Save once the idle-scheduled check completes, only if the user has not yet scrolled or tapped on that screen; otherwise it queues for the next focus under FR-AUT-009 |
| **Toast** | Non-critical confirmation (for example, backup file created) | As in Section 6A.8 |
| **Inline message** | Validation and recoverable errors (FR-ERR-004) | Under the field or control, with icon and text; preserves user input |

Common rules. Only one modal layer (sheet or dialog) is open at a time; a second request queues until the first closes. When a sheet or dialog opens, screen-reader focus moves to its title and returns to the invoking control on close; background content is hidden from assistive technology while it is open. The scrim blocks touches to the content beneath. Date and time selection uses the platform-native picker. A sheet never opens while the keyboard animation is running; it waits for the keyboard to settle.

### 6A.11 Motion and haptics (FR-DSN-009)

Motion exists to explain a change of state, never to decorate. All motion tokens:

| Token | Value | Use |
|---|---|---|
| `dInstant` | 70 ms | Button and key press feedback |
| `dFast` | 150 ms | Segmented pill, chip selection, sheet scrim fade |
| `dBase` | 200 ms | Banner fade, sheet close, dialog close |
| `dSlow` | 280 ms | Sheet open, dialog open |
| `easeStandard` | cubic-bezier(0.2, 0, 0, 1) | Entering and moving |
| `easeAccelerate` | cubic-bezier(0.4, 0, 1, 1) | Exiting |
| `springPress` | damping 18, stiffness 260 | Button release |

**Allowed.** Only `transform` and `opacity` may be animated. All animation runs on the UI thread through worklets; no animation is driven by per-frame JavaScript state updates.

**Not allowed in the MVP.** Animating width, height, margins, positions, or any layout property; layout animations inside virtualized lists; animating list-row enter, exit, or reorder; count-up, odometer, or any animation that displays an intermediate monetary value; animated charts or progress fills; shimmer; blur; parallax; Lottie; confetti; and any looping animation.

**Money is never in motion.** A monetary value renders only as the exact formatted result of the domain formatter. It is never interpolated, counted up, or cross-faded between values, so a screenshot or a screen reader can never capture a figure that is not true.

**Passcode error.** A wrong passcode shakes the six-dot indicator (±8 dp translate, three cycles, 240 ms), plays the error haptic, and shows "Incorrect passcode" text; the text and haptic alone carry the message when motion is reduced.

**Reduced motion.** When the operating system's reduce-motion (iOS) or remove-animations (Android) setting is on, every animation above collapses to an instant change or a single 100 ms opacity change; sheets appear without sliding; the passcode shake is replaced by a color-and-text change. Haptics are unaffected by this setting.

**Haptics.** Exactly four events: a light impact on each keypad key; a success notification when a transaction save commits; an error notification on a validation failure or a wrong passcode; a warning notification when a destructive dialog opens. No haptic fires on scrolling, navigation, or tab switches. There is no haptics preference in the MVP because adding one would add a portable Preferences field and force a backup-schema change; the device's own haptic and accessibility settings govern.

### 6A.12 Performance and defect-prevention rules (FR-DSN-011, FR-DSN-012; NFR-11)

These rules turn "no laggy, no buggy UI" into checkable engineering constraints.

**Lists and data.**
- Records, Analysis ranking, Accounts, Categories, and Recurring Rules use a virtualized, recycling list. `@shopify/flash-list` v2, at the version `npx expo install` selects for SDK 57, is the approved list component (v2 runs only on the New Architecture, which React Native 0.86 provides). The plain `FlatList` is not used for these lists. Replacing FlashList requires a decision-register entry and RG-12 evidence.
- Records loads confirmed transactions in pages of 50 using keyset pagination on `(accountingDate DESC, occurredAtUtc DESC, id DESC)`. A transaction saved while the user scrolls neither duplicates nor skips a row. Month summary totals come from a single aggregate query in the repository, never from summing loaded rows in JavaScript.
- Row components are pure and memoized on primitive props; display strings are produced by memoized selectors; no row issues its own database call; callbacks passed to rows are stable.
- Date headers are ordinary list items and are not sticky, which keeps row recycling cheap.

**Threads and work.**
- Database access uses the asynchronous API and never blocks the UI thread. No JavaScript task longer than 50 ms runs while an animation or gesture is active; heavy work (aggregation for Analysis, FR-AUT computation, PDF assembly) is scheduled after interactions and reports progress with a static indicator.
- Keypad, form, and sheet state is local to its screen, not in a global store, so a keystroke cannot re-render unrelated screens.

**Rendering.**
- No raster images ship in the MVP except the app icon and splash; illustrations and icons are vectors.
- No `BlurView`, no translucent overlays, no gradients, no per-row shadows or elevation.
- Fonts and icon registry load once at launch; no on-demand asset fetch.

**Screen-state matrix (no blank or broken screens).** Every data screen implements loading, empty, error, and content states. Loading uses a skeleton only after 150 ms. Every screen is wrapped in an error boundary whose fallback shows a plain message and a Retry action, preserves the navigation shell, and reports only a stable error code to telemetry (FR-PRV-002). A render fault in one screen never blanks the app.

**Forms and input.**
- Inputs avoid the keyboard: the focused field scrolls into view above it; bottom docks respect safe-area insets on every device.
- Validation messages appear inline on blur or on Save, never while typing, except the amount's live result.
- Every submit control is disabled and shows its Loading state while a write is in flight (this complements the idempotency token in FR-TRN-011).
- Content never shifts after first paint: skeletons use final dimensions, banners occupy a reserved slot, and images and icons have fixed boxes.
- Long names and large font scales: rows grow in height rather than clip; no control is clipped at 200% (NFR-07).

**Dependencies.** The UI layer uses only: Expo Router, `react-native-reanimated`, `react-native-gesture-handler`, `react-native-screens`, `react-native-safe-area-context`, `react-native-svg`, `expo-font`, `expo-splash-screen`, `expo-haptics`, `@react-native-community/datetimepicker`, `@shopify/flash-list`, and `lucide-react-native` (per-icon imports only). Every version is the one SDK 57 supports, installed with the Expo version-check tool, and the result is recorded in the build's compatibility evidence. No third-party UI kit or component library is approved, because mixing a foreign theme and its own animation stack is the most common source of inconsistency and jank. Any additional UI dependency requires a decision-register entry and must pass RG-12.

### 6A.13 Screen layout specifications

Each screen uses `bg`, `s4` horizontal padding, `titleL` header, and the components in Section 6A.8. Every screen implements the state matrix in Section 6A.12.

| Screen | Layout |
|---|---|
| SCR-01 Records | Header: title, month selector (previous / month label opening a month sheet / next), menu button. `HeroCard` for the month: Income and net Expense side by side with a "Net refund" treatment where applicable. Virtualized `TransactionRow` list grouped by date with a non-sticky date header showing the day label and day net. Entry control at bottom right. Empty state when the month has no rows. |
| SCR-02 Analysis | From and To date chips (default: the current month; both open the native date picker). `HeroCard` pair for Income and net Expense. The chart (`RankedBarRow`, positive net Expense only) followed by the full ranked list (`RankedListRow`, all categories including zero and negative), both fed by the same query result so their boundaries and totals cannot disagree (FR-ANA-003). |
| SCR-04 Budgets | Month selector, list of budget `Card`s: category tile and name, "Spent ₱X of ₱Y", `ProgressBar`, remaining or "Over by" with icon. Unbudgeted-category list below under a section title. FR-AUT-004 banner in the reserved header slot. Add Budget as a secondary PopButton; delete is in the Budget's overflow (FR-BUD-007). |
| SCR-05 Transaction Input | As in Section 6A.9. Edit mode adds an overflow with Duplicate, Refund (for purchases), and Delete. |
| SCR-06 Accounts | One `Card` per account with icon tile, name, `displayL` balance, archived badge when relevant; create via a PopButton. FR-AUT-005 and FR-AUT-007 banners share the reserved header slot under FR-AUT-009. |
| SCR-07 Categories | Segmented Income / Expense; rows with icon tile, name, archived badge; create via a PopButton; FR-AUT-007 banner in the reserved slot. |
| SCR-08 Data Management | Grouped list: Backup, Restore, Export PDF, and a visually separate destructive "Delete & Reset" group. All destructive actions open dialogs per Section 6A.10. |
| SCR-09 Preferences | Grouped list sections: Display (currency sign and position, decimals, notes visibility, appearance), Reminders, Privacy, Security, Assistive suggestions. Toggles use `ListRowToggle`; appearance is a three-way `SegmentedControl` (System, Light, Dark). |
| SCR-10 Recurring Rules | List of rule cards with next date, pause state, pending and backlog counts; backlog review is a full screen with per-item actions. |
| SCR-11 Lock and Recovery | Centered mark, six dot indicators, a 3×4 keypad (digits, backspace, and a biometric key only when enabled), "Forgot passcode?" as a GhostButton. During lockout the keypad is disabled and a mm:ss countdown, computed from the persisted `lockoutUntilUtc`, replaces the prompt. No financial content is present. |
| SCR-12 Restore Recovery | Centered progress indicator and a plain explanation; no navigation, no dismissal. |

First launch shows the EmptyState "Create your first account" with a PopButton on the Records tab, satisfying the guided state in Section 6 with no dead end.

### 6A.14 Design-system requirements

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-DSN-001 | The app shall provide one theme (`kwartracker`) with Dark and Light appearances selected by `uiMode` (`system`, `light`, `dark`; default `system`). Appearance changes shall apply without restart, the first rendered frame shall already be in the correct appearance on every gated screen, and an unrecognized stored value shall read as the default. | P1 | TC-98 |
| FR-DSN-002 | Every color, spacing, radius, type, and motion value shall come from the design tokens in Sections 6A.3–6A.5 and 6A.11. Literal color, size, or duration values shall not appear in screen or component code outside the token source. Every text/background and control-boundary pairing in the token table shall meet the stated contrast ratios in both appearances. | P1 | TC-97, DSG-REV-01 |
| FR-DSN-003 | The bundled Inter font shall render all text including the peso sign (₱) and tabular numerals offline, and if the peso glyph is absent from the bundled font files the font build shall be changed before release; font load failure shall fall back to the system font without blocking launch; money and entry text shall remain complete and unclipped at 200% font scale. | P1 | TC-99, VIS-01 |
| FR-DSN-004 | Monetary values shall be displayed only through the domain formatter obeying BR-05–BR-07, shall use the sign and color conventions of Section 6A.3, shall never be truncated, interpolated, counted up, or cross-faded, and shall carry a sign or text marker in addition to color. | P0 | TC-100 |
| FR-DSN-005 | Surfaces shall use the elevation levels of Section 6A.5. Blur, translucency, gradients, and per-row shadows shall not be used. | P1 | TC-97, DSG-REV-01 |
| FR-DSN-006 | Screens shall be composed only from the components in Section 6A.8, each implementing every listed state with ≥44×44 dp targets and accessible names, roles, and states. | P1 | TC-97, TC-102, DSG-REV-01 |
| FR-DSN-007 | The amount keypad and SCR-05 shall follow Section 6A.9: inline one-tap account and category selection, a bottom-pinned keypad and Save, live exact result, errors shown only after `=`/Save, memoized keys, and Save de-bounced while in flight. | P0 | TC-101, UX-01, UI-PERF-01 |
| FR-DSN-008 | Sheets, dialogs, alert sheets, banners, toasts, and inline messages shall follow Section 6A.10, including one modal layer at a time, focus movement and restoration, scrim and back behavior, and non-dismissible Delete & Reset and restore confirmations. | P1 | TC-102 |
| FR-DSN-009 | Motion shall use only the Section 6A.11 tokens, animate only transform and opacity on the UI thread, exclude the prohibited effects, collapse under the OS reduce-motion setting, and fire haptics only for the four listed events. | P1 | TC-103, UI-PERF-01 |
| FR-DSN-010 | Navigation chrome shall follow Section 6A.7: instant tab switching with preserved and frozen inactive tabs, the entry control placement, drawer-gesture limits, back-layer order, no financial content before unlock, and portrait-only phone support. | P1 | TC-106 |
| FR-DSN-011 | Every data screen shall implement loading, empty, error, and content states, shall be wrapped in an error boundary that preserves the shell and reports only a stable error code, and shall not shift layout after first paint. | P1 | TC-104, TC-108 |
| FR-DSN-012 | Records shall page by keyset in pages of 50 with aggregate-query month totals, and rows shall be pure, memoized, and free of per-row database access. | P0 | TC-105, UI-PERF-01 |
| FR-DSN-013 | Icons shall resolve through the registry of Section 6A.6 with the `other` fallback for unknown keys; category identity color shall be derived deterministically from the category UUID without a stored color field. | P2 | TC-107 |
| FR-DSN-014 | Forms shall avoid the keyboard, respect safe areas, show validation inline on blur or Save, disable and show Loading on submit controls during writes, and preserve valid input after a recoverable error (FR-ERR-004). | P1 | TC-108 |

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
| FR-BUD-007 *(new in v1.7)* | The app shall let the user explicitly delete a Budget for one category and `YYYY-MM` month, after confirmation. Deletion removes only that Budget row: it never changes any confirmed transaction, account balance, Analysis total, or PDF content, and it removes any `budget_pace` `SuggestionState` row for that Budget. It is the action FR-CAT-002 requires before a category referenced only by a Budget can be hard-deleted under BR-10. A deleted Budget may be recreated for the same category and month under FR-BUD-001. | P1 | TC-96 |

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
| FR-SET-002 | Notes visibility, appearance mode (`system`, `light`, or `dark`; default `system`), and the single MVP theme (`kwartracker`, which has Light and Dark appearances as defined in Section 6A) shall persist locally and apply without restart. Additional themes are Deferred. | P1 | TC-38, TC-98 |
| FR-SET-003 | Security, reminder, and telemetry settings shall obey their specialized requirements and shall not be treated as portable Preferences. | P0 | TC-62 |
| FR-NOT-001 | The app shall let the user select a local daily reminder time and shall request notification permission only when enabling it. Denial leaves the toggle OFF and shows instructions to open OS settings. | P1 | TC-12, TC-74 |
| FR-NOT-002 *(amended v1.6)* | Enabling shall create exactly one daily local notification; changing time shall replace it; disabling shall cancel the daily reminder's own previously scheduled notification request(s), tracked by an identifier distinct from any other feature's scheduled notifications. This action is scoped to the daily-reminder feature only and does not cancel notifications scheduled by any other feature (e.g., FR-AUT-006's entry-cadence nudge). | P1 | TC-74 |
| FR-NOT-003 | On app launch after device restart, reinstall/update, timezone change, or detected schedule absence, the app shall reconcile the desired enabled state to exactly one future request, subject to OS permission and OEM delivery behavior. | P1 | TC-75 |
| FR-NOT-004 | The UI shall state that the OS controls final delivery and battery optimization may delay it. An absent/denied permission shall never crash or block core use. | P1 | TC-12, TC-75 |
| FR-PRV-001 | Android cloud backup and device-to-device transfer shall exclude the SQLite database, app files containing financial/preferences data, restore/reset journals, and telemetry queues. iOS files containing those data shall be excluded from iCloud/iTunes backup. Release builds shall verify generated native configuration. User-created backup/PDF files leave the sandbox only by explicit share/save action. | P0 | INS-PRV-02, TC-76 |
| FR-PRV-002 | Crash reporting is opt-in and default OFF. The permitted payload is limited to app version/build, OS name/version, device model, non-user-derived route identifier, exception type, scrubbed stack frames, and enumerated application error codes. It must not include transaction/account/category/budget/rule values or IDs, notes/names, database/query contents, backup/file paths, screenshots, session replay, UI text breadcrumbs, request bodies/headers, IP-derived location, user identity, locale, contacts, or advertising identifiers. | P0 | TC-77, INS-PRV-01 |
| FR-PRV-003 | The crash SDK shall not initialize, open a network connection, assign an installation/user identifier, or persist an event before consent. Opt-out shall stop the SDK and delete unsent local events immediately. Previously transmitted anonymous events follow the published retention policy; the consent screen and privacy policy shall disclose that limit. Usage analytics, tracing, profiling, session replay, and automatic network/UI breadcrumbs shall remain disabled. | P0 | TC-77, INS-PRV-03 |
| FR-PRV-004 | A release build shall pass payload inspection through a controlled test transport for every enabled capture path, including JavaScript error, handled exception, unhandled native crash where testable, and offline-queued delivery. A generic filtering hook alone is not acceptable evidence. Inspection shall include at least one capture taken while an FR-AUT suggestion is pending, accepted, and declined, proving the FR-AUT crash-payload exclusion in Section 7 holds in the inspected transport and not only in code review. | P0 | PRIV-VER-01 |
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

### FR-AUT — Assistive suggestions *(new in v1.6)*

Every requirement below is Approved MVP unless marked Deferred. Governing principle: every feature here is advisory. None may create, edit, or delete a Transaction, Account, Category, Budget, or RecurringRule without an explicit confirming user action (BR-24).

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-AUT-001 | The app shall detect ≥3 confirmed Income or purchase-Expense transactions (`originKind=manual`; `expenseEffect=refund` rows and recurring-generated rows are both excluded, since neither can be produced by FR-REC-001 and a refund's category is inherited rather than chosen) sharing account, type, category, and weekday, with amount within ±5% or ±100 minor units (whichever is greater), inside a trailing 60-day window. Detection is triggered by every transaction Save and by each cold app launch, but runs off the critical rendering path (post-first-paint / idle-scheduled), after the save has committed and the next screen is already interactive — it does not extend the synchronous Save-action latency that NFR-10/AUT-VER-02 measure, and is not one of the two features that execute on the transaction-confirm path (NFR-10). No continuous background scan runs. A pattern already covered by an active, non-paused RecurringRule revision matching the same account/category/weekday is excluded. Weekday cadence only is detected, since FR-REC supports no other schedule shape in MVP. A qualifying pattern surfaces a "Create recurring rule?" prompt pre-filled from the detected fields, shown once the idle-scheduled check completes (typically the same screen view, but never gating Save itself); accepting opens the normal FR-REC-001 flow with nothing created until the user saves. Declining applies BR-26. | P2 | TC-86 |
| FR-AUT-002 | At Save time on SCR-05, before the draft is committed, if an existing confirmed Income or Expense transaction shares account, type, `expenseEffect` where type is Expense, category, amount, and accountingDate with the draft being saved, the app shall show a "possible duplicate" warning offering Save Anyway, Edit, or Cancel; it is advisory only — Save Anyway always completes the save unchanged — and it must never merge or alter either transaction. Transfers have no category (FR-TRN-002) and are outside this check. Matching `expenseEffect` prevents an unrelated refund and purchase of the same amount/category/date from being flagged against each other. This is distinct from the explicit Duplicate (clone) action in FR-TRN-006. If the user selects Save Anyway three times for the same (account, `expenseEffect`, category, amount) combination, the app shall stop warning for that specific combination going forward. This is tracked by `SuggestionState.occurrenceCount` (Section 11): the first Save Anyway creates the row with count 1, each further Save Anyway on the identical combination increments it, and reaching 3 sets `dismissedAtUtc`, after which the fourth and later identical entries save with no warning (recorded per BR-26). Edit and Cancel never change the count. The count update is best-effort bookkeeping written after the financial Save commits (Section 11, write discipline); `accountingDate` is intentionally excluded from this suppression key because legitimate recurring same-amount purchases naturally carry a different `accountingDate` on each occurrence, and including it would defeat the suppression's purpose. A user who wants to restore warnings for an over-suppressed combination may use FR-AUT-008's "Reset suggestion history" action, which clears this along with all other suggestion state. | P2 | TC-87 |
| FR-AUT-003 | When creating an Income or purchase-Expense transaction, the app may pre-select (never lock) a Category based on the user's own prior confirmed Income/purchase-Expense transactions for the same account, using only amount-bucket proximity — the same nearest-100-minor-units bucketing as `SuggestionState.amountBucketMinor`. `expenseEffect=refund` rows are excluded from the matching pool, since a refund's category is inherited from its original purchase (FR-TRN-002) rather than freshly chosen and would bias the heuristic. A suggestion is shown only when at least 2 prior matches exist and one category accounts for ≥60% of them; below that threshold, no suggestion is shown. The field remains freely editable and still enforces FR-TRN-002's type compatibility. The Refund action itself is unaffected — its category is always inherited per FR-TRN-002, never suggested. The pre-filled field carries a small "suggested" indicator with its own dismiss control, separate from the field: dismissing the indicator creates or updates the `category_hint` `SuggestionState` row for that (account, amount-bucket) and durably suppresses a suggestion of that category for that combination (BR-26). Merely changing the field's value does not suppress anything, since the user may only be correcting one transaction. The dismiss control shall meet the same NFR-07 requirements as every other FR-AUT prompt. | P2 | TC-88 |
| FR-AUT-004 | For each active monthly Budget, the app shall compute `projectedSpend = spentToDate / (daysElapsedInMonth / daysInMonth)` using only FR-BUD-002's existing Total Spent figure (confirmed purchase Expense minus confirmed Expense refunds), and surface at most one non-blocking pace alert per Budget per local calendar day (gated by the `budget_pace` row's `lastAlertedUtc`), only when `daysElapsedInMonth ≥ 3` and `projectedSpend` exceeds the limit by more than 5%. `daysInMonth` and `daysElapsedInMonth` are always measured against the Budget's `YYYY-MM` accounting month (FR-BUD-001), not the Budget row's own creation timestamp — a Budget set up partway through its accounting month still measures elapsed days from that month's start. Because `spentToDate` can be negative under FR-BUD-002/003 ("Net refund"), a negative or zero `projectedSpend` can never exceed the limit and therefore never triggers this alert — no separate refund-handling logic is required beyond delegating to the existing Total Spent figure. | P2 | TC-89 |
| FR-AUT-005 | Using an account's current confirmed balance (BR-03 — which already includes confirmed Expense refunds) plus scheduled future dates from that account's active, non-paused RecurringRule revisions within a fixed 30-day forward window — including both legs of a Transfer rule against each affected account — the app shall project a forward balance and surface a warning, clearly labeled as a projection and shown at most once per app session per account (session = since the current cold launch, gated by the `low_balance` row's `lastAlertedUtc`), when it would cross zero. Recurring rules cannot generate refunds (BR-23), so no refund-specific projection logic is needed. Pending/deferred-backlog occurrences may be included as provisional inputs only and never affect the actual BR-03 balance. The UI shall state that the projection does not and cannot account for future manual (non-recurring) transactions. | P2 | TC-90 |
| FR-AUT-006 | The app shall not poll for inactivity in the background — MVP architecture has no background execution (Section 9). Instead, every time a transaction (including a refund) is confirmed, the app shall cancel any previously scheduled inactivity notification (tracked by its own request identifier, independent of FR-NOT-002's daily-reminder identifier) and schedule exactly one new local notification for now + a fixed 5-day inactivity window, using the same SDK 57 Notifications mechanism as FR-NOT-002. If a new transaction is confirmed before it fires, it is cancelled and rescheduled further out. Disabling the daily reminder (FR-NOT-002) shall not cancel this notification, and disabling this feature (via FR-AUT-008) shall not cancel the daily reminder; the two are scheduled and cancelled independently by identifier, via SDK 57 Notifications' per-identifier cancellation API rather than its cancel-all API. If OS notification permission is not granted or is later revoked, this feature shall no-op silently (no error, no in-app indicator), consistent with FR-NOT-001's existing permission-denial handling. | P2 | TC-91 |
| FR-AUT-007 | An active Account or Category with zero confirmed transactions in a fixed 12-month trailing window, checked once per app session, may be surfaced once in a dismissible review list with a direct Archive action following BR-09 exactly. An Account or Category referenced by any active (non-paused, non-deleted) RecurringRule, or holding any non-terminal (`pending` or `deferred_backlog`) ledger row, shall be excluded from this list even with zero confirmed transactions — such an entity has real pending activity awaiting the user's own action and is not dormant. The app shall never auto-archive. | P2 | TC-92 |
| FR-AUT-008 | Preferences (SCR-09) shall expose a single "Assistive suggestions" toggle that disables FR-AUT-001–007 entirely when OFF (default ON). Turning it OFF shall not delete existing `SuggestionState` history; turning it back ON resumes with that history intact rather than re-surfacing previously dismissed patterns. Preferences shall also expose a separate "Reset suggestion history" action that clears all `SuggestionState` rows (equivalent to a fresh install's suggestion state) without affecting financial data or the toggle's own on/off setting; this is the user-facing way to restore suppressed warnings (e.g., an FR-AUT-002 combination suppressed under BR-26). | P2 | TC-93 |
| FR-AUT-009 | At most one FR-AUT prompt/banner shall be visible per screen view. Per Section 6 each FR-AUT feature is assigned to specific screens, so simultaneous eligibility arises only among features assigned to the same screen — today {FR-AUT-001, FR-AUT-002, FR-AUT-003} on SCR-05 and {FR-AUT-005, FR-AUT-007} on SCR-06; FR-AUT-004 (SCR-04) and FR-AUT-007 on SCR-07 have no co-resident feature. There is no app-wide banner surface, and an item assigned to one screen is never shown on another. When more than one item is eligible on the same screen view, the global priority order below decides (and fixes the order for any future screen reassignment): low-balance forecast (FR-AUT-005) > Budget pace (FR-AUT-004) > duplicate warning (FR-AUT-002) > recurring-pattern suggestion (FR-AUT-001) > category pre-fill (FR-AUT-003) > dormant-entity review (FR-AUT-007). Lower-priority items remain queued for the next relevant view of that screen rather than being dropped. The FR-AUT-002 warning is a Save-time modal and is always presented first on SCR-05 because it precedes commit; FR-AUT-001/003 then queue behind it. | P2 | TC-94 |

**Acceptance criteria (per requirement):**
- **All FR-AUT:** dismissing or declining a suggestion changes no financial row, rule, or archive state, and for features with a dismiss/decline control (FR-AUT-001/002/003/007) an identical future prompt for the same pattern instance does not reappear (BR-26); FR-AUT-004/005 are rate-limited per Section 11 instead; disabling device network access (airplane mode) never degrades or blocks any FR-AUT feature (extends NFR-01); no FR-AUT computation, suggestion outcome, or accept/decline choice may appear in a crash payload (extends FR-PRV-002's allowlist restriction); no FR-AUT requirement treats an `expenseEffect=refund` row as an ordinary Income/Expense entry for pattern, duplicate, or category purposes.
- **FR-AUT-001/002/003/004/005/007 (banners/prompts):** every banner/prompt obeys NFR-07 in full — meaningful labels/roles/states to VoiceOver/TalkBack, interactive targets ≥44×44dp, state never conveyed by color alone, operable at 200% font scale without clipping or hiding financial values, normal-text contrast ≥4.5:1, large-text/essential-icon contrast ≥3:1.
- **FR-AUT-002 specifically:** when the Save-time duplicate prompt appears, focus moves to it and it is announced to VoiceOver/TalkBack before any Save-confirmation toast is announced.
- **FR-AUT-006 specifically:** the scheduled notification's accessible label follows the same VoiceOver/TalkBack conventions as FR-NOT-002's existing daily reminder.

### FR-OCR — Receipt capture (Deferred)

| ID | Requirement | Priority | Verification |
|---|---|---|---|
| FR-OCR-001 | On-device OCR (platform Vision/ML Kit APIs only) may pre-fill amount, date, and merchant-derived note text from a photographed or imported receipt into an ordinary purchase-Expense draft (not a refund draft). Recognized text and image data shall never leave the device and shall not be cached beyond the active draft session; the receipt image itself is not persisted or included in backup unless a future, separately-approved attachment feature says otherwise. Requires its own privacy/security review before promotion to Approved. | P3 | Not applicable to MVP |

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
| NFR-09 | Every FR-AUT and FR-OCR pipeline shall perform zero network operations and shall not persist a Transaction, Account, Category, Budget, or RecurringRule change without an explicit confirming user action, verified by code review and captured local network traffic. | INS-AUT-01 |
| NFR-10 | All FR-AUT computation other than FR-AUT-002 and FR-AUT-006 shall execute off the critical rendering path (post-first-paint / idle-scheduled) and shall add no measurable latency to O1's entry-to-save workflow. Combined, it shall add no more than 150ms to cold-launch-to-interactive time, measured against the PERF-01 fixture dataset on the PERF-01 reference devices, and shall be re-verified whenever PERF-GOV-01 replaces those reference devices. FR-AUT-002 and FR-AUT-006 are the two features that necessarily execute synchronously on the transaction-confirm path (a duplicate check and a notification reschedule cannot be deferred past Save); together they shall add no more than 50ms to the total Save-action latency measured on the same reference devices and fixture, excluding time the user spends interacting with the FR-AUT-002 warning. This is a fixed, explicitly budgeted exception to the off-path rule, not a violation of it. | AUT-VER-01, AUT-VER-02 |
| NFR-11 *(new in v1.8)* | UI responsiveness and motion quality, measured on the signed release build with the PERF-01 fixture loaded, on both PERF-01 reference devices, in both appearances: (a) the visual response to a keypad key, button press, tab switch, or sheet open begins within 100 ms at p95 (response-to-next-frame); (b) each animation defined in Section 6A.11 (sheet open/close, banner entrance, button press, segmented-pill move, passcode shake) averages at least 55 frames/second over ten consecutive runs with no frame above 100 ms, with an iOS hitch-time ratio of at most 5 ms/s and at most 2% janky frames on Android; (c) no JavaScript task longer than 50 ms runs during any animation or gesture; (d) a sustained fling of Records on the PERF-01 fixture shows no visibly blank rows and still meets the PERF-01 frame criteria; (e) ten keypad taps within one second all register in order with the correct display. These limits are additional to NFR-03/PERF-01 and never relax them. | UI-PERF-01, TC-101, TC-105 |

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

SQLite shall enable foreign keys and WAL where supported. Exclusive transactions shall be used for Transfer changes, transaction replacement effects, recurrence passes, archive-driven pending cancellation, idempotent writes, and other multi-row invariants. An exclusive transaction briefly blocks concurrent readers even under WAL, giving up WAL's concurrent-read benefit for its duration; this is an accepted trade-off because these transactions are short and WAL still benefits ordinary reads and writes outside them. Restore uses the staged-swap protocol because its commit spans a complete database replacement.

The app uses Continuous Native Generation: generated `ios/` and `android/` folders are not committed. Native behavior is configured in app configuration/config plugins. Release builds—not Expo Go—are the acceptance environment. Expo Go may be used only where its bundled modules and behavior match the feature under development; no blanket claim is made that every native module requires a development build.

PDF generation uses the SDK 57 Print API and OS sharing. Local reminders use SDK 57 Notifications. Biometrics use SDK 57 LocalAuthentication with device fallback disabled. Future background recurrence shall use the supported SDK background-task API at that time; the deprecated `expo-background-fetch` API is not an approved dependency.

The UI layer follows the design system in Section 6A: design tokens in one source, a fixed component catalogue, UI-thread animation through Reanimated worklets, and the approved UI dependency list in Section 6A.12. No third-party UI kit is approved.

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
src/theme/                    # design tokens, typography, motion, icon registry (Section 6A)
src/components/ui/            # design-system primitives and components (Section 6A.8)
src/components/               # feature-level UI composed from primitives, outside routes
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

`PasscodeCredential` in SecureStore contains KDF version/algorithm/parameters, salt, verifier, and enrollment time. `LockoutState` contains failed count, tier, lockout-until, and last-observed time. Biometric opt-in, analytics consent, install identifiers, notification authorization/scheduled request IDs, telemetry queue, restore/reset working files, and `SuggestionState` (below) are device-local and are not portable.

### SuggestionState (device-local; schema resolved in v1.7)

v1.6 described one SHA-256 `patternKey` formula for every suggestion kind. That formula could represent only `recurring_pattern`; it could not express BR-26's `expenseEffect`-sensitive, date-independent `duplicate` key, had no natural inputs for Budget-, account-, or entity-scoped kinds, had no counter for FR-AUT-002's three-strikes rule, and made BR-27(b)'s orphan detection impossible. v1.7 replaces it with explicit, nullable, kind-specific plaintext fields. `patternKey` survives only as a derived unique-index value for fast upsert/equality lookup; identity is always read from the plaintext fields, never recovered from the hash.

| Entity | Required fields and constraints |
|---|---|
| SuggestionState | `id`, `kind` (`recurring_pattern`, `duplicate`, `category_hint`, `budget_pace`, `low_balance`, `inactivity_nudge`, `dormant_entity`), `accountId?`, `categoryId?`, `expenseEffect?` (`purchase` or `refund`), `weekdayMask?` (non-empty 7-bit weekday set), `amountBucketMinor?` (amount rounded to the nearest 100 minor units), `amountMinor?` (exact amount), `budgetMonth?` (`YYYY-MM`), `occurrenceCount` (integer ≥ 1, default 1), `patternKey` (SHA-256 of exactly the identity fields for the row's `kind` in the table below, in the fixed order listed, with `kind` as the first input; UNIQUE per `kind`), `dismissedAtUtc?`, `lastAlertedUtc?`, `createdAtUtc`, `updatedAtUtc`. Every nullable field is populated only for the kinds that use it, per the table below; a populated field a kind does not use is a defect. Device-local only; never included in export/backup/restore, so it carries no dependency on the portable schema version (currently v5) — a future schema increment does not require touching this entity, and v1.7's field additions required no backup-schema change. A fresh install or restore starts with no suggestion history, meaning previously dismissed suggestions can resurface after a restore; this is expected behavior and should be reflected in user-facing support content, not treated as a defect. Pruned per BR-27. |

**Identity, attributes, and suppression semantics by `kind`:**

| `kind` | Identity fields (hashed into `patternKey`) | Non-identity attributes | Suppression / rate-limit semantics |
|---|---|---|---|
| `recurring_pattern` (FR-AUT-001) | `accountId`, `categoryId`, `weekdayMask`, `amountBucketMinor` | — | Declining sets `dismissedAtUtc`; a pattern whose amount bucket or weekday set differs hashes to a different key and is a distinct instance (BR-26). Transaction type is implied by `categoryId` (FR-TRN-002) and is not a separate input. |
| `duplicate` (FR-AUT-002) | `accountId`, `expenseEffect` (null for Income), `categoryId`, `amountMinor` (exact) | `occurrenceCount` | Each Save Anyway on this combination creates the row with `occurrenceCount=1` or increments it; when the count reaches 3 the row's `dismissedAtUtc` is set and the combination stops warning. No weekday and no date component, so occurrences on different dates accumulate into one row (BR-26). Purchase and refund rows are distinct because `expenseEffect` is part of identity. |
| `category_hint` (FR-AUT-003) | `accountId`, `amountBucketMinor` | `categoryId` = the suggested category that was dismissed | Dismissing the "suggested" indicator sets `dismissedAtUtc`. The row suppresses a suggestion only while the current majority category equals the stored `categoryId`; a different majority category is a materially changed instance (BR-26), which may prompt again and, if dismissed, overwrites the row. |
| `budget_pace` (FR-AUT-004) | `categoryId`, `budgetMonth` | — | Rate limiter only: `lastAlertedUtc` enforces at most one alert per Budget per local calendar day. No dismiss control, so no `dismissedAtUtc`. |
| `low_balance` (FR-AUT-005) | `accountId` | — | Rate limiter only: `lastAlertedUtc` earlier than the current app session's cold-launch time makes the account eligible again; at most one banner per account per session. No dismiss control. |
| `inactivity_nudge` (FR-AUT-006) | none (single app-wide row; `patternKey` hashes `kind` alone) | — | Bookkeeping only: `lastAlertedUtc` records the fire time of the currently scheduled notification. The OS request identifier lives in device-local notification state, not here. Not subject to BR-26. |
| `dormant_entity` (FR-AUT-007) | exactly one of `accountId` or `categoryId` | — | Declining sets `dismissedAtUtc`. The row suppresses the entity only while no confirmed transaction for it has `occurredAtUtc` later than `dismissedAtUtc`; a later confirmed transaction ends that dormancy period, so a subsequent 12-month dormancy is a distinct instance (BR-26) and replaces the row. |

**Write discipline.** `SuggestionState` writes are advisory bookkeeping. They occur after the financial transaction they relate to has committed, never inside that financial transaction, and a failed `SuggestionState` write never fails, rolls back, or delays reporting of a financial Save. A missing, unreadable, or corrupt `SuggestionState` row is treated as "no history" and never blocks a suggestion pass or the app.

**Orphan detection (BR-27(b)).** Because `accountId` and `categoryId` are stored in plaintext, orphan detection is a direct existence check against the live Account/Category tables; no hash reversal is needed. BR-10 forbids hard-deleting an Account or Category while any Transaction, Budget, RecurringRule artifact, or RecurringOccurrenceLedger row references it, and every row above originates from such a reference, so orphaning occurs only after every referencing record has first been deleted and the entity then hard-deleted — narrow but real, and exactly what BR-27(b) prunes.

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
| Any FR-AUT/FR-OCR suggestion path | Must route through the same FR-TRN-002/003, FR-ACC, FR-CAT, FR-BUD, or FR-REC-001 validation as manual entry; a suggestion pre-fills a draft but never bypasses validation or commits directly. `expenseEffect=refund` rows are never treated as candidate inputs for FR-AUT-001/003. |

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

The 108 test IDs are acceptance scenarios, not 108 separate manual sessions. `QA-PLAN-01` shall map each ID to an executable test name, suite, owner, target environment, result, and evidence link. The following allocation is normative; overlapping suites may reuse one recorded run only when its assertions satisfy every referenced pass criterion.

| Suite | Required scope and cadence | Accountable owner |
|---|---|---|
| `AUTO-PR` | Automated domain, repository, component, and fault-injection tests for TC-01–TC-10, TC-13–TC-19, TC-22–TC-24, TC-28–TC-32, TC-34, TC-38–TC-68, TC-79/80, TC-82–TC-90, TC-92–TC-105, and TC-107. The affected subset runs on every pull request; the complete suite runs on the protected main branch and must pass before an RC is cut. TC-20 is a retired identifier and has no executable case. | Engineering Lead |
| `NIGHTLY` | Long-running scale, replay, storage-exhaustion, journal interruption, and offline automation for TC-21, TC-33, TC-36, TC-43, TC-46, TC-53–TC-56, TC-63–TC-68, TC-75, TC-79–TC-81, a PERF-01-scale re-run of TC-105, and VIS-01. It runs nightly against the latest main-branch release build; a failure blocks the next RC until triaged and passed. | QA Lead |
| `RC-DEVICE` | Scripted physical-device checks for TC-11/12, TC-25–TC-27, TC-33, TC-35–TC-37, TC-62, TC-65–TC-78, TC-81, TC-91, the device legs of TC-98, TC-99, TC-101–TC-103, TC-106, and TC-108, and every named inspection/review artifact below, including AUT-VER-01/02, A11Y-AUT-01, UI-PERF-01, and DSG-REV-01. It runs once per RC on the applicable reference/compatibility devices; all required cases must pass on the final submission build. | QA Lead; Security, Privacy, UX, Product, and Release owners sign their named artifacts; UX Lead signs A11Y-AUT-01 and DSG-REV-01 |

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
| TC-74 | Enable, change time, enable repeatedly, and disable reminder; exactly one/correct/zero requests exist respectively. With an inactivity notification (FR-AUT-006) pending, disable the daily reminder; verify the daily reminder's own request is cancelled and the inactivity notification remains scheduled and fires as expected. | FR-NOT-001/002 |
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
| TC-86 | Feed 3 manual-origin Income/purchase-Expense transactions on the same weekday/account/category with amounts within ±5%; suggestion appears pre-filled correctly. Feed a 4th identical-shape row that is `originKind=recurring`, covered by an existing active rule, or `expenseEffect=refund`; no suggestion fires for any of the three. Declining suppresses the exact pattern instance until it materially changes. | FR-AUT-001, BR-26 |
| TC-87 | Save a transaction identical in account/type/`expenseEffect`/category/amount/accountingDate to an existing confirmed row; warning appears; Save Anyway commits a second legitimate row; Edit/Cancel commits none. Separately, create a purchase and an unrelated same-amount/category/date refund; verify no warning fires between them because `expenseEffect` differs. Choose Save Anyway three times for one identical combination (across at least two different accounting dates and weekdays); verify `SuggestionState.occurrenceCount` reads 1, 2, then 3 and `dismissedAtUtc` is set at 3, that Edit/Cancel choices in between never changed the count, and that the 4th identical entry saves with no warning. Verify the purchase and refund combinations keep separate rows. Inject a `SuggestionState` write failure after a Save Anyway commit; the financial Save still succeeds. Use the "Reset suggestion history" action (FR-AUT-008); verify the same combination now warns again on the next identical Save. | FR-AUT-002 |
| TC-88 | With only 1 prior matching transaction, no category suggestion appears. With 2+ prior purchase/Income matches where one category reaches ≥60% frequency in the same amount bucket, that category pre-selects. Seed additional refund-type rows in a different category at the same amount; verify they are excluded from the matching pool and do not shift the suggestion. Change the pre-filled value without touching the indicator; verify the next matching entry is still suggested. Dismiss the "suggested" indicator; verify the next matching entry in that account/amount-bucket shows no suggestion. Then save entries that shift the majority to a different category; verify the suggestion resumes for the new category (BR-26 materially changed case). Verify the dismiss control's accessibility per NFR-07. | FR-AUT-003, BR-26 |
| TC-89 | On day 1–2 of the accounting month, no pace alert fires regardless of spend. From day 3 onward (measured from the accounting month's start, not the Budget row's creation date), cross a Budget's pace threshold by more than 5%; exactly one alert appears per Budget per day. Seed a Budget created on day 15 of its accounting month; verify `daysElapsedInMonth` is still measured from day 1 of that month, not from day 15. Seed a Budget where refunds make `spentToDate` negative; verify no pace alert fires regardless of days elapsed. | FR-AUT-004 |
| TC-90 | Seed recurring rules, including a Transfer rule, producing a known future negative-balance date within 30 days on each affected account; forecast surfaces the correct account/date, labeled as a projection; pending/deferred-backlog inputs never alter the BR-03 actual balance. Revisit the same account/screen twice in one session; verify the forecast banner surfaces only on the first visit. | FR-AUT-005 |
| TC-91 | Confirm a transaction; verify exactly one inactivity notification is scheduled 5 days out. Confirm a refund 2 days later; verify the first is cancelled and a new one is scheduled 5 days from the refund. Let one fire while the app is fully terminated; verify delivery occurs without any app process (the absence of any app-registered background task is proven by architecture review INS-ARC-01, not by this device test). With an inactivity notification pending, disable the daily reminder (FR-NOT-002); verify the inactivity notification remains scheduled and fires as expected. Separately, with the daily reminder enabled, disable Assistive suggestions (FR-AUT-008) while an inactivity notification is pending; verify the daily reminder is unaffected and continues firing on schedule. Deny notification permission at the OS level; verify the feature no-ops with no error and no in-app indicator. | FR-AUT-006 |
| TC-92 | Seed a dormant account/category with zero confirmed transactions; it appears once per session in the review list. Seed a second account/category also with zero confirmed transactions but referenced by an active RecurringRule or holding a `pending`/`deferred_backlog` row; verify it is excluded from the list. Archive action on the first follows BR-09 exactly; nothing is auto-archived. Seed a third entity that had a confirmed transaction, then went dormant, then received another confirmed transaction ending that dormancy, then went dormant again; verify the second dormancy period surfaces even though the first was dismissed. | FR-AUT-007 |
| TC-93 | Turn the Assistive suggestions toggle OFF; verify no FR-AUT-001–007 prompt appears. Turn it back ON; verify previously dismissed patterns (per `SuggestionState`) do not immediately re-surface. Trigger "Reset suggestion history"; verify all `SuggestionState` rows are cleared and no financial data changes. | FR-AUT-008 |
| TC-94 | On SCR-06, make a low-balance forecast (FR-AUT-005) and a dormant-entity review (FR-AUT-007) simultaneously eligible; verify only the forecast displays and the review surfaces on the next qualifying view of SCR-06. On SCR-05, make one Save simultaneously eligible for a possible-duplicate warning (FR-AUT-002), a recurring-pattern suggestion (FR-AUT-001), and a category pre-fill indicator (FR-AUT-003); verify the duplicate modal appears first, before commit, and the other two surface afterward in that order across qualifying views. Make a Budget pace alert eligible on SCR-04 while a low-balance forecast is eligible on SCR-06; verify each shows on its own screen and neither is shown on the other's screen. | FR-AUT-009, Section 6 |
| TC-95 | Seed `SuggestionState` rows older than twice their owning feature's lookback window, and rows orphaned by a hard-deleted Account/Category; run a normal app-open pass; verify both classes of row are pruned and no error occurs, including when a pruning pass runs before a prior one has completed. Separately seed old `duplicate`- and `category_hint`-kind rows that are **not** orphaned; verify they survive the same pruning pass untouched. Separately seed a `budget_pace` row for a prior accounting month's Budget that still exists (not deleted); verify it is pruned once the current month advances past it. Orphan rows are detected by existence checks on the plaintext `accountId`/`categoryId` fields (Section 11); verify a `duplicate` row survives while any referencing transaction still exists and is pruned only after every referencing record is deleted and the entity is hard-deleted. Verify a purchase and its same-amount refund produce two independent `duplicate` rows, and that a `dormant_entity` row stops suppressing once a later confirmed transaction exists. | BR-27, Section 11 |
| TC-96 *(new in v1.7)* | Delete a Budget after confirmation; verify no transaction, balance, Analysis total, or PDF line changes and its `budget_pace` row is removed. For a category referenced only by that Budget and having no other references, verify hard-delete is rejected before the Budget is deleted and succeeds after (BR-10, FR-CAT-002). Verify a category still referenced by transactions remains non-deletable after its Budget is deleted. Recreate a Budget for the same category and month; verify FR-BUD-001 uniqueness holds and the new Budget computes Spent from existing history. | FR-BUD-007, FR-CAT-002, BR-10 |
| TC-97 *(new in v1.8)* | Design-token conformance. A source scan finds no literal color, spacing, radius, font-size, or duration in `src/app/` or `src/components/` outside the token source. Recompute every contrast ratio in the Section 6A.3 table from the token values for both appearances and assert the stated minimums (text roles ≥4.5:1; `accent`, `controlBorder`, and category colors ≥3:1, including category colors on their 12% tinted tile). Assert the category-color index function is deterministic and returns 0–11. Assert no blur, gradient, or shadow style exists in list-row components. | FR-DSN-002, FR-DSN-005, FR-DSN-006 |
| TC-98 *(new in v1.8)* | Appearance. Set `uiMode` to system, light, and dark in turn; verify immediate application without restart and exact persistence after restart (extends TC-38). Store unrecognized `uiMode` and `theme` values; verify the defaults are used and no error is raised. On cold start with the OS in dark and in light, verify the first rendered frame of SCR-11 and of the first financial screen is already in the final appearance with no visible flash; verify SCR-12 uses the system appearance. | FR-DSN-001, FR-SET-002 |
| TC-99 *(new in v1.8)* | Typography. With networking disabled, a release build renders every type role in Inter including ₱ (U+20B1) and tabular numerals (a column of amounts aligns digit for digit). Simulate font-load failure; launch completes with the system font. At 100%, 150%, and 200% font scale verify hero totals, the entry display, rows, keypad, and tab bar show no clipped or hidden money, and the tab bar becomes icon-only at ≥1.4 with accessible labels. | FR-DSN-003, NFR-07 |
| TC-100 *(new in v1.8)* | Money display. Record every text value rendered by amount components across create, edit, delete, refund, appearance change, display decimals 2→0→2 (TC-13), and rapid repeated mutations. Each value shall equal the domain formatter's exact output for committed data (or the exact live expression result on SCR-05); no intermediate or interpolated value ever renders. Verify the sign and marker conventions (Expense "−" in primary text, Income "+" in income color, refund "+" with a "Refund" label and not in income color, Transfer neutral) and that no amount is truncated at 200% font scale. | FR-DSN-004, BR-23 |
| TC-101 *(new in v1.8)* | Keypad and entry. With render counters, a key tap re-renders only the display and the pressed key. Ten taps in one second all register in order. Expression results match the TC-39 vectors; errors appear only after `=` or Save. Save shows Loading and ignores further presses while in flight. A minimal Expense from the opened entry screen needs at most three non-keypad activations. The preselected type equals the type of the latest confirmed transaction (Expense when none exists). With a mocked haptics module: light impact per key, success on commit, error on validation failure. | FR-DSN-007, FR-TRN-003, O1 |
| TC-102 *(new in v1.8)* | Pop-ups. For every sheet, dialog, and alert-sheet type verify: one modal at a time with queueing; focus moves to the title and returns to the invoking control; background content is hidden from assistive technology; scrim, back, and swipe dismissal per type; Delete & Reset and restore confirmations are not dismissible by scrim or back; the FR-AUT-002 alert sheet offers Edit, Save Anyway, and Cancel before commit and Save Anyway completes the save; toasts appear one at a time and announce politely; banners render only on focus and never during scrolling or typing; the FR-AUT-001 suggestion sheet appears only before the user has interacted with the screen and otherwise queues for the next focus; no sheet opens during a keyboard animation. | FR-DSN-008, FR-AUT-001, FR-AUT-002, FR-AUT-009 |
| TC-103 *(new in v1.8)* | Motion and haptics. Enumerate every animation. With OS reduce-motion on, each collapses to an instant change or a ≤100 ms opacity change and the passcode shake becomes a color-and-text change. Static analysis shows only transform and opacity are animated, animations run as UI-thread worklets, and none of the prohibited effects exist (layout-property animation, list-row animation, count-up, blur, shimmer, Lottie, looping). Exactly four haptic events fire and none fires on scrolling, navigation, or tab switches. | FR-DSN-009 |
| TC-104 *(new in v1.8)* | Screen states and failure containment. For each data screen render loading (shown only after 150 ms), empty, error, and content, with no layout shift between skeleton and content. Inject a render exception into each screen; the error-boundary fallback with Retry appears, the navigation shell remains, the app is never blank, and any reported payload contains only a stable error code (FR-PRV-002). Retry recovers once the fault clears. | FR-DSN-011, FR-ERR-004, FR-PRV-002 |
| TC-105 *(new in v1.8)* | Records paging and scale. On the PERF-01 dataset verify: the first page renders at page size 50; keyset pages are contiguous with no duplicate or missing row; a transaction inserted or deleted during scrolling neither duplicates nor skips a row; month header totals equal the domain aggregate; rows make no database calls; rows do not re-render when unrelated state changes. | FR-DSN-012, NFR-11, PERF-01 |
| TC-106 *(new in v1.8)* | Navigation chrome. Tab switching is instant and preserves each tab's scroll position and local state; inactive tabs do not re-render on writes until focused; drawer edge-swipe works only on tab screens; Android back and the iOS back swipe close the top layer first (sheet, dialog, screen) and are ignored during an in-flight Save; the app is portrait-only and not offered as a tablet layout; no financial text exists in the accessibility tree before unlock. | FR-DSN-010, FR-NAV-002 |
| TC-107 *(new in v1.8)* | Icons and identity. Every seeded category and account icon key resolves in the registry. An unknown key from a synthetic restored backup renders the `other` glyph, does not fail restore, and leaves stored data unchanged. A category's identity color is identical across sessions, appearances (index), and after backup and restore. Every registry key and system glyph in Section 6A.6 resolves to an existing per-icon module in the pinned `lucide-react-native` version, no barrel import of the package exists in source, and the third-party notices contain the Lucide license text. | FR-DSN-013, FR-BKP-004, D-95 |
| TC-108 *(new in v1.8)* | Forms and keyboard. On small and large reference viewports and at 200% font scale, focused fields scroll above the keyboard, docks respect safe-area insets, inline validation appears on blur or Save, submit controls disable and show Loading during writes, and valid input survives a recoverable failure such as `INSUFFICIENT_STORAGE` (FR-ERR-004). | FR-DSN-014, FR-DSN-011, FR-ERR-004 |

### Required inspections and release artifacts

| ID | Pass criterion | Covers |
|---|---|---|
| INS-BKP-01 | Schema/manifest/export inspection proves exact v5 portable fields, refund/backlog constraints, and temporary-file discipline. | FR-BKP-001/002 |
| INS-BKP-02 | Compatibility table and fixtures include every accepted schema; currently only v5. | FR-BKP-010/011 |
| REC-BKP-01 | Automated termination matrix for every restore phase proves old-or-new hashes only on both platforms. | BR-19, NFR-08 |
| INS-SEC-01 | Production log/storage inspection finds no plaintext passcode. | FR-SEC-001 |
| INS-SEC-02 | Release native configuration and device behavior prove biometric device fallback disabled, exercised on both PERF-01 reference devices and on at least one additional Android device from a different OEM biometric stack, because `disableDeviceFallback` enforcement has varied across Android implementations. | FR-SEC-003 |
| INS-SEC-03 | UI/store/privacy copy never equates app lock with encryption. | FR-SEC-008 |
| SEC-REV-01 | Security signs KDF parameters, test vector, constant-time implementation, dependency provenance, and timing results. | FR-SEC-002 |
| INS-PRV-01 | Static rules plus captured logs/telemetry contain no prohibited user/financial fields. | FR-TRN-004, FR-SEC-009, FR-PRV-002 |
| INS-PRV-02 | Generated Android/iOS configuration and device smoke tests prove OS-backup exclusion. | FR-PRV-001, NFR-02 |
| INS-PRV-03 | SDK configuration proves analytics/tracing/profiling/session replay/automatic breadcrumbs disabled and consent gates initialization. | FR-PRV-003 |
| PRIV-VER-01 | Controlled transport captures every enabled telemetry path — including captures taken while an FR-AUT suggestion is pending, accepted, and declined — and contains only the allowlist (no FR-AUT computation, outcome, or choice); offline queue and opt-out behavior pass. | FR-PRV-004, FR-AUT (Section 7 acceptance criteria) |
| PRIV-VER-02 | Published privacy policy and both store declarations match PRIV-VER-01 and name retention/processor details. | FR-PRV-005 |
| INS-ARC-01 | Architecture review confirms Expo SDK 57 APIs, `src/app/` routing, generated native folders, no deprecated background-fetch dependency, and no background-task registration anywhere in the assistive-suggestions pipeline (FR-AUT-006, D-60). | FR-NAV-001, Section 9, FR-AUT-006 |
| PERF-01 | Raw evidence satisfies every Section 8 performance criterion. | NFR-03 |
| PERF-GOV-01 | QA and Engineering record each trigger review, current supported-OS window, keep/replace decision for both reference devices, evidence/rationale, overlap benchmark where possible, and retained historical results. | NFR-04, PERF-01 |
| COMPAT-01 | Full gated suite passes on both OS majors per platform and exact devices/builds are recorded. | NFR-04 |
| UX-01 | Five O1 runs per reference device meet time/action limits and one-handed use review passes. | O1, NFR-06 |
| A11Y-01 | Automated contrast plus manual VoiceOver/TalkBack audit covers every SCR screen/control at default and 200% font size, in both Light and Dark appearances. | NFR-07 |
| INS-AUT-01 | Code review plus captured local network traffic across every FR-AUT/FR-OCR pipeline confirms zero network egress and no financial write outside an explicit confirming user action. | BR-24/25, NFR-09 |
| AUT-VER-01 | Running FR-AUT-001, 003, 004, 005, and 007 detection against the full PERF-01 fixture dataset (10,000 confirmed transactions, 500 accounts, 200 categories, 120 monthly Budgets, 50 active recurring rules, 500 retained non-confirmed ledger rows) on the PERF-01 reference devices adds no more than 150ms to cold-launch-to-interactive, executes after first paint, and surfaces no more than 3 queued suggestions per app session (excess candidates queue per FR-AUT-009). Re-run whenever PERF-GOV-01 triggers a reference-device review. | NFR-10 |
| AUT-VER-02 | Measuring elapsed time from tapping Save to the transaction being persisted and the next screen becoming interactive, with FR-AUT-002 and FR-AUT-006 active versus disabled, on the PERF-01 reference devices and fixture; the difference shall not exceed 50ms, a budget set by direct analogy to PERF-01's 200ms p95 response-to-next-frame ceiling and FR-SEC-002's 750ms ceiling for a materially heavier operation. Re-run whenever PERF-GOV-01 triggers a reference-device review. | NFR-10 |
| A11Y-AUT-01 | Automated contrast scan plus manual VoiceOver/TalkBack audit of every FR-AUT banner/prompt type and the FR-AUT-006 notification, at default and 200% font size, including focus-and-announcement order for the Save-time duplicate prompt (FR-AUT-002). Runs within the `RC-DEVICE` suite alongside A11Y-01, not a separate accessibility suite. | NFR-07 (as extended by the FR-AUT acceptance criteria) |
| UI-PERF-01 *(new in v1.8)* | Raw frame-metric exports from both PERF-01 reference devices on the release build, in both appearances, with the PERF-01 fixture loaded: every NFR-11 criterion (a)–(e) measured for each listed interaction and animation, ten runs each, with the pass/fail calculation and seed hash stored in REL-EVD-01. | NFR-11, FR-DSN-007/009/012 |
| DSG-REV-01 *(new in v1.8)* | UX Lead design review signed against Section 6A: every SCR screen and every catalogue component inspected in both appearances at default and 200% font scale on both reference devices, with a checklist for tokens, state coverage, hit targets, motion, and the "calm, tactile, numeric-first" direction. Open defects are closed or deferred only by an approved revision. | FR-DSN-002/005/006, Section 6A |
| VIS-01 *(new in v1.8)* | Automated screenshot regression: every SCR screen's key states (content, empty, error, loading) × Light/Dark × 100%/200% font scale on a fixed emulator/simulator profile. A screenshot fails when more than 0.1% of its pixels differ from the approved baseline, using a per-pixel perceptual color-distance threshold of 0.1 with anti-aliased pixels ignored. To keep results deterministic, the profile pins the emulator/simulator image and OS version, uses the bundled font, disables animations, and fixes the clock, battery, and locale. A failing run stays failed until the UX Lead approves a new baseline or the defect is fixed. | FR-DSN-001/003/006/011 |
| REL-EVD-01 | Immutable release evidence index links app commit/build, environment, every required TC result, every artifact above, approvers, and any superseding approved specification revision. A failed or missing normative result cannot be recorded as an accepted deviation under the same baseline. | All release gates |
| QA-PLAN-01 | The release evidence maps every non-retired TC and named artifact — including TC-86–TC-108, INS-AUT-01, AUT-VER-01/02, A11Y-AUT-01, UI-PERF-01, DSG-REV-01, and VIS-01 — to its suite, accountable owner, executable test/procedure, result, and evidence link; no Approved MVP item is unassigned or marked not run. | Sections 15–17 |

## 16. Release plan and gates

The MVP defined in Section 2 may be submitted only when every gate below is PASS. A failed normative test cannot be waived merely by recording it; changing the requirement or accepting a residual risk requires a new document version and the named owner’s approval.

| Gate | Owner | PASS criterion | Evidence |
|---|---|---|---|
| RG-01 Product behavior | Product Owner | O1–O4 and all P0/P1 product FR tests pass; deferred features remain absent from MVP dependency paths | TC-01–TC-85 as mapped; UX-01 |
| RG-02 Financial integrity | Engineering Lead + Product Owner | Fixed-scale money, Transfer symmetry, linked-refund constraints, immutable dates, archive invariance, and Budget/Analysis/PDF calculations pass | TC-01–TC-07, TC-13, TC-29/30, TC-39–TC-42, TC-57–TC-61, TC-83–TC-85, TC-96 |
| RG-03 Recurrence durability | Engineering Lead + QA Lead | Every disposition, backlog/reopen/user action, delete/reopen, edit, archive, tombstone, backup/restore, and whole-pass rollback test passes | TC-16–TC-24, TC-42, TC-44–TC-56, TC-82 |
| RG-04 Backup/recovery | Engineering Lead + QA Lead | v5 export/restore, compatibility rejection, refund/backlog integrity, maintenance lock, journal fault matrix, reset recovery, and device-state normalization pass | TC-09/10, TC-26, TC-34/36, TC-53/54, TC-62–TC-68, TC-82–TC-85, REC-BKP-01 |
| RG-05 Security | Security Owner | Passcode/biometrics/lockout/KDF/logging tests and reviews pass; lock copy makes no encryption claim | TC-11, TC-25/26/37, TC-70–TC-73, INS-SEC-01–03, SEC-REV-01 |
| RG-06 Privacy/store compliance | Privacy Owner + Release Manager | OS backup exclusion, telemetry consent/allowlist/opt-out, privacy policy, and store declarations match the release build | TC-76/77, INS-PRV-01–03, PRIV-VER-01/02 |
| RG-07 Notifications | QA Lead | Permission, exactly-one scheduling, change/disable, restart/timezone reconciliation, and limitation copy pass | TC-12, TC-74/75 |
| RG-08 Accessibility | UX Lead + QA Lead | Every MVP screen passes NFR-07; no blocking issue remains | TC-27, A11Y-01 |
| RG-09 Performance/compatibility/offline | Engineering Lead + QA Lead | PERF-01, PERF-GOV-01, COMPAT-01, UX-01, and TC-81 pass on recorded release builds | PERF-01, PERF-GOV-01, COMPAT-01, UX-01, TC-81 |
| RG-10 Architecture/documentation | Engineering Lead + Requirements Owner | Schema v5, generated native config, routes, dependencies, test ownership/cadence, traceability, and REL-EVD-01 match this baseline | INS-BKP-01/02, INS-ARC-01, QA-PLAN-01, REL-EVD-01 |
| RG-11 Assistive features | Product Owner + Engineering Lead + QA Lead + UX Lead | FR-AUT-001–009 tests pass; INS-AUT-01 confirms no network egress and no unconfirmed financial write; AUT-VER-01 and AUT-VER-02 confirm the performance budgets hold against the PERF-01 fixture dataset; A11Y-AUT-01 confirms accessibility coverage; PRIV-VER-01 confirms no FR-AUT content reaches the crash-payload transport; QA-PLAN-01 lists every TC/artifact above with an owner and cadence | TC-86–TC-95, INS-AUT-01, AUT-VER-01, AUT-VER-02, A11Y-AUT-01, PRIV-VER-01 |
| RG-12 Design system and UI quality | UX Lead + Engineering Lead + QA Lead | TC-97–TC-108 pass; UI-PERF-01 meets NFR-11 on both reference devices; DSG-REV-01 is signed; VIS-01 has an approved baseline and no unapproved difference; A11Y-01 passes in both appearances; no UI dependency outside the Section 6A.12 list is present | TC-97–TC-108, UI-PERF-01, DSG-REV-01, VIS-01, A11Y-01, COMPAT-01 |

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
| BR-11 | FR-BUD-001/004/007 | Budget | TC-59, TC-96 | RG-02 |
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
| O5; BR-24–27 | FR-AUT-001–009 | SuggestionState (Section 11, v1.7 schema); SCR-04/05/06/07/09/10 | TC-86–TC-95; INS-AUT-01; AUT-VER-01; AUT-VER-02; A11Y-AUT-01; PRIV-VER-01 | RG-11 |
| NFR-09/10 | Assistive-feature privacy and performance | SuggestionState pipelines | INS-AUT-01; AUT-VER-01/02 | RG-11 |
| FR-DSN-001–014 | Design system: appearance, tokens, typography, money display, components, keypad, pop-ups, motion, navigation chrome, screen states, list paging, icons, forms | Section 6A; SCR-01–SCR-12; `src/theme/`, `src/components/ui/` | TC-97–TC-108; UI-PERF-01; DSG-REV-01; VIS-01 | RG-12 |
| NFR-11 | UI responsiveness and motion quality | All screens | UI-PERF-01; TC-101; TC-105 | RG-09, RG-12 |

Deferred FR-TRN-012, FR-REC-017, FR-BUD-006, FR-ANA-004, FR-BKP-012, FR-PDF-004, and FR-OCR-001 are intentionally absent from MVP release gates. Section 2’s other Deferred items likewise have no normative MVP dependency.

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
| D-53 / v1.6 assistive-features review | Assistive features are suggestion-only; no feature may create/edit/delete financial data without explicit confirmation. | Approved MVP | Product Owner | BR-24, FR-AUT | RG-11 |
| D-54 / v1.6 assistive-features review | All detection/forecast/OCR processing is on-device; no suggestion pipeline may use the network. | Approved MVP | Security + Privacy Owners | BR-25, FR-AUT, FR-OCR | RG-11 |
| D-55 / v1.6 assistive-features review | Recurring-pattern threshold is 3 matching occurrences in a trailing 60 days; declines are durably suppressed per pattern instance. | Approved MVP | Product Owner | FR-AUT-001, BR-26 | RG-11 |
| D-56 / v1.6 assistive-features review | Duplicate-entry check is advisory only and never blocks a legitimate intentional duplicate. | Approved MVP | Product Owner | FR-AUT-002 | RG-11 |
| D-57 / v1.6 assistive-features review | Category/amount suggestion heuristics derive solely from the user's own on-device history; no shared or cloud model. | Approved MVP | Engineering Lead | FR-AUT-003 | RG-11 |
| D-58 / v1.6 assistive-features review | Suggestion/pace/nudge state (`SuggestionState`) is device-local and carries no dependency on the portable backup schema's version number; adopting these features required no schema change. | Approved MVP | Engineering Lead | Section 11, BR-18/20 | RG-04, RG-11 |
| D-59 / v1.6 assistive-features review | Receipt OCR capture is Approved-Deferred pending its own privacy review; MVP ships without it. | Approved Deferred | Privacy Owner | FR-OCR-001 | None (Deferred) |
| D-60 / v1.6 assistive-features review | FR-AUT-006 uses reschedule-on-write local notification scheduling, not background polling, since MVP architecture (Section 9) has no background execution — a poll-based design would not function. | Approved MVP | Engineering Lead | FR-AUT-006 | RG-11 |
| D-61 / v1.6 assistive-features review | At most one FR-AUT prompt is shown per screen view, in a fixed priority order favoring financial-risk warnings over convenience suggestions. | Approved MVP | Product Owner | FR-AUT-009 | RG-11 |
| D-62 / v1.6 assistive-features review | A single master "Assistive suggestions" toggle governs all FR-AUT features; disabling preserves suggestion-state history rather than resetting it. A separate "Reset suggestion history" action provides an explicit, user-initiated way to clear that history without touching the toggle. | Approved MVP | Product Owner | FR-AUT-008 | RG-11 |
| D-63 / v1.6 assistive-features review, resolved v1.7 | `SuggestionState` rows are pruned when stale (>2× the owning feature's lookback window, where one is defined), when their owning Budget's accounting month has passed (`budget_pace` only), or when orphaned by a hard delete, to bound on-device storage growth. `duplicate` and `category_hint` rows have no lookback window and are durable by design, so they are pruned only when orphaned, never for staleness. Orphan-based pruning is implemented as a direct existence check against the plaintext `accountId`/`categoryId` fields added to `SuggestionState` in v1.7 (Section 11); see D-72. | Approved MVP | Engineering Lead | BR-27, Section 11 | RG-11 |
| D-64 / critical-review R9 | Assistive computation must run off the main thread within an explicit performance budget, verified against the PERF-01 fixture dataset and re-verified on every PERF-GOV-01 reference-device review. This budget is split into a cold-launch component (AUT-VER-01) and a Save-path component specific to FR-AUT-002/006 (AUT-VER-02), since only the latter two features execute on the transaction-confirm path. | Approved MVP | Engineering Lead | NFR-10, AUT-VER-01, AUT-VER-02 | RG-09, RG-11 |
| D-65 / critical-review Finding D | Rollout-risk management for the heuristic, judgment-based features (FR-AUT-001, 002, 003) is an internal Engineering practice — e.g., a build-time or remote-config flag used to stage exposure during early releases — and is **not** a documented product requirement and has **no effect** on FR-AUT-008, which remains one all-or-nothing toggle governing FR-AUT-001–007 as specified. This decouples rollout-risk management from the requirements baseline. Any exit criteria for Engineering's staged rollout (acceptance rate, false-positive rate, cohort size, duration) are Product Owner's to set operationally and are intentionally not codified here as a release gate; RG-11 continues to require FR-AUT-001–009 to pass together. | Approved MVP | Product Owner | FR-AUT-001/002/003; explicitly does not modify FR-AUT-008 | None beyond RG-11's existing requirement that all of FR-AUT-001–009 pass |
| D-66 / v1.6 rebase onto v1.5 | Every FR-AUT algorithm that reads Expense transactions (pattern detection, duplicate check, category suggestion) shall treat `expenseEffect=refund` rows as a distinct case from `expenseEffect=purchase`, matching BR-23's refund model. | Approved MVP | Engineering Lead | FR-AUT-001/002/003, BR-23 | RG-11 |
| D-67 / v1.6 rebase onto v1.5 | An Account or Category with an active RecurringRule or a non-terminal (`pending`/`deferred_backlog`) ledger row is never eligible for the dormant-entity suggestion, even with zero confirmed transactions, since the recoverable-backlog model means real pending activity can exist without a confirmed row yet. | Approved MVP | Product Owner | FR-AUT-007, BR-13 | RG-11 |
| D-68 / critical-review R5 | FR-AUT-005/006/007's detection windows (30 days / 5 days / 12 months) are fixed constants for MVP, not user-configurable, to avoid adding new Preferences UI beyond the single master toggle and reset action. FR-AUT-005's threshold is simplified to "crosses zero" only. Configurability may be revisited post-MVP if usage data shows demand. | Approved MVP | Product Owner | FR-AUT-005/006/007, SCR-09 | RG-11 |
| D-69 / critical-review Finding B | The Budget pace UI (SCR-04) is an arbitrated banner subject to FR-AUT-009's priority queue, not a persistent always-visible indicator. | Approved MVP | Product Owner | FR-AUT-004, FR-AUT-009, SCR-04 | RG-11 |
| D-70 / critical-review Finding C | FR-AUT-002 and FR-AUT-006 schedule/cancel their respective side effects (suppression state; local notification) using identifiers scoped to their own feature, independent of FR-NOT-002's daily-reminder identifier, so that disabling one feature never affects the other. This required the concurrent amendment to FR-NOT-002 recorded in Section 19's change log, removing its former literal "cancel all Kwartracker reminder requests" scope. | Approved MVP | Product Owner + Engineering Lead | FR-AUT-006; FR-NOT-002 | RG-07, RG-11 |
| D-71 / critical-review R2 | Preferences (SCR-09) gains a "Reset suggestion history" action, giving users a way to clear all `SuggestionState` data — including an FR-AUT-002 combination permanently suppressed under BR-26 — without a full data reset. | Approved MVP | Product Owner | FR-AUT-002, FR-AUT-008, SCR-09 | RG-11 |
| D-72 / v1.7 audit resolution | `SuggestionState`'s single hash-based `patternKey` is replaced with explicit, nullable, kind-specific plaintext identity fields (`accountId`, `categoryId`, `expenseEffect`, `weekdayMask`, `amountBucketMinor`/`amountMinor`, `budgetMonth`). `patternKey` remains only as a derived index hash, never the source of truth. This resolves BR-27(b)'s orphan-pruning gap and the mismatch between the old formula and `duplicate`/`budget_pace`/`low_balance`/`dormant_entity`/`inactivity_nudge`, and the BR-26 `expenseEffect` conflict for `duplicate`. | Approved MVP | Engineering Lead | Section 11, BR-26, BR-27 | RG-11 |
| D-73 / v1.7 audit resolution | FR-AUT-002's three-strikes suppression is tracked by a new `SuggestionState.occurrenceCount` integer, incremented once per Save Anyway on an identical (account, `expenseEffect`, category, amount) combination; `dismissedAtUtc` is set once the count reaches 3. | Approved MVP | Engineering Lead | Section 11, FR-AUT-002 | RG-11 |
| D-74 / v1.7 audit resolution | FR-AUT-003's category pre-fill gains a separately dismissible "suggested" indicator distinct from ordinary field editing. Dismissing the indicator (not merely changing the field's value) durably suppresses future category suggestions for that (account, amount-bucket) combination per BR-26; editing the field alone does not. | Approved MVP | Product Owner + UX Lead | FR-AUT-003, BR-26, SCR-05 | RG-11 |
| D-75 / v1.7 audit resolution | FR-AUT-009's arbitration is scoped to same-screen collisions only, matching Section 6's disjoint screen assignments (no app-wide banner surface exists). TC-94 is rewritten to test the two collision sets the architecture actually produces (SCR-05: FR-AUT-001/002/003; SCR-06: FR-AUT-005/007) instead of a cross-screen scenario Section 6 does not support. | Approved MVP | Product Owner | FR-AUT-009, Section 6, TC-94 | RG-11 |
| D-76 / v1.7 audit resolution | NFR-10's "never block" language is scoped to exclude FR-AUT-002/FR-AUT-006, which remain the two features executing synchronously on the Save path under a fixed, explicitly budgeted 50ms allowance; behavior is unchanged, only the self-contradictory wording is corrected. | Approved MVP | Engineering Lead | NFR-10 | RG-09, RG-11 |
| D-77 / v1.7 audit resolution | FR-PRV-004's controlled-transport payload inspection (PRIV-VER-01) must include at least one capture taken while an FR-AUT suggestion is pending, accepted, and declined, closing a gap where the FR-AUT crash-payload exclusion (Section 7 acceptance criteria) had no assigned verification artifact. | Approved MVP | Privacy Owner | FR-PRV-004, PRIV-VER-01 | RG-06, RG-11 |
| D-78 / v1.7 audit resolution | Adds FR-BUD-007, an explicit Budget-deletion requirement, closing a gap where FR-CAT-002 referenced "explicit Budget deletion" as a precondition for category hard-delete without any FR-BUD requirement defining that action. | Approved MVP | Product Owner | FR-BUD-007, FR-CAT-002, BR-10 | RG-02 |
| D-79 / v1.7 audit resolution | INS-SEC-02's device coverage is broadened to include at least one non-reference-brand Android biometric implementation, given `disableDeviceFallback`'s documented history of inconsistent Android enforcement across OEM biometric stacks. FR-SEC-003 itself is unchanged; only the evidence required to certify it is broadened. | Approved MVP | Security Owner | INS-SEC-02, FR-SEC-003 | RG-05 |
| D-80 / v1.7 audit resolution | The FR-AUT-002 possible-duplicate modal is placed unambiguously on SCR-05 (Transaction Input) at Save time, before commit, resolving an ambiguity where Section 6 had attributed it to SCR-01 (Records) despite the Cancel option requiring it to block commit on the input screen. | Approved MVP | UX Lead | FR-AUT-002, Section 6 (SCR-01/SCR-05) | RG-11 |
| D-81 / v1.8 design system | BudgetFlow and CRED are design direction only: speed-first keypad entry, calm cards, and native feel from BudgetFlow; dark-first premium surfaces, bold type, tactile pop buttons, and restrained motion from CRED. No assets, brand colors, typefaces, or trade dress are copied; UX Lead sign-off on DSG-REV-01 is the authority for intended feel. | Approved MVP | Product Owner + UX Lead | Section 6A.1, DSG-REV-01 | RG-12 |
| D-82 / v1.8 design system | One theme (`kwartracker`) with Dark and Light appearances; `uiMode` is `system` (default), `light`, or `dark`; Dark is the primary design target. This clarifies FR-SET-002 without adding a theme or a Preferences field, so the backup schema stays v5. | Approved MVP | Product Owner | FR-SET-002, FR-DSN-001, Section 6A.2 | RG-12 |
| D-83 / v1.8 design system | Inter (weights 400/500/600/700) is bundled offline and used with tabular numerals for all money; failure falls back to the system font; no runtime font download. | Approved MVP | UX Lead + Engineering Lead | FR-DSN-003, NFR-01 | RG-12 |
| D-84 / v1.8 design system | Tactile feel comes from the PopButton (solid ledge, 3 dp press travel) and tonal surfaces; blur, translucency, gradients, inner-shadow neumorphism, and per-row shadows are rejected because they cost frame time on mid-range Android. | Approved MVP | UX Lead + Engineering Lead | FR-DSN-005, Section 6A.5 | RG-12 |
| D-85 / v1.8 design system | Motion animates only transform and opacity on the UI thread, with fixed duration tokens. Money values and data visualizations are never animated; no count-up, shimmer, Lottie, or looping effect. Reduce-motion collapses all motion. | Approved MVP | UX Lead + Engineering Lead | FR-DSN-004, FR-DSN-009, NFR-11 | RG-12 |
| D-86 / v1.8 design system | Haptics fire for exactly four events (key tap, save success, error, destructive-dialog open) and have no in-app preference, because a preference would add a portable Preferences field and force a backup-schema change. | Approved MVP | UX Lead | FR-DSN-009 | RG-12 |
| D-87 / v1.8 design system | MVP is phone-only and portrait-only; tablet and landscape layouts are not supported, which removes a large class of layout defects. A later revision may add them. | Approved MVP | Product Owner | FR-DSN-010, NFR-06 | RG-12 |
| D-88 / v1.8 design system | No swipe-row actions and no sticky date headers in MVP lists; the drawer edge-swipe works only on tab screens. This avoids gesture collisions and keeps list recycling cheap. | Approved MVP | UX Lead | FR-DSN-010, FR-DSN-012 | RG-12 |
| D-89 / v1.8 design system | Category identity color is derived from the UUID into a fixed 12-color verified palette (no stored color field), and icons resolve through a registry with an `other` fallback for unknown keys, so restores never fail on icon data. | Approved MVP | UX Lead + Engineering Lead | FR-DSN-013, TC-107 | RG-12 |
| D-90 / v1.8 design system | Records loads in keyset pages of 50 and month totals come from an aggregate query, so scrolling and totals stay correct under concurrent writes and 10,000-row datasets. | Approved MVP | Engineering Lead | FR-DSN-012, TC-105 | RG-09, RG-12 |
| D-91 / v1.8 design system | No third-party UI kit is approved; the UI layer uses only the dependency list in Section 6A.12, at SDK 57-supported versions, and any addition needs a register entry and RG-12. | Approved MVP | Engineering Lead | Section 6A.12, COMPAT-01 | RG-12 |
| D-92 / v1.8 design system | Design quality is gated by RG-12: TC-97–TC-108, UI-PERF-01 device frame metrics, a signed DSG-REV-01 design review, and a VIS-01 screenshot baseline. | Approved MVP | UX Lead + QA Lead | RG-12, Section 15 | RG-12 |
| D-93 / v1.8 design system | SCR-05 uses inline one-tap account and category chips with the keypad and Save pinned at the bottom, so a minimal Expense costs three non-keypad activations against O1's limit of five. The preselected transaction type is derived from the latest confirmed transaction, not stored. | Approved MVP | Product Owner + UX Lead | O1, FR-DSN-007, TC-101 | RG-01, RG-12 |
| D-94 / v1.8 design system | The Analysis chart is a ranked bar list built from views, not a charting library, which keeps it exact, accessible, and cheap to render; the full ranked list below it shows every category per FR-ANA-002. | Approved MVP | UX Lead | FR-ANA-002, Section 6A.8 | RG-12 |
| D-95 / v1.9 closure | The icon set is Lucide, imported one icon per module with a normative key-to-icon table (Section 6A.6). It is permissively licensed, stroke-based (matching the 1.75 dp outline style), covers every registry key, runs on `react-native-svg` already in the stack, and per-module imports guarantee only used icons are bundled. | Approved MVP | UX Lead + Engineering Lead | FR-DSN-013, Section 6A.6, TC-107 | RG-12 |
| D-96 / v1.9 closure | The list component is `@shopify/flash-list` v2 at the SDK 57-selected version. Expo's SDK 57 documentation lists it with a recommended version, it is JavaScript-only, needs no item-size estimates, recycles rows, and fits the New Architecture that React Native 0.86 requires. | Approved MVP | Engineering Lead | FR-DSN-012, NFR-11, Section 6A.12 | RG-09, RG-12 |
| D-97 / v1.9 closure | VIS-01 fails a screenshot when more than 0.1% of pixels differ, using a 0.1 perceptual per-pixel threshold with anti-aliasing ignored, on a pinned device profile with fixed clock, locale, and animations disabled. The tolerance is tight enough to catch real regressions and loose enough to ignore sub-pixel rendering noise. | Approved MVP | QA Lead + UX Lead | VIS-01, FR-DSN-001/003/006/011 | RG-12 |

## 19. Requirements change log

| Change | Affected IDs | Reason |
|---|---|---|
| Named the icon set (Lucide, per-icon imports, key-to-icon table), the list component (`@shopify/flash-list` v2), and the VIS-01 pixel tolerance | Section 6A.6, 6A.12, VIS-01, TC-107, D-95–D-97 | v1.8 left these three choices open ("open-licensed set", "or an equivalent", "agreed threshold"); each is now decided and testable |
| Added Section 6A, the design system, inside this document | Section 6A, FR-DSN-001–014, D-81–D-94 | A production-quality, performant UI needs normative tokens, components, motion rules, and layouts; keeping them in the baseline lets them be traced and gated like every other requirement |
| Added NFR-11 (UI responsiveness and motion quality) | NFR-11, UI-PERF-01, TC-101, TC-105 | Smoothness was covered only by PERF-01's scroll and 200 ms response limits; interaction- and animation-level limits are now measurable |
| Added TC-97–TC-108, UI-PERF-01, DSG-REV-01, VIS-01 and gate RG-12 | Section 15, Section 16, Section 17, QA-PLAN-01 | Every FR-DSN requirement needs a named verification artifact and an owner |
| Clarified FR-SET-002: Dark and Light are appearances of the single MVP theme, with defined `uiMode`/`theme` values | FR-SET-002, TC-98, D-82 | "System-following appearance" and "single MVP theme" left the allowed values undefined; no Preferences field or schema version changed |
| Extended A11Y-01 to both appearances; corrected the stale "95 test IDs" count in Section 15 | A11Y-01, Section 15 | Dark and Light must each pass NFR-07; the count lagged TC-96 after v1.7 |
| Replaced `SuggestionState`'s single hash-based `patternKey` with kind-specific plaintext identity fields and an `occurrenceCount` | Section 11, BR-26, BR-27, FR-AUT-002, D-72/D-73 | One formula could not represent `duplicate` (missing `expenseEffect`, spurious weekday component breaking BR-26's date-independent key), `budget_pace`/`low_balance`/`dormant_entity`/`inactivity_nudge` (no matching fields at all), or FR-AUT-002's three-strikes count |
| Defined FR-AUT-003's previously-undefined dismiss/suppression behavior with an explicit indicator and dismiss control | FR-AUT-003, BR-26, SCR-05, D-74 | BR-27 assumed `category_hint` suppression was durable "by design," but no requirement defined what user action created or cleared that state |
| Scoped FR-AUT-009's arbitration to same-screen collisions and rewrote TC-94 | FR-AUT-009, Section 6, TC-94, D-75 | The prior six-way global order and TC-94 presupposed cross-screen collisions (low-balance forecast × Budget pace × recurring-pattern suggestion) that Section 6's disjoint screen assignments cannot produce |
| Placed the FR-AUT-002 duplicate modal unambiguously on SCR-05 at Save time | FR-AUT-002, Section 6 (SCR-01/SCR-05), D-80 | Section 6 had attributed the modal to SCR-01 (Records), but its Cancel option requires blocking commit on the input screen (SCR-05), not after navigation |
| Corrected NFR-10's self-contradictory "never block" wording | NFR-10, D-76 | The clause claimed FR-AUT computation never blocks the Save workflow, then carved out FR-AUT-002/006 as adding up to 50ms to Save latency; behavior was already correct, only the wording conflicted with itself |
| Extended FR-PRV-004/PRIV-VER-01 payload inspection to cover FR-AUT | FR-PRV-004, PRIV-VER-01, RG-11, D-77 | The FR-AUT crash-payload exclusion (Section 7 acceptance criteria) had no assigned verification artifact |
| Added FR-BUD-007 (explicit Budget deletion) and TC-96 | FR-BUD-007, FR-CAT-002, BR-10, TC-96, D-78 | FR-CAT-002 referenced "the Budget must first be explicitly deleted" as a precondition for category hard-delete, but no FR-BUD requirement defined that action |
| Broadened INS-SEC-02's device coverage for biometric-fallback verification | INS-SEC-02, FR-SEC-003, D-79 | `disableDeviceFallback` has a documented history of inconsistent enforcement across Android OEM biometric stacks; the two PERF-01 reference devices alone under-covered that risk |
| Noted the WAL/exclusive-transaction trade-off | Section 9 | An exclusive transaction blocks concurrent readers even under WAL for its duration; previously unacknowledged, now documented as an accepted trade-off |
| Clarified TC-91's background-execution claim belongs to architecture review, not a device test | TC-91, INS-ARC-01 | "Verify no background execution occurred" is not something a runtime device test can directly observe; moved to INS-ARC-01's code/architecture review scope |
| Replaced irreversible cap exclusion with recoverable backlog and explicit user resolution | O4; BR-13/17; SCR-10; FR-REC-003/004/010/011/015/016; Sections 11–13; TC-16/46/52/54/82; D-15/49 | Preserve lapsed-user occurrences without silently changing totals or creating an unbounded review batch |
| Replaced refund-as-Income with linked Expense-refund accounting | O2; BR-01–03/23; FR-TRN-001/002/006/008–010; FR-BUD-002; FR-ANA-001–003; FR-BKP-004; FR-PDF-002; Sections 11/13; TC-35/40/41/61/83–85; D-52 | Keep Income truthful and define account, range, Budget, deletion, concurrency, export, and restore semantics |
| Added verification execution ownership and cadence | Section 15; QA-PLAN-01; RG-01/RG-10; D-50 | Make the acceptance set executable by a small MVP team without dropping required financial/security evidence |
| Added performance-device lifecycle governance | NFR-04; PERF-01; PERF-GOV-01; RG-09; D-14/31/51 | Prevent benchmark anchors from becoming incompatible or unrepresentative as OS support moves |
| Added advisory-only assistive/suggestion feature set with on-device-only constraint | O5; BR-24–27; FR-AUT-001–009; NFR-09/10; Section 11 SuggestionState | Reduce repeated manual entry and surface Budget/balance risk early without weakening the offline-first, no-cloud-dependency, and confirm-before-commit posture already established in O3, BR-14, and FR-NOT |
| Deferred receipt OCR pending its own privacy review | FR-OCR-001 | Image/text-derived data introduces a distinct privacy surface from anything else in the MVP baseline |
| Added refund-model awareness to FR-AUT-001/002/003 and backlog-model awareness to FR-AUT-007 | FR-AUT-001–003, FR-AUT-007; D-66/67 | `expenseEffect` and the recoverable `deferred_backlog` disposition must be excluded/handled explicitly or three heuristics would misfire against refunds or pending backlog |
| Assigned FR-AUT/FR-OCR test IDs and artifacts to QA-PLAN-01 suites, owners, and cadence | Section 15 verification execution plan | Every Approved item must carry executable ownership per QA-PLAN-01 |
| Scoped FR-NOT-002's disable action to the daily-reminder feature's own notification requests | FR-NOT-002, TC-74 | The original "cancel all" wording predated any second notification-scheduling feature and would otherwise cancel FR-AUT-006's inactivity-nudge notification whenever the daily reminder is disabled |
| Resolved a contradiction between SCR-04's UX description and FR-AUT-009's arbitration logic for Budget pace | SCR-04, FR-AUT-004, FR-AUT-009, D-69 | Both described the same feature two incompatible ways (persistent indicator vs. arbitrated banner); resolved to arbitrated banner |
| Corrected FR-AUT-006/007's priority label from P3 to P2 | FR-AUT-006, FR-AUT-007 | Both are Approved MVP with required tests (TC-91/92) and are named in RG-11's pass criteria; P3 is reserved for Deferred items throughout this document (Section 15) |
| Defined BR-27's pruning rule per `SuggestionState` kind rather than one undifferentiated rule | BR-27, D-63, TC-95 | The original single time-based rule had no defined window for `duplicate`, `category_hint`, or `budget_pace`, risking either an unimplementable rule or accidental erosion of FR-AUT-002's stated permanent suppression |
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
- Every Approved MVP objective, BR, FR, NFR, security/privacy obligation, and release gate maps to a named Section 15 test or verification artifact; QA-PLAN-01 assigns execution ownership and cadence — including v1.6's additions (TC-86–TC-95, INS-AUT-01, AUT-VER-01/02, A11Y-AUT-01) and v1.7's additions (TC-96, PRIV-VER-01's extended scope). TC-95's orphan-pruning assertions are now executable: Section 11's v1.7 schema stores the plaintext `accountId`/`categoryId` each `SuggestionState` row needs for BR-27(b)'s existence check (D-72).
- Assistive/suggestion features (FR-AUT-001–009) are advisory only: BR-24 and INS-AUT-01 confirm no suggestion pipeline creates, edits, or deletes a Transaction, Account, Category, Budget, or RecurringRule without an explicit confirming user action, and INS-AUT-01 confirms zero network egress alongside BR-25. Each `SuggestionState` row now carries an identity-field set matched to its own `kind` (Section 11, D-72) rather than one formula borrowed from `recurring_pattern`; FR-AUT-002's three-strikes rule has a counter to count with (`occurrenceCount`, D-73); FR-AUT-003 has a defined dismiss action (D-74); FR-AUT-009's arbitration is scoped to the same-screen collisions Section 6 actually produces (D-75); and the FR-AUT crash-payload exclusion is backed by PRIV-VER-01 (D-77).
- The design system (Section 6A) is normative and traceable: every FR-DSN requirement and NFR-11 maps to a named test or artifact and to RG-12 (Section 17); every color pairing's contrast ratio is stated from computed values and recomputed by TC-97; the category palette is verified against both appearances and the tinted icon tile; no Preferences field or backup-schema element was added (D-82, D-86, D-89); and every motion, haptic, and list rule that the smoothness goal depends on is a measurable requirement rather than a guideline (NFR-11, FR-DSN-009, FR-DSN-012).
- Version 1.9 closed the three choices v1.8 had left loosely worded (icon set, list component, screenshot tolerance); a scan of the document finds no remaining "or equivalent", "agreed threshold", or unnamed-library wording in the normative sections (D-95–D-97).
- Deferred Phase 2/3 work has no MVP release dependency: background recurrence, widgets, search/filter, spreadsheet export, budget rollover, extended charts, multi-currency, encryption, entitlement, extra themes, formal certification beyond NFR-07, and on-device receipt OCR (FR-OCR-001).

### Residual risks

- A specification cannot prove implementation correctness. Restore crash consistency, native backup exclusion, biometric fallback, native crash payloads, OS notification behavior, and performance require the device/build evidence mandated in Section 15.
- SDK 57 and store/platform rules can change after this baseline. Any SDK upgrade or later store submission requires version-matched documentation review and a compatibility/security/privacy re-run.
- Schema v1–v4 backups are intentionally unsupported because those identifiers came from unreleased drafts and authoritative canonical schemas/fixtures are unavailable. Supporting them later requires the controlled process in FR-BKP-011.
- The recurrence cap now preserves rather than discards older occurrences, but a large backlog remains pending until the user explicitly generates or excludes it; the persistent count/date-range UI is required to keep that trade-off visible.
- Refunds are allocated by their receipt accounting date. A selected range may therefore show negative net Expense for a category even when the original purchase lies outside the range; the required “Net refund” label communicates that result.
- App lock does not encrypt local financial data or exported backups. The UI and store copy must maintain that limitation; encryption remains deferred.
- `SuggestionState` is device-local and excluded from backup/restore (Section 11); restoring a backup or reinstalling the app resets all suggestion-suppression history, so previously dismissed suggestions (recurring-pattern, duplicate, category-hint, or dormant-entity) can resurface. This is expected behavior, not a defect, and should be reflected in release notes or support content rather than engineered around.
- FR-AUT-006's entry-cadence nudge depends on OS notification permission exactly as FR-NOT-001's daily reminder does, and silently no-ops when permission is absent or revoked, consistent with FR-NOT-001's own handling; this is a shared, already-accepted risk, not a new one.
- All FR-AUT/FR-OCR detection is heuristic (amount-bucket, weekday-cadence, and fixed-window pattern matching); false positives and false negatives are expected and are mitigated by every suggestion being dismissible and non-binding (BR-24, BR-26) rather than by tuning for perfect accuracy.
- **Resolved in v1.7 (was unresolved in v1.6):** BR-27 rule (b)'s orphan-pruning gap is closed. Section 11's `SuggestionState` schema now stores plaintext `accountId`/`categoryId` per row (D-72), so rule (b) is a direct existence check rather than a hash-reversal problem. The same schema change also resolved four adjacent gaps the v1.6 audit found beyond the one named in that revision: (1) the v1.6 hash formula had no `expenseEffect` input and included a `weekday` component that would have fragmented FR-AUT-002's own date-independent suppression key, breaking BR-26's stated purchase/refund distinction — both are now explicit identity fields (D-72); (2) FR-AUT-002's "three times" rule had no counter field — `occurrenceCount` now provides one (D-73); (3) FR-AUT-003's `category_hint` suppression was assumed by BR-27 but never behaviorally defined anywhere else — it now has an explicit dismiss control and pattern-instance definition (D-74, BR-26); (4) FR-AUT-009's global arbitration order and TC-94 presupposed cross-screen banner collisions that Section 6's disjoint screen assignments cannot produce — arbitration is now explicitly scoped to same-screen collisions and TC-94 tests the collisions that actually exist (D-75). Two smaller items are also closed: NFR-10's "never block" clause contradicted its own FR-AUT-002/006 carve-out and is now scoped to exclude them explicitly (D-76); and the FR-AUT crash-payload exclusion claim had no assigned verification artifact and is now covered by PRIV-VER-01's extended scope (D-77). A narrow residual note, not an open item: orphaning per rule (b) can still only occur after every transaction/Budget referencing the entity has itself been deleted and the entity then hard-deleted (BR-10 forbids hard-delete while any reference remains), so pruning activity under rule (b) is expected to be infrequent — this is a property of the referential-integrity rule, not a gap in rule (b)'s implementability.
- Smooth, bug-free UI cannot be proven by a specification. Section 6A turns the goal into measurable limits (NFR-11) and defect-prevention rules, but frame rate, input latency, and perceived polish are established only by UI-PERF-01 on the PERF-01 reference devices and by the UX Lead's DSG-REV-01 sign-off on real hardware.
- The BudgetFlow and CRED direction is interpretive (Section 6A.1). It is drawn from publicly described characteristics, not a licensed pixel audit, and no assets are copied; whether the result feels as intended is a DSG-REV-01 judgment, not a conformance fact.
- Contrast ratios are computed from the token hex values. Perceived color varies with display panel, brightness, and night-mode filters, so A11Y-01 and DSG-REV-01 repeat the check on the physical reference devices.
- The UI depends on Reanimated, Gesture Handler, a recycling list, and related libraries whose behavior on React Native 0.86 and SDK 57 is established only by COMPAT-01 and UI-PERF-01 evidence; any SDK or library upgrade requires re-running TC-97–TC-108 and UI-PERF-01.
- The MVP is phone-only and portrait-only (D-87), and haptics have no in-app off switch (D-86). Both are deliberate limits chosen to avoid layout defects and a backup-schema change; a later revision may revisit them.

This audit confirms internal specification readiness and traceability. It does not claim that an application build has passed the gates until REL-EVD-01 contains the required evidence. As of v1.7, every item raised by the independent post-v1.6 readiness audit — the `SuggestionState` orphan-pruning gap this document already named, and the additional keying, counter, dismiss-behavior, arbitration-scope, wording, verification-coverage, and Budget-deletion gaps that audit found beyond it (D-72–D-80) — has a normative resolution in this document, a corresponding schema/requirement/test change, and traceability through Sections 11, 15, 17, 18, and 19. No item in this section is carried forward as open. Version 1.8's design system adds the residual risks listed above; each is tied to a named test or sign-off, none is an undecided decision.
