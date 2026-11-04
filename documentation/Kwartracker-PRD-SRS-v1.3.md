# Kwartracker — Product Requirements Document & Software Requirements Specification

**Product:** Kwartracker — offline-first personal expense tracker (React Native + Expo)
**Document type:** Combined PRD/SRS
**Version:** 1.3
**Date:** 2026-09-23
**Status:** Draft — v1.3 incorporates full remediation of the external Forensic PRD/SRS Review of v1.2. All Critical and High findings from that review have been resolved to specific, testable, normative requirements below. A set of Proposed decisions with recommended answers (Section 18, items #20–#36, and Section 18b) and a small number of genuine Open Questions remain pending explicit Product Owner / Security / Engineering sign-off before this document can move from Draft to Approved — see the companion **Unresolved Decision Register** for the authoritative, sign-off-ready list.
**Source of truth:** *Kwartracker: An Expense Tracker Mobile App.pdf* (the "Source"), interpreted per the Evidence Model below; *Feature: Recurring Transaction Rules (weekday-based) — Final Spec.md* (the "Recurring Rules Addendum"), incorporated in v1.2; and the *Forensic PRD/SRS Review — Kwartracker PRD/SRS v1.2* (the "Forensic Review"), whose findings (F‑001…F‑026) are resolved throughout this revision and tracked via the new Section 18b gap-resolution log.

## Table of Contents

*(Markdown does not paginate; section numbers below are stable anchors. A prior v1.2 caveat — Finding F‑023 — noted the Word edition's Table of Contents was hand-typed rather than a live field; if this v1.3 is converted to Word, generate the ToC as a live field at that time rather than retyping page numbers.)*

0. Evidence Model
Phase 1. Source Audit & Decision Register (AUD‑01…AUD‑18)
1. Document Control
2. Product Vision, Objectives, Scope, Constraints, MVP, Future Scope, Out-of-Scope
3. Personas and Use Cases
4. Feature Catalogue
5. Business Rules
6. Information Architecture & UI/UX
7. Functional Requirements (FR‑TRN, FR‑REC, FR‑ACC, FR‑CAT, FR‑BUD, FR‑ANA, FR‑BKP, FR‑PDF, FR‑SEC, FR‑SET, FR‑NOT, FR‑WDG, FR‑NAV, FR‑ERR)
8. Non-Functional Requirements
9. Technical Architecture
10. Project Structure
11. Data Model and Storage
12. Internal Service Boundaries
13. Validation and Error Handling
14. Security and Privacy
15. Testing and QA
16. Release Plan (incl. 16.1 MVP Release-Gate Checklist)
17. Traceability Matrix
18. Final Decisions and Actions (decisions #1–#36)
   18a. Recurring Transaction Rules — Gap Resolution Log (v1.2)
   18b. Forensic Review Remediation Log (v1.3) — AUD‑19…AUD‑35
Final Audit

## 0. Evidence Model (applied throughout this document)

| Label | Meaning | May use "shall"? |
|---|---|---|
| Confirmed | Stated plainly in the Source | Yes |
| Approved decision | Resolved by an explicit product-owner (PO) decision recorded in this document | Yes |
| Assumption | Reasonable inference, not yet approved | No |
| Proposed decision | Recommendation awaiting PO (or, where noted, Security/Engineering) sign-off | No |
| Open question | Cannot be resolved from Source or decision | No |
| Future enhancement | Explicitly deferred beyond MVP | No |
| Out of scope | Explicitly excluded | No |

No item below is promoted past its true evidence status. Where the Source's own claims are contradictory or aspirational (e.g., "unlimited"), that is recorded as a claim, not adopted as a guarantee. The Recurring Rules Addendum is a Claude-authored feature spec, not a Source claim; its own contents are held to the same standard. **v1.3 addition:** the Forensic Review's findings are external quality-assurance input, not a Source claim either — every fix below is labeled exactly like any other item (most as Proposed decision, since a recommendation still needs sign-off; a few as direct Approved corrections where the change is purely a documentation-accuracy fix, such as a field-naming correction, with no product judgment call involved). **Clarification (resolves a Section 0 gap noted in the Forensic Review):** if a Proposed decision is rejected by its approver, it does not silently disappear — it is re-opened as an Open Question with the rejection reason recorded in the relevant Section 18/18a/18b row, and this document's version is incremented again once a new recommendation is drafted.

## Phase 1 — Source Audit & Decision Register

*(Unchanged from v1.2 — AUD‑01 through AUD‑14 audit the original Source document; AUD‑15 through AUD‑18, covering the Recurring Transaction Rules feature added in v1.2, appear in Section 18a. New audit items AUD‑19 through AUD‑35, resolving the external Forensic Review's findings, appear in Section 18b.)*

| ID | Source statement (or "not addressed") | Classification | Ambiguity / Contradiction / Risk | Recommended Decision | Decision Status | PO Approval Required? |
|---|---|---|---|---|---|---|
| AUD‑01 | Title says "Kwartracker"; Sidebar/Preferences say "MyMoney 6.6-free" | Confirmed (naming conflict) | Leftover branding from a reference document | Replace every "MyMoney" occurrence with "Kwartracker"; drop "6.6-free" | Approved decision | No |
| AUD‑02 | "Local Storage Database" / "Local Storage as Database" | Confirmed as description; Assumption as spec | KV store vs. relational DB | Use Expo SQLite as the relational store; AsyncStorage-class KV only for small settings/flags | Proposed decision | Yes |
| AUD‑03 | Sidebar "upgrade to Pro"; Theme/Passcode "locked to Pro" | Confirmed | No backend/network stated; offline-first app has no entitlement mechanism | Free/Pro entitlement out of scope for MVP; unified feature set | Proposed decision | Yes |
| AUD‑04 | "Passcode protection"; "Safe & Secured... protect data" | Confirmed (gate); Not addressed (encryption) | Conflates access gate with confidentiality | Ship passcode gate + optional biometric unlock; encryption at rest is a Future enhancement | Proposed decision | Yes |
| AUD‑05 | "Quick Homescreen Widget... log new expense records directly from the home screen" | Confirmed (desired); Assumption (feasibility) | Widgets can't access app SQLite directly; iOS can't host a numeric keypad | Android-only, read-only, tap-to-deep-link widget in Phase 2/3 | Proposed decision | Yes |
| AUD‑06 | "unlimited income and expense categories"; "no limitation on account creation" | Confirmed as claim; Assumption re: ceiling | No stated ceiling for QA pass/fail | No hard cap in UI; soft QA target 500 accounts / 200 categories | Proposed decision (QA target only) | Yes, for the QA number |
| AUD‑07 | Currency sign/position/decimals described as global | Confirmed (single global currency) | Whether an account can hold a different currency | MVP is single-currency; multi-currency out of scope | Approved decision | No |
| AUD‑08 | "Protect data with local backups, restore files... export worksheets" | Confirmed (backup/restore/export exist); Not addressed (replace vs. merge, versioning) | Restore is destructive if unspecified | Restore replaces all local data after double-confirmation; backup carries schemaVersion | Proposed decision | Yes |
| AUD‑09 | Input screen: "top tabs... Income, Expense, or Transfer" | Confirmed (three types exist); Not addressed (Transfer's effect on totals) | Highest-risk silent data-integrity bug in the spec | Transfer stores fromAccountId/toAccountId, no category, excluded from all Income/Expense aggregates | Proposed decision | Yes |
| AUD‑10 | "ignore inactive accounts or categories" | Confirmed (archive concept exists); Not addressed (deleting an entity with history) | Hard-delete risks orphaning or cascading financial history | Soft-delete via isArchived; hard delete only when zero referencing records | Proposed decision | Yes |
| AUD‑11 | Accounts screen shows "current distinct balances" | Not addressed | Stored running total vs. computed-on-read can drift | Balance computed as openingBalance + SUM(signed **confirmed** transactions), not stored — **qualifier added in v1.3, see AUD‑19** | Proposed decision | Yes |
| AUD‑12 | Budgets: "Total Budget," "Total Spent," progress bars | Confirmed (monthly, category-scoped); Not addressed (rollover) | Users expect rollover; Source implies flat monthly reset | MVP budgets are monthly, non-rolling; mid-month changes apply unprorated | Proposed decision | Yes |
| AUD‑13 | Records: "toggle between months"; manual date/time entry | Confirmed; Not addressed (time zone handling) | Cross-time-zone travel could reshuffle past totals | Dates stored as UTC; day/month boundaries evaluated in local time at read time | Proposed decision | Yes |
| AUD‑14 | Records is a chronological list; Analysis filters by date range | Not addressed | No search/filter/recurring-transaction capability described | Search/filter/recurring transactions deferred to Future enhancement for MVP (recurring transactions promoted into MVP as of v1.2) | Proposed decision | Yes |


## 1. Document Control

| Field | Value |
|---|---|
| Document title | Kwartracker PRD/SRS v1.3 |
| Author | Generated per PRD/SRS Generation Prompt v2, from the Kwartracker source PDF; v1.2 revision incorporated the Recurring Transaction Rules Addendum; v1.3 revision incorporates full remediation of the external Forensic PRD/SRS Review of v1.2 |
| Status | Draft — v1.3; pending sign-off on Section 18 decisions #1–#36 (see the Unresolved Decision Register for the current, non-duplicative list of what genuinely still needs a stakeholder answer) |
| Source documents | (1) *Kwartracker: An Expense Tracker Mobile App.pdf* (the "Source"); (2) generation prompt (kwartracker-prd-srs-prompt-v2.md); (3) *Feature: Recurring Transaction Rules (weekday-based) — Final Spec.md*, incorporated in v1.2; (4) *Forensic PRD/SRS Review — Kwartracker PRD/SRS v1.2*, remediated in v1.3 |
| Change control | Any change to a shall requirement (Section 7) requires updating this document's version, the Decision Register (Phase 1 / Section 18/18a/18b), and the Traceability Matrix (Section 17) in the same revision. **v1.3 addition:** any change to the Data Model (Section 11) triggered by a Section 7 change must be made in the same revision as well — this rule is added because the v1.2→v1.3 remediation found two cases (F‑001, F‑002) where a Section 7 requirement's intent had outrun what Section 11 could actually store. |
| Revision history | v1.0 — initial draft from Source audit. v1.1 — editorial pass (Chicago-format pagination; no requirement-level content changes tracked). v1.2 — added the Recurring Transaction Rules (weekday-based) feature: new BR‑11, new FR‑REC requirement group, new RecurringRule entity, new SCR‑10 screen, new FR‑ERR‑007/008, new FR‑BKP‑009, new test cases TC‑16–TC‑20, updated Feature Catalogue, Release Plan, Traceability Matrix, and Section 18 decision register (items 16–19). **v1.3 — full remediation of the external Forensic PRD/SRS Review of v1.2 (26 findings, F‑001–F‑026). Resolves the FR‑REC‑002/003/007 pending-vs-confirmed contradiction (new Transaction.status field, new FR‑REC‑015/016); adds RecurringRule pause-period history (new RecurringRulePausePeriod entity) so FR‑REC‑006 is implementable across multiple pause/resume cycles; defines passcode attempt-counter persistence and lockout-delay duration (FR‑SEC‑005 updated); adds a forgot-passcode/lockout-recovery flow (new FR‑SEC‑009, new SCR‑11, new UC‑17); adds an MVP accessibility baseline (new NFR‑07); adds app-store privacy-disclosure requirements (new FR‑SET‑009); adds duplicate-submission protection (new FR‑ERR‑009); defines atomic Transfer-edit behavior (new FR‑TRN‑013); defines arithmetic-expression validation and a rounding rule (FR‑ERR‑001 updated, new BR‑12); resolves duplicate-of-recurring behavior (new FR‑TRN‑014), archived-entity picker visibility (new FR‑ACC‑009/FR‑CAT‑007), restore-time referential-integrity validation (new FR‑BKP‑011), storage-exhaustion handling (new FR‑ERR‑010), PDF treatment of Transfers/recurring transactions (new FR‑PDF‑005), and backward-compatible backup restoration formalized as a normative requirement (new FR‑BKP‑010); replaces the subjective "no more than one perceptible UI stutter" bar with measurable thresholds (NFR‑03 rewritten); adds Given/When/Then acceptance criteria to every Critical/High finding and every P0/P1 requirement with real ambiguity that previously lacked one (BR‑11/FR‑ACC‑006/FR‑CAT‑004 interaction, FR‑ERR‑004, FR‑BKP‑005/006, FR‑TRN‑010, and all new v1.3 requirements); adds Owner and Resolve-By columns to every decision in Section 18/18a/18b; adds an MVP Release-Gate Checklist (Section 16.1); adds 16 new test cases (TC‑23–TC‑38); corrects the Final Audit's overstated Given/When/Then coverage claim and the RecurringRule field-naming inconsistency (isArchived-source-derived → isArchivedSource); clarifies that "Priority" on a Future-enhancement/Out-of-scope item ranks it within its future phase, not MVP. See Section 18b for the full AUD‑19…AUD‑35 gap-resolution log and the companion v1.2-to-v1.3 Change Log for a section-by-section, finding-by-finding index.** |


## 2. Product Vision, Objectives, Scope, Constraints, MVP, Future Scope, Out-of-Scope

**Vision** (Assumption, unchanged): Kwartracker is a private, offline-first personal finance tracker for people who want full manual control over categorizing and reviewing their own income and expenses, without a mandatory account, cloud sync, or subscription.

**Objectives** (Proposed decision — upgraded from Assumption in v1.3; see AUD‑34/decision #34; wording made measurable per Finding F‑018, intent otherwise unchanged):
- **O1:** A returning user can log a simple Income or Expense transaction (existing account and category, no note) in 3 taps or fewer from the Records screen, measured from tapping the floating "+" button to the transaction appearing in the list.
- **O2:** A user can determine their total spend and their single largest spending category for the current month within 2 screen views (Records summary header, then Analysis Overview) without needing to compute anything by hand.
- **O3:** Keep all financial data on-device, with the user in control of backup/restore; no financial data leaves the device except via explicit user-initiated export/backup, and the user always has a way back into their own data even if they forget their passcode (see FR‑SEC‑009, added in v1.3 specifically to keep this objective true under a failure condition the v1.2 document had not addressed).
- **O4:** Reduce the friction of logging *predictable, repeating* transactions, without weakening O2/O3 — a recurring rule must never silently distort totals, and its data must travel with backup/restore exactly like manual data. **v1.3 note:** this objective is now backed by an explicit, testable mechanism (the pending/confirmed occurrence model, FR‑REC‑002/015/016) rather than by unqualified intent alone — see AUD‑19.

**In-scope for MVP** (Confirmed features, scoped by Section 18/18a/18b decisions): Records (transaction log), Income/Expense/Transfer entry (including atomic Transfer edit, v1.3), Accounts, Categories, one Budget view, one Analysis chart (donut/overview), backup/restore (replace semantics, with referential-integrity validation, v1.3), PDF export (with Transfer/recurring representation, v1.3), passcode + optional biometric unlock + forgot-passcode/lockout recovery (v1.3), basic preferences, daily reminder notification, an MVP accessibility baseline (v1.3), weekday-based Recurring Transaction Rules in "on app open" firing mode with an explicit pending/confirmed occurrence model (v1.2 feature, data model completed in v1.3).

**Deferred to post-MVP** (Future enhancements): Expense Flow line chart, account-contribution bar chart, CSV/XLSX export, extended 3/6/12-month analysis views, home-screen widget, premium icon pack, additional themes, Free/Pro entitlement, search/filter, budget rollover, multi-currency, backup merge semantics, Background firing mode for recurring rules, full escalating passcode-lockout hardening beyond the MVP fixed delay (FR‑SEC‑005), a formally certified accessibility conformance level beyond the MVP baseline (NFR‑07 — see Open Question OQ‑02 in the Unresolved Decision Register).

**Out of scope** (per Section 18/18a/18b decisions): Server sync, multi-device sync, collaborative/shared budgets, bank account linking, any network dependency for core logging.

**Constraints** (Confirmed unless noted): Offline-first: core logging must work with no network connection (Confirmed). Built on React Native + Expo (Confirmed). Local storage only; no backend service exists or is planned for MVP (Assumption, consistent with Source). Recurring-rule catch-up runs entirely on-device against the existing SQLite layer in MVP; it introduces no new dependency and no network call (Proposed decision, v1.2). **The forgot-passcode/lockout-recovery flow (FR‑SEC‑009, v1.3) must not require any network call or external account, consistent with the offline-first constraint — recovery is local-data-loss-and-restore-from-backup, not credential reset via a server (Proposed decision, AUD‑22).**


## 3. Personas and Use Cases

**Personas** (Assumption, unchanged): P1 — Daily cash tracker: logs small daily cash and e-wallet spends, checks the monthly total often, budgets by category. P2 — Multi-account professional: splits spending across a card, a wallet, and savings. P3 — Irregular-income earner: logs income unevenly, wants a clear net picture.

**Use cases:**

| ID | Use case | Primary actor | Related screens |
|---|---|---|---|
| UC‑01 | Add an income or expense transaction | Any | SCR‑05, SCR‑01 |
| UC‑02 | Add a transfer between two accounts | P2 | SCR‑05, SCR‑06 |
| UC‑03 | Edit or delete an existing transaction | Any | SCR‑01, SCR‑05 |
| UC‑04 | Create, edit, or archive an account | P2 | SCR‑06 |
| UC‑05 | Create, edit, or archive a category | Any | SCR‑07 |
| UC‑06 | Set and monitor a monthly category budget | P1 | SCR‑04 |
| UC‑07 | Review spending via the Analysis overview chart | Any | SCR‑02 |
| UC‑08 | Back up all data to a file | Any | SCR‑08 |
| UC‑09 | Restore data from a backup file | Any | SCR‑08 |
| UC‑10 | Export records as a PDF | Any | SCR‑08, SCR‑09 |
| UC‑11 | Lock/unlock the app with a passcode or biometrics | Any | SCR‑09, SCR‑11 |
| UC‑12 | Configure currency, decimal, and notification preferences | Any | SCR‑09 |
| UC‑13 | Receive a daily reminder to log expenses | P1 | (system) |
| UC‑14 | Define a weekday-based recurring transaction rule | P1, P2 | SCR‑05, SCR‑10 |
| UC‑15 | Review and confirm/skip/edit missed recurring occurrences on app open | Any | SCR‑10 |
| UC‑16 | Pause, resume, edit, or delete a recurring rule | Any | SCR‑10 |
| **UC‑17 (new, v1.3)** | **Recover app access after forgetting a passcode, via Delete & Reset and (optionally) restoring a backup file** | **Any** | **SCR‑11, SCR‑08** |

## 4. Feature Catalogue

| Feature | Source status | MVP? | Notes / Decision ref |
|---|---|---|---|
| Customizable categories (icons, titles) | Confirmed | Yes | Unlimited claim — AUD‑06 |
| Custom currency sign/position/decimals | Confirmed | Yes | Single-currency — AUD‑07 |
| Budget planner (monthly, per category) | Confirmed | Yes | Non-rolling — AUD‑12 |
| Analysis — Expense Overview (donut) | Confirmed | Yes | |
| Analysis — Expense Flow (line + calendar grid) | Confirmed | Future | Deferred to reduce MVP chart-library scope |
| Multiple accounts, unlimited | Confirmed | Yes | Soft QA target — AUD‑06 |
| Home-screen widget (view + log) | Confirmed (as claim) | Future, reduced | Android-only, read-only in first version — AUD‑05 |
| Local backup / restore | Confirmed | Yes | Replace-only — AUD‑08; referential-integrity validated — AUD‑32 (v1.3) |
| Export "worksheets" to print | Confirmed (ambiguous format) | PDF only in MVP | CSV/XLSX — Future |
| Offline functionality | Confirmed | Yes | |
| Duplicate existing record | Confirmed | Yes | Recurring-origin clearing rule — AUD‑28 (v1.3) |
| Notes shown in record list | Confirmed | Yes | Preference toggle |
| Ignore inactive accounts/categories | Confirmed | Yes | Implemented as archive — AUD‑10; picker visibility — AUD‑29 (v1.3) |
| Premium icon library | Confirmed | Future | Tied to Free/Pro — AUD‑03 |
| Multiple themes | Confirmed | Future | Tied to Free/Pro — AUD‑03 |
| Passcode protection | Confirmed | Yes | Gate only, not encryption — AUD‑04; recovery flow — AUD‑22 (v1.3) |
| Biometric unlock | Not addressed | Yes (Proposed) | AUD‑04 |
| Smart input on widget | Confirmed (as claim) | Out of scope for MVP | AUD‑05 |
| Extended 3/6/12-month views | Confirmed | Future | |
| PDF export | Confirmed | Yes | Transfer/recurring representation — AUD‑33 (v1.3) |
| Free/Pro entitlement | Confirmed | Out of scope | AUD‑03 |
| Daily reminder notification | Confirmed | Yes | |
| Crash/usage statistics opt-in | Confirmed | Yes (default OFF — Proposed) | Store-disclosure metadata — AUD‑24 (v1.3) |
| Search / filter records | Not addressed | Future | AUD‑14 |
| Recurring transaction rules (weekday-based, "on app open") | Not addressed in Source; new in v1.2 Addendum | Yes | FR‑REC group; AUD‑15–18; pending/confirmed model completed — AUD‑19/20 (v1.3) |
| Recurring transaction rules — Background firing mode | Not addressed | Future | FR‑REC‑012 |
| **Forgot-passcode / lockout recovery (new, v1.3)** | **Not addressed in Source; new in v1.3, driven by Forensic Review F‑004** | **Yes** | **FR‑SEC‑009; AUD‑22** |
| **MVP accessibility baseline (new, v1.3)** | **Not addressed in Source; new in v1.3, driven by Forensic Review F‑005** | **Yes** | **NFR‑07; AUD‑23** |


## 5. Business Rules

| ID | Rule | Status | Ref |
|---|---|---|---|
| BR‑01 | A transaction is exactly one of Income, Expense, or Transfer. | Confirmed | Source |
| BR‑02 | A Transfer moves value between exactly two distinct accounts and is excluded from Income/Expense totals everywhere they are aggregated. | Proposed decision | AUD‑09 |
| BR‑03 | An account's balance equals its opening balance plus the signed sum of all **confirmed**, non-archived transactions referencing it. **("confirmed" qualifier added in v1.3 — see AUD‑19; a `pending` or `skipped` recurring occurrence is not yet part of this sum.)** | Proposed decision | AUD‑11; **AUD‑19 (v1.3)** |
| BR‑04 | A category or account with one or more referencing transactions cannot be hard-deleted; it can only be archived. | Proposed decision | AUD‑10 |
| BR‑05 | A budget applies to exactly one category and one calendar month; it does not roll over unspent amounts. | Proposed decision | AUD‑12 |
| BR‑06 | All monetary values are stored as integers in the currency's minor unit, never as floating-point. **Enforcement mechanism for non-integer arithmetic results is BR‑12 (v1.3).** | Proposed decision | Assumption elevated given severity |
| BR‑07 | Currency sign, position, and decimal-place settings are global to the app, not per-account. | Approved decision | AUD‑07 |
| BR‑08 | Restoring a backup replaces all existing local data after explicit user confirmation, subject to referential-integrity validation before the replace is committed (FR‑BKP‑011, v1.3). | Proposed decision | AUD‑08 |
| BR‑09 | The app functions fully for all logging, editing, and viewing operations with no network connection. | Confirmed | Source |
| BR‑10 | A backup file includes a schema-version identifier. | Proposed decision | AUD‑08 |
| BR‑11 | An account or category referenced by an active *or paused* RecurringRule cannot be hard-deleted; it can only be archived. Archiving an account or category referenced by an active rule auto-pauses that rule (see FR‑REC‑008). | Proposed decision | AUD‑16, closes a gap BR‑04 left open for the RecurringRule entity |
| **BR‑12 (new, v1.3)** | **The result of any arithmetic keypad expression (FR‑TRN‑003) that cannot be represented exactly in the currency's minor unit shall be rounded using round-half-up before being stored; the app shall never persist, nor subsequently re-round, a value at read time. This is the concrete enforcement mechanism BR‑06 requires but did not itself specify.** | **Proposed decision** | **AUD‑27 (resolves Forensic Review F‑009)** |

## 6. Information Architecture & UI/UX

**Screens** (Confirmed, from Source, plus SCR‑10 new in v1.2 and SCR‑11 new in v1.3):

| ID | Screen | Purpose |
|---|---|---|
| SCR‑01 | Records | Chronological, date-grouped transaction list; month navigation; summary header. **Shows only `confirmed` transactions (v1.3) — a `pending` recurring occurrence is not listed here until acted on in SCR‑10's review batch; a `skipped` occurrence is never listed here.** |
| SCR‑02 | Analysis — Expense Overview | Donut chart + ranked category legend |
| SCR‑03 | Analysis — Expense Flow | Line graph + daily calendar grid (Future) |
| SCR‑04 | Budgets | Monthly category budgets, progress bars, over-limit warning; over-limit warning conveyed by a non-color indicator as well as color (NFR‑07, v1.3) |
| SCR‑05 | Input/Transaction | Income/Expense/Transfer entry with keypad; also the creation surface for a recurring rule via a "Repeat" toggle (v1.2); Save action is debounced against duplicate submission (FR‑ERR‑009, v1.3) |
| SCR‑06 | Accounts | Account list, balances, add/edit; archived accounts excluded from the active-entity picker used elsewhere (FR‑ACC‑009, v1.3) |
| SCR‑07 | Categories | Income/expense category lists, add/edit; archived categories excluded from the active-entity picker used elsewhere (FR‑CAT‑007, v1.3) |
| SCR‑08 | Sidebar | Preferences entry, Export/Backup/Restore/Reset, Pro upsell (descoped), Help/Feedback; adds an entry point to SCR‑10 (v1.2) |
| SCR‑09 | Preferences | Appearance, Security, Notification, About settings |
| SCR‑10 | Recurring Rules | List of the user's recurring rules with amount, weekdays, account/category, next expected date, a pending-review-count badge (v1.3), and Pause/Edit/Delete actions; also hosts the missed-occurrence review batch (FR‑REC‑003) |
| **SCR‑11 (new, v1.3)** | **Lock Screen** | **The passcode/biometric entry gate (previously implied only architecturally via the `LockGate` wrapper in §10.1, not documented as its own screen). Now hosts the "Forgot passcode?" affordance (FR‑SEC‑009) leading to Delete & Reset.** |

**Navigation model** (Confirmed + v1.2/v1.3 additions): bottom tab bar linking Records, Analysis, Budgets, Accounts, Categories; a floating "+" button on Records opens Input; a hamburger/sidebar exposes Preferences, data-management actions, and Recurring Rules. The Lock Screen (SCR‑11) is a gate in front of the entire navigator, not a tab destination.

**UX note** (Assumption): first-launch state (zero accounts, zero categories) is not addressed in the Source and must be designed — see FR‑NAV‑004.

**Accessibility note (new, v1.3, Proposed decision — AUD‑23):** every screen listed above is in scope for the NFR‑07 MVP accessibility baseline (screen-reader labels on icon-only controls, minimum touch-target size, dynamic-type support, non-color state indicators, contrast target). This is stated once here rather than repeated on every screen row.


## 7. Functional Requirements

Each requirement is defined once here. Confirmed/Approved items use "shall" and carry full metadata below the group table. Assumption/Proposed/Open items are listed in the same table for traceability but are explicitly not normative.

Verification methods: Test (automated/manual test case), Review (design/code review), Demo (manual walkthrough), Inspection (static check).

**Two preamble clarifications added in v1.3 (resolve Forensic Review F‑022 and F‑024, no product-behavior change):** (1) Priority (P0–P3) on an item whose Status is "Future enhancement" or "Out of scope" ranks that item within its own future phase's backlog (see Section 10.6/16), not within the current MVP — it is never a signal that the item is scheduled for the current release. (2) A small number of rows below are phrased "QA shall verify…" rather than "the app shall…" — these are testing-process obligations, not product behavior, and are tagged "(QA target only)" in their Status column to keep them visually distinct from normative product requirements while remaining in the same table for traceability.

### FR‑TRN — Transactions

| ID | Statement | Priority | Status | Ref | Verification |
|---|---|---|---|---|---|
| FR‑TRN‑001 | The app shall allow a user to create a transaction of type Income, Expense, or Transfer. | P0 | Confirmed | Source | Test |
| FR‑TRN‑002 | The app shall require an Account and, for Income/Expense, a Category on every transaction. | P0 | Confirmed | Source | Test |
| FR‑TRN‑003 | The app shall provide a numeric keypad with +, −, ×, ÷ operators for amount entry. A malformed expression (a trailing operator, division by zero, or any other non-evaluable input) shall be rejected before the transaction can be saved, per FR‑ERR‑001. | P1 | Confirmed | Source | Test |
| FR‑TRN‑004 | The app shall allow an optional free-text note on a transaction. | P1 | Confirmed | Source | Test |
| FR‑TRN‑005 | The app shall allow the user to manually set the date and time of a transaction. | P0 | Confirmed | Source | Test |
| FR‑TRN‑006 | The app shall allow duplicating an existing transaction as a starting point for a new one. Duplicating a transaction shall always clear `recurringRuleId`, `occurrenceDate`, and `status` on the new row (the duplicate is always created as an ordinary, manually-entered, `confirmed` transaction), regardless of whether the source row originated from a recurring rule — see FR‑TRN‑014. | P2 | Confirmed | Source | Test |
| FR‑TRN‑007 | A Transfer transaction shall record a source account and a destination account and shall not be assigned a category. | P0 | Proposed decision | AUD‑09 / BR‑02 | Test |
| FR‑TRN‑008 | Transfers shall be excluded from all Income/Expense aggregates (Records summary, Analysis, Budgets). | P0 | Proposed decision | AUD‑09 / BR‑02 | Test |
| FR‑TRN‑009 | The app shall allow editing and deleting an existing transaction, with account balances recalculated accordingly. Editing a Transfer specifically is governed by FR‑TRN‑013, not by this general rule alone. | P0 | Assumption | Required for basic usability | Test |
| FR‑TRN‑010 | Deleting one side of a Transfer shall reverse both accounts' balance effects atomically, in a single database transaction, such that no intermediate state is ever visible where only one account reflects the deletion. | P0 | Proposed decision | AUD‑09 | Test |
| FR‑TRN‑011 | Search and filtering of transactions by account, category, or keyword. | P3 | Future enhancement | AUD‑14 | — |
| ~~FR‑TRN‑012~~ | ~~Recurring/scheduled transactions.~~ Superseded in v1.2 — see the FR‑REC group below. | P0 | Proposed decision (superseded placeholder) | AUD‑14 → AUD‑15–18 | — |
| **FR‑TRN‑013 (new, v1.3)** | **Editing a Transfer's amount, source account, or destination account shall apply atomically across both affected accounts (implemented as an atomic reverse-then-reapply within a single database transaction, or an equivalent atomic update), such that no intermediate state is ever visible where only one account reflects the edit.** | **P0** | **Proposed decision** | **AUD‑26 (resolves Forensic Review F‑008)** | **Test** |
| **FR‑TRN‑014 (new, v1.3)** | **A transaction's `recurringRuleId`, `occurrenceDate`, and `status` fields are never copied by FR‑TRN‑006's duplicate action; see FR‑TRN‑006 for the normative statement. This row exists for traceability from the Data Model (§11) back to the requirement that constrains it.** | **P2** | **Proposed decision** | **AUD‑28 (resolves Forensic Review F‑010)** | **Test** |

**Acceptance criteria — FR‑TRN‑007/008 (major, P0):** Given a user has a Card account and a Savings account, when they create a ₱1,000 Transfer from Card to Savings, then Card's balance decreases by ₱1,000, Savings increases by ₱1,000, and the Records summary header's Total Expense and Total Income are unchanged by this entry.

**Acceptance criteria — FR‑TRN‑010 (major, P0; new in v1.3, resolves Forensic Review F‑013):** Given a ₱1,000 Transfer exists between Card and Savings, when the user deletes it, then both accounts' balances revert in the same atomic operation, and if the deletion is interrupted (e.g., app killed) before it commits, neither account's balance reflects the deletion (both-or-nothing, never one-sided).

**Acceptance criteria — FR‑TRN‑013 (major, P0; new in v1.3):** Given a ₱1,000 Transfer from Card to Savings, when the user edits the amount to ₱1,500, then Card's balance decreases by an additional ₱500 and Savings' balance increases by an additional ₱500 as a single atomic operation, with no observable intermediate state; when the user instead changes the destination account from Savings to Wallet, then Savings' balance reverts by ₱1,000 and Wallet's balance increases by ₱1,000 atomically.

### FR‑REC — Recurring Transaction Rules (weekday-based) *(v1.2; pending/confirmed model and pause-period history completed in v1.3)*

Source: *Feature: Recurring Transaction Rules (weekday-based) — Final Spec.md* (the "Recurring Rules Addendum"), Claude-authored, not a Source claim. All items below are Proposed decisions pending PO sign-off unless noted. **v1.3 note:** FR‑REC‑002, FR‑REC‑003, FR‑REC‑007, and FR‑REC‑009 are revised below to resolve a genuine internal contradiction the external Forensic Review identified as its top finding (F‑001) — the v1.2 wording implied a generated occurrence was simultaneously an unconditional, immediately-real Transaction row (FR‑REC‑002) and a not-yet-real, awaiting-confirmation item (FR‑REC‑003/007). v1.3 resolves this with an explicit three-state model.

| ID | Statement | Priority | Status | Ref | Verification |
|---|---|---|---|---|---|
| FR‑REC‑001 | The app shall allow a user to define a RecurringRule with the same fields as a manual transaction (type, amount, account, destination account if Transfer, category if Income/Expense, optional note) plus a multi-select set of weekdays, a start date (defaulting to rule-creation date), an optional end date, a firing mode, and a "confirm before adding" toggle (defaulting ON). | P1 | Proposed decision | Addendum §Inputs | Test |
| FR‑REC‑002 | **(Revised, v1.3 — resolves Forensic Review F‑001.)** On every app open, the app shall check active, non-paused rules against the device's local calendar date and generate any due-but-not-yet-created occurrences as Transaction rows tagged with `recurringRuleId` and `occurrenceDate`, subject to a database-level unique constraint on (recurringRuleId, occurrenceDate). A generated occurrence's initial `status` is `pending` if the rule's "confirm before adding" toggle is ON (the default), or `confirmed` directly if the toggle is OFF (per FR‑REC‑007). A `pending` occurrence is not yet a "real" transaction from the user's perspective — see FR‑REC‑015 for what that means concretely. | P0 | Proposed decision | Addendum; AUD‑13 (local-day rule); **AUD‑19 (v1.3)** | Test |
| FR‑REC‑003 | Multiple missed occurrences discovered in a single on-open check shall be presented as one batch review (not one dialog per occurrence) on SCR‑10, offering confirm-all, confirm-individually, edit-amount-then-confirm, and skip-one actions. Confirming (by any of the first three actions) sets the occurrence's `status` from `pending` to `confirmed`. Skipping sets it from `pending` to `skipped` per FR‑REC‑016 — it does not delete the row. | P1 | Proposed decision | Addendum §Behavior; **AUD‑19 (v1.3)** | Test, Demo |
| FR‑REC‑004 | Catch-up generation for a single rule shall be capped at the 30 most recent missed occurrences; any occurrences older than that shall be skipped without being generated, and the review batch shall display a one-line notice that older missed entries were permanently skipped and will not be generated later. | P0 | Proposed decision | AUD‑15 (gap resolution) | Test |
| FR‑REC‑005 | A user skipping one occurrence in the review batch (setting its `status` to `skipped` per FR‑REC‑016) shall affect only that occurrence; the rule shall continue generating future occurrences on its normal schedule. | P1 | Proposed decision | Addendum §Behavior | Test |
| FR‑REC‑006 | Pausing a rule shall stop occurrence generation immediately and shall record the pause's start time. Occurrences that fall within any of a rule's paused windows (there may be more than one over a rule's lifetime — see the RecurringRulePausePeriod entity, §11) shall never be generated, including after the rule is later resumed — a paused period is not backfilled, no matter how many times the rule has been paused and resumed before. | P0 | Proposed decision | AUD‑17 (gap resolution); **AUD‑20 (v1.3, multi-cycle pause history)** | Test |
| FR‑REC‑007 | When a rule's "confirm before adding" toggle is OFF, the app shall generate occurrences directly in `confirmed` status (skipping the `pending` state and the review batch entirely) and shall show a passive, dismissible post-hoc summary (e.g., "Added 3 transportation entries for missed days") rather than adding rows with no visible trail. | P2 | Proposed decision | Addendum §Behavior; **AUD‑19 (v1.3)** | Test, Demo |
| FR‑REC‑008 | Archiving an account or category referenced by an active rule shall automatically pause that rule (recording the pause start time per FR‑REC‑006) and display a visible notice to the user. Un-archiving the account or category shall NOT automatically resume the rule; resuming requires an explicit user action on SCR‑10. | P0 | Proposed decision | AUD‑18 (gap resolution); BR‑11 | Test |
| FR‑REC‑009 | Editing a rule shall affect only future occurrences. Transactions already generated by the rule (in any status) remain independent, editable/deletable rows (per FR‑TRN‑009) and are never retroactively rewritten. A `pending` occurrence already in the review queue shall retain the amount it was generated with even if the rule is edited while it is queued. | P1 | Proposed decision | Addendum §Behavior | Test |
| FR‑REC‑010 | The app shall provide a Recurring Rules screen (SCR‑10) listing each rule's amount, weekdays, account/category, next expected date, and a badge showing the count of currently-`pending` occurrences awaiting review, with Pause, Edit, and Delete actions. Delete is permanent for the rule itself but shall never delete transactions the rule already generated (in any status). | P1 | Proposed decision | Addendum §Recurring Rules screen | Test, Demo |
| FR‑REC‑011 | QA shall verify acceptable on-open check performance up to an internal soft target of 50 active rules, with a worst-case single-pass catch-up of 30 missed occurrences per rule (up to 1,500 generated rows in one on-open pass), meeting the measurable thresholds in NFR‑03 (revised, v1.3). | P2 | Proposed decision (QA target only) | Addendum; AUD‑15; **AUD‑30 (v1.3)** | Test |
| FR‑REC‑012 | Background firing mode (generation without the user opening the app) using expo-task-manager / expo-background-fetch. iOS execution is best-effort, not on a guaranteed schedule; UI copy must state this plainly. The on-open catch-up check (FR‑REC‑002) remains a silent fallback under background mode for whatever the background task missed. | P2 | Future enhancement (Phase 2) | Addendum §Firing mode; same Expo-Go threshold as AUD‑05 | — |
| FR‑REC‑013 | The app shall reject hard-deletion of an account or category referenced by an active or paused RecurringRule; the UI shall offer archive instead, consistent with FR‑ACC‑006/FR‑CAT‑004. | P0 | Proposed decision | BR‑11 / AUD‑16 | Test |
| FR‑REC‑014 | A `confirmed` auto-generated transaction shall display a small recurring-icon tag in the Records list so a user can distinguish it from manually entered transactions, without requiring full search/filter (FR‑TRN‑011, still Future). `pending` and `skipped` occurrences never appear in the Records list at all (see FR‑REC‑015/016), so this tag applies only once an occurrence reaches `confirmed` status. | P2 | Proposed decision | Addendum §Visual traceability; **AUD‑19 (v1.3)** | Demo |
| **FR‑REC‑015 (new, v1.3)** | **A `pending` recurring occurrence shall be excluded from every aggregate and view that a `confirmed` transaction would otherwise appear in: account balance (BR‑03), Budget "Total Spent" (FR‑BUD‑004), Analysis totals (FR‑ANA‑003), the Records list (SCR‑01), and PDF export (FR‑PDF‑001). It becomes visible in and counted by all of these the instant, and only the instant, its `status` changes to `confirmed`.** | **P0** | **Proposed decision** | **AUD‑19 (resolves Forensic Review F‑001)** | **Test** |
| **FR‑REC‑016 (new, v1.3)** | **A `skipped` recurring occurrence is retained in the Transaction table (not hard-deleted) solely so the FR‑REC‑002 unique constraint on (recurringRuleId, occurrenceDate) prevents that same missed date from being regenerated on a later on-open check. A `skipped` row is excluded from every aggregate and view listed in FR‑REC‑015, permanently, and is never shown to the user again after the review batch that skipped it closes.** | **P1** | **Proposed decision** | **AUD‑19 (resolves Forensic Review F‑001, defines "skip" precisely)** | **Test** |

**Acceptance criteria — FR‑REC‑002/004/006 (major, P0):** Given a user created a Mon–Fri ₱500 "Transportation" expense rule 50 days ago and has not opened the app since, when they open the app today, then the app generates at most the 30 most recent matching weekday occurrences as `pending` review items (not all ~36 elapsed weekdays), shows a notice that older missed occurrences were skipped, and — if the user paused the rule for any stretch of that window — generates zero occurrences for the paused dates even after this catch-up run.

**Acceptance criteria — FR‑REC‑002/015 (major, P0; new in v1.3, resolves Forensic Review F‑001):** Given a Mon–Fri ₱500 "Transportation" rule with "confirm before adding" ON generates 3 `pending` occurrences on app open, when the user immediately opens the Budgets screen without reviewing them, then the "Transportation" category's Total Spent does **not** include those 3 occurrences and the account balance does **not** reflect them; when the user then confirms all 3 in the SCR‑10 review batch, then Total Spent and the account balance update immediately to include them; when the user instead skips one of the 3, then that one occurrence's `status` becomes `skipped`, it never appears in Records or any total, and the on-open check never attempts to regenerate an occurrence for that same date again.

**Acceptance criteria — FR‑REC‑006 (major, P0; extended in v1.3 for multi-cycle pause, resolves Forensic Review F‑002):** Given a rule is paused on day 10 and resumed on day 20, and paused again on day 30 and resumed on day 35, when the on-open catch-up runs on day 40, then no occurrence is generated for days 10–20 or days 30–35 even though some of those dates fall within the 30-most-recent-missed window, and occurrences for the unpaused days (e.g., 21–29 and 36–40) are generated normally.

**Acceptance criteria — FR‑REC‑008 (major, P0):** Given a rule references the "Transportation" category, when the user archives that category, then the rule's isPaused flag is set automatically (recording the pause start time), a visible notice is shown, and un-archiving the category later leaves the rule paused until the user manually resumes it from SCR‑10.


### FR‑ACC — Accounts

| ID | Statement | Priority | Status | Ref | Verification |
|---|---|---|---|---|---|
| FR‑ACC‑001 | The app shall allow creating an unlimited number of accounts, per Source claim. | P0 | Confirmed | Source | Test |
| FR‑ACC‑002 | The app shall display each account's current balance, computed per BR‑03 (confirmed transactions only, v1.3). | P0 | Proposed decision | AUD‑11 | Test |
| FR‑ACC‑003 | The app shall display an aggregated "All Accounts" balance, total expense, and total income. | P0 | Confirmed | Source | Test |
| FR‑ACC‑004 | The app shall allow editing an account's name, icon, and opening balance. | P1 | Assumption | Standard CRUD | Test |
| FR‑ACC‑005 | The app shall allow archiving ("ignoring") an account instead of deleting it when it has referencing transactions. | P0 | Proposed decision | AUD‑10 / BR‑04 | Test |
| FR‑ACC‑006 | The app shall reject hard-deletion of an account that has one or more referencing transactions (in any status) or one or more referencing active/paused recurring rules (v1.2). | P0 | Proposed decision | BR‑04; BR‑11 (v1.2) | Test |
| FR‑ACC‑007 | QA shall verify acceptable list performance up to the internal soft target of 500 accounts. | P2 | Proposed decision (QA target only) | AUD‑06 | Test |
| FR‑ACC‑008 | Per-account currency / multi-currency accounts. | — | Out of scope | AUD‑07 | — |
| **FR‑ACC‑009 (new, v1.3)** | **An archived account shall not appear in the entity picker for a new transaction, a new recurring rule, or when re-assigning an existing transaction's account. It shall remain visible, unchanged, and correctly rendered on any transaction or rule that already references it.** | **P1** | **Proposed decision** | **AUD‑29 (resolves Forensic Review F‑011; formalizes behavior TC‑08 already tested without a written requirement)** | **Test** |

**Acceptance criteria — FR‑ACC‑006 (major, P0; new in v1.3, resolves Forensic Review F‑013):** Given an account has one confirmed transaction and is also referenced by a paused RecurringRule with zero transactions generated yet, when the user attempts to hard-delete it, then the app rejects the deletion and offers Archive instead, citing both the referencing transaction and the referencing rule in its message.

**Acceptance criteria — FR‑ACC‑009 (P1; new in v1.3):** Given "Old Wallet" is archived and has 5 historical transactions, when the user opens the account picker on the Input screen, then "Old Wallet" does not appear in the list; when the user views one of its 5 historical transactions, then "Old Wallet" is still displayed correctly as that transaction's account.

### FR‑CAT — Categories

| ID | Statement | Priority | Status | Ref | Verification |
|---|---|---|---|---|---|
| FR‑CAT‑001 | The app shall allow creating an unlimited number of income and expense categories with a chosen icon and title. | P0 | Confirmed | Source | Test |
| FR‑CAT‑002 | The app shall separate categories into Income and Expense lists. | P0 | Confirmed | Source | Test |
| FR‑CAT‑003 | The app shall allow editing a category's icon and title. | P1 | Assumption | Implied by options menu | Test |
| FR‑CAT‑004 | The app shall allow archiving ("ignoring") a category instead of deleting it when it has referencing transactions (in any status) or referencing active/paused recurring rules (v1.2), and shall reject hard-deletion in that case. | P0 | Proposed decision | AUD‑10 / BR‑04; BR‑11 (v1.2) | Test |
| FR‑CAT‑005 | The app shall seed a default starter set of common categories on first launch. | P1 | Assumption | Avoids empty first-run state | Demo |
| FR‑CAT‑006 | QA shall verify acceptable list performance up to the internal soft target of 200 categories. | P2 | Proposed decision (QA target only) | AUD‑06 | Test |
| **FR‑CAT‑007 (new, v1.3)** | **An archived category shall not appear in the entity picker for a new transaction, a new recurring rule, or when re-assigning an existing transaction's category. It shall remain visible, unchanged, and correctly rendered on any transaction or rule that already references it.** | **P1** | **Proposed decision** | **AUD‑29 (resolves Forensic Review F‑011)** | **Test** |

**Acceptance criteria — FR‑CAT‑004 (major, P0; new in v1.3, resolves Forensic Review F‑013):** Given a category is referenced by both a confirmed transaction and an active RecurringRule, when the user attempts to hard-delete it, then the app rejects the deletion and offers Archive instead.

### FR‑BUD — Budgets

| ID | Statement | Priority | Status | Ref | Verification |
|---|---|---|---|---|---|
| FR‑BUD‑001 | The app shall allow setting a spending limit for a category for the current month. | P0 | Confirmed | Source | Test |
| FR‑BUD‑002 | The app shall display Total Budget and Total Spent for the selected month. | P0 | Confirmed | Source | Test |
| FR‑BUD‑003 | The app shall show a progress indicator per budgeted category (limit, spent, remaining). | P0 | Confirmed | Source | Test |
| FR‑BUD‑004 | The app shall display a visible warning when a category's spending exceeds its budget, conveyed by both color and a non-color signal (icon or text label — NFR‑07, v1.3), not by color alone. | P1 | Confirmed | Source; **NFR‑07 (v1.3)** | Test |
| FR‑BUD‑005 | The app shall list categories not yet budgeted for the month with an action to set a budget. | P1 | Confirmed | Source | Test |
| FR‑BUD‑006 | Budgets shall not roll over unspent amounts to the following month. | P1 | Proposed decision | AUD‑12 / BR‑05 | Test |
| FR‑BUD‑007 | A budget change made mid-month shall apply, unprorated, for the remainder of the current month. | P2 | Proposed decision | AUD‑12 | Test |
| FR‑BUD‑008 | Weekly or yearly budget periods. | P3 | Future enhancement | AUD‑12 | — |

**Acceptance criteria — FR‑BUD‑004 (major, P1; revised in v1.3, resolves part of Forensic Review F‑001):** Given a ₱2,000 monthly budget on "Bills" and ₱2,300 already logged in **confirmed** transactions, when the user opens Budgets, then Bills shows a non-color "Limit exceeded" indicator and ₱2,300 against the ₱2,000 limit. A `confirmed` auto-generated recurring transaction counts toward this total identically to a manual entry; a `pending` or `skipped` recurring occurrence counts toward nothing, per FR‑REC‑015/016 — a recurring rule creates no separate accounting path once an occurrence is confirmed, and no accounting effect at all while pending or skipped.

### FR‑ANA — Analysis

| ID | Statement | Priority | Status | Ref | Verification |
|---|---|---|---|---|---|
| FR‑ANA‑001 | The app shall display an Expense Overview donut/pie chart for a selected date range. | P0 | Confirmed | Source | Test |
| FR‑ANA‑002 | The app shall list categories beneath the chart ranked by amount, with a progress bar and percentage of total. | P0 | Confirmed | Source | Test |
| FR‑ANA‑003 | The app shall show total expense and total income for the selected date range, computed from **confirmed** transactions only (v1.3 — excludes `pending`/`skipped` recurring occurrences per FR‑REC‑015/016). | P0 | Confirmed | Source; **AUD‑19 (v1.3)** | Test |
| FR‑ANA‑004 | The app shall allow selecting a custom date range for the analysis view. | P1 | Confirmed | Source | Test |
| FR‑ANA‑005 | Expense Flow line chart with tappable daily data points and calendar-style totals grid. | P2 | Future enhancement | Section 4 | — |
| FR‑ANA‑006 | Account-contribution bar chart. | P2 | Future enhancement | Feature list | — |


### FR‑BKP — Backup and Restore

| ID | Statement | Priority | Status | Ref | Verification |
|---|---|---|---|---|---|
| FR‑BKP‑001 | The app shall allow exporting all local data to a backup file. | P0 | Confirmed | Source | Test |
| FR‑BKP‑002 | The app shall allow restoring data from a previously exported backup file. | P0 | Confirmed | Source | Test |
| FR‑BKP‑003 | A backup file shall include a schema-version field. | P0 | Proposed decision | AUD‑08 / BR‑10 | Inspection |
| FR‑BKP‑004 | Restoring a backup shall replace all existing local data, gated by an explicit double-confirmation prompt, and subject to the referential-integrity validation in FR‑BKP‑011 (v1.3) completing successfully first. | P0 | Proposed decision | AUD‑08 / BR‑08 | Test |
| FR‑BKP‑005 | The app shall reject a restore attempt on a malformed or unreadable backup file and leave existing data untouched. | P0 | Assumption | Standard failure-safety expectation | Test |
| FR‑BKP‑006 | The app shall reject a restore attempt from a backup with an incompatible (newer, unmigrated) schema version, with a clear message. A backup from an *older* schema version is handled by FR‑BKP‑010, not rejected. | P1 | Proposed decision | AUD‑08 | Test |
| FR‑BKP‑007 | Merge-on-restore (combine rather than replace). | P3 | Future enhancement | AUD‑08 | — |
| FR‑BKP‑008 | The app shall allow the "Delete & Reset" action to clear all app data, gated by explicit double-confirmation. This action is also reachable from the Lock Screen (SCR‑11) without first passing the passcode gate, specifically to support FR‑SEC‑009's recovery flow. | P1 | Confirmed | Source (Sidebar); **AUD‑22 (v1.3, lock-screen reachability)** | Test |
| FR‑BKP‑009 | The backup export shall include the RecurringRule table in full (including isPaused state and the RecurringRulePausePeriod history, v1.3) under the same schema-version and replace-all semantics as the rest of the data; a restore that omits or partially restores recurring rules or their pause history is a defect, not an accepted limitation. | P0 | Proposed decision | AUD‑16 (gap resolution, backup coverage) | Test |
| **FR‑BKP‑010 (new, v1.3)** | **Restoring a backup file from a schema version older than the current app's shall succeed, treating any table or field introduced in a later schema version (e.g., `recurring_rules`, `RecurringRulePausePeriod`, or `transactions.status`) as empty/default rather than failing the restore. This formalizes, as a normative requirement, behavior previously described only as a non-normative engineering note in §10.5.** | **P1** | **Proposed decision (formalizes already-accepted behavior; no new judgment call — see AUD‑31)** | **AUD‑31 (resolves Forensic Review F‑014); TC‑20** | **Test** |
| **FR‑BKP‑011 (new, v1.3)** | **Before committing a restore, the app shall validate that every foreign key in the backup file resolves within the same file (e.g., every transaction's `accountId`/`categoryId`/`recurringRuleId` exists in that file's Account/Category/RecurringRule tables). If validation fails, the app shall reject the entire restore with a clear message and leave existing data untouched, consistent with FR‑BKP‑005.** | **P0** | **Proposed decision** | **AUD‑32 (resolves Forensic Review F‑015)** | **Test** |

**Acceptance criteria — FR‑BKP‑004 (major, P0):** Given a user selects "Restore" and picks a valid backup file, when they confirm the destructive-action warning twice, then all current accounts, categories, transactions (of every status), budgets, and recurring rules (with full pause-period history, v1.3) are replaced with the backup's contents and the app reloads to reflect the restored state.

**Acceptance criteria — FR‑BKP‑005/006 (major, P0/P1; new in v1.3, resolves Forensic Review F‑013):** Given a backup file is truncated mid-write, when the user attempts to restore it, then the app rejects the restore, shows a clear "file could not be read" message, and every existing account, category, and transaction is unchanged; given a backup file's schema version is newer than the current app supports, when the user attempts to restore it, then the app rejects the restore with a message naming the incompatibility and existing data is unchanged.

**Acceptance criteria — FR‑BKP‑011 (major, P0; new in v1.3):** Given a backup file has the correct current schema version but contains a transaction whose `accountId` does not exist in that file's Account table, when the user attempts to restore it, then the app rejects the entire restore before touching any existing data, and shows a message indicating the file failed an integrity check.

### FR‑PDF — PDF Export

| ID | Statement | Priority | Status | Ref | Verification |
|---|---|---|---|---|---|
| FR‑PDF‑001 | The app shall generate a PDF export of **confirmed** transaction records for a selected period (v1.3 — excludes `pending`/`skipped` recurring occurrences, consistent with FR‑REC‑015/016). | P1 | Confirmed | Source; **AUD‑19 (v1.3)** | Test |
| FR‑PDF‑002 | The app shall allow sharing or saving the generated PDF via the OS share sheet. | P1 | Assumption | Standard mobile export pattern | Test |
| FR‑PDF‑003 | MVP export is PDF-only; spreadsheet format is deferred to Phase 2 (FR‑PDF‑004). | — | Proposed decision | Section 18 decision #13 | — |
| FR‑PDF‑004 | CSV/XLSX export. | P2 | Future enhancement | FR‑PDF‑003 | — |
| **FR‑PDF‑005 (new, v1.3)** | **A Transfer shall appear on the PDF export as a line item (clearly labeled as a Transfer, not an Income or Expense) but shall be excluded from the totals footer, mirroring its on-screen treatment (FR‑TRN‑008). A confirmed auto-generated recurring transaction shall carry the same recurring-origin text marker on the PDF that FR‑REC‑014 gives it on-screen.** | **P2** | **Proposed decision** | **AUD‑33 (resolves Forensic Review F‑017)** | **Test** |

**Acceptance criteria — FR‑PDF‑005 (P2; new in v1.3):** Given a selected period contains one Transfer and one confirmed recurring-generated Expense, when the PDF is generated, then the Transfer appears as a labeled line item excluded from the totals footer, and the recurring Expense carries a text marker (e.g., "(recurring)") next to its description.

### FR‑SEC — Security

| ID | Statement | Priority | Status | Ref | Verification |
|---|---|---|---|---|---|
| FR‑SEC‑001 | The app shall allow setting a passcode required to open the app, entered on the Lock Screen (SCR‑11, v1.3). | P0 | Confirmed | Source | Test |
| FR‑SEC‑002 | The passcode shall be stored as a salted hash in secure device storage (`expo-secure-store`), never in plaintext or AsyncStorage, using a key-derivation function with a work factor no weaker than PBKDF2-SHA256 at 100,000 iterations or an equivalent (e.g., Argon2id at OWASP's current minimum recommended parameters) — see FR‑SEC‑010. | P0 | Proposed decision | AUD‑04 | Inspection |
| FR‑SEC‑003 | The app shall offer optional biometric unlock as an alternative to the passcode once one is set. If biometric authentication is unavailable, fails repeatedly, or is disabled at the OS level, the app shall fall back to the passcode entry field automatically rather than blocking the user. | P1 | Proposed decision | AUD‑04 | Test |
| FR‑SEC‑004 | The app shall lock again after a period of backgrounding (exact duration: Open Question — see the Unresolved Decision Register, OQ‑01). | P2 | Proposed decision (mechanism); Open question (duration) | AUD‑04 | Test |
| FR‑SEC‑005 | **(Revised, v1.3 — resolves Forensic Review F‑003.)** After 5 consecutive failed passcode attempts, the app shall impose a fixed delay of 30 seconds (Proposed decision, recommended value — see AUD‑21) before accepting another attempt. The failed-attempt counter and the delay's start time shall be persisted in `expo-secure-store` (the same store as the passcode hash) and shall survive app termination and device restart — force-quitting or rebooting the device shall not reset the counter or shorten a delay already in progress. Full escalating-lockout hardening beyond this fixed delay remains Phase 2 (see Section 10.6). | P2 | Proposed decision — MVP scope is the attempt counter plus this fixed delay; full escalating-lockout hardening is Phase 2 | Not addressed in Source; standard practice; **AUD‑21 (v1.3)** | Test |
| FR‑SEC‑006 | The on-device database and backup files shall be encrypted at rest. | — | Future enhancement | AUD‑04 | — |
| FR‑SEC‑007 | The app shall not include unencrypted sensitive financial data in device logs or crash reports. | P1 | Proposed decision | AUD‑04 | Review |
| FR‑SEC‑008 | Passcode gate implies data confidentiality/encryption. | — | Out of scope claim (explicitly rejected) | AUD‑04 | — |
| **FR‑SEC‑009 (new, v1.3)** | **The Lock Screen (SCR‑11) shall provide a "Forgot passcode?" affordance, reachable without first passing the passcode gate. Selecting it shall present the existing Delete & Reset flow (FR‑BKP‑008) with an explicit, unambiguous warning that all local data will be permanently lost unless the user has an external backup file to restore afterward. This is the app's only passcode-recovery path, consistent with the offline-first constraint (§2) — there is no server-side credential reset.** | **P0** | **Proposed decision** | **AUD‑22 (resolves Forensic Review F‑004)** | **Test** |
| **FR‑SEC‑010 (new, v1.3)** | **The passcode hash's key-derivation work factor (FR‑SEC‑002) shall be reviewed against current OWASP guidance at least once per year and before each major OS-support window change (NFR‑04), so it does not silently become outdated hardware gets faster.** | **P3** | **Recommendation** | **Resolves Forensic Review F‑003 sub-item (minimum hash bar)** | **Review** |

**Acceptance criteria — FR‑SEC‑005 (major, P2; revised in v1.3, resolves Forensic Review F‑003):** Given a user has failed 4 passcode attempts, when they force-quit the app and reopen it, then the failed-attempt count is still 4, not reset to 0; when they then fail a 5th time, then a 30-second delay is imposed before a 6th attempt is accepted, and restarting the device during that delay does not shorten or clear it.

**Acceptance criteria — FR‑SEC‑009 (major, P0; new in v1.3):** Given a user has forgotten their passcode and has a valid external backup file, when they select "Forgot passcode?" on the Lock Screen and confirm the Delete & Reset warning, then the app wipes local data and returns to a fresh, unlocked first-launch state, from which they can immediately restore their backup file per FR‑BKP‑002/004/011.

### FR‑SET — Preferences

| ID | Statement | Priority | Status | Ref | Verification |
|---|---|---|---|---|---|
| FR‑SET‑001 | The app shall allow setting a currency sign (e.g., PHP ₱). | P0 | Confirmed | Source | Test |
| FR‑SET‑002 | The app shall allow setting currency position (prefix/suffix). | P1 | Confirmed | Source | Test |
| FR‑SET‑003 | The app shall allow setting the number of decimal places displayed. Any stored amount is rounded per BR‑12 before display, never at display time only. | P1 | Confirmed | Source; **BR‑12 (v1.3)** | Test |
| FR‑SET‑004 | The app shall provide a toggle to show notes in the record list. | P2 | Confirmed | Source | Test |
| FR‑SET‑005 | The app shall provide a UI-mode setting that can follow system/battery-saver state. | P2 | Confirmed | Source | Test |
| FR‑SET‑006 | The app shall provide a theme selector; only one theme ships in MVP. | P3 | Confirmed (existence) / Out of scope (additional themes) | Source | Test |
| FR‑SET‑007 | The app shall provide an opt-in toggle for crash/usage statistics, defaulted to OFF. | P1 | Proposed decision | AUD‑04, About section | Test |
| FR‑SET‑008 | The app shall persist all preference values locally and apply them without requiring app restart where feasible. | P2 | Assumption | Standard expectation | Test |
| **FR‑SET‑009 (new, v1.3)** | **App-store privacy-disclosure metadata (Apple's App Privacy "nutrition label" and Google Play's "Data Safety" section) shall be kept in sync with the actual data-collection behavior of the FR‑SET‑007 analytics toggle and shall be reviewed and, if necessary, updated before every store submission. The specific crash/analytics SDK used is Sentry (Proposed decision, recommended for its React Native/Expo support and configurable payload scrubbing consistent with FR‑SEC‑007 — see AUD‑24); its documented data-collection profile is the basis for the disclosure metadata.** | **P0** | **Proposed decision** | **AUD‑24 (resolves Forensic Review F‑006); release-blocking, see §16.1** | **Inspection** |

### FR‑NOT — Notifications

| ID | Statement | Priority | Status | Ref | Verification |
|---|---|---|---|---|---|
| FR‑NOT‑001 | The app shall provide a "Remind everyday" toggle that schedules a local daily reminder. **Assumption/Risk note (v1.3, resolves Forensic Review F‑026):** delivery on Android is subject to OEM battery-optimization behavior outside the app's control; this is an accepted platform limitation, not a defect, and is out of scope to fully mitigate in MVP. | P1 | Confirmed | Source | Test |
| FR‑NOT‑002 | The app shall request the appropriate OS notification permission before enabling reminders. | P1 | Assumption | Platform requirement | Test |
| FR‑NOT‑003 | Scheduled reminders shall persist across a device restart, subject to the same Android OEM battery-optimization caveat noted under FR‑NOT‑001. | P2 | Proposed decision | Standard reliability expectation | Test |
| FR‑NOT‑004 | The app shall provide a general notification-settings entry point beyond the daily reminder. | P3 | Confirmed | Source | Demo |


### FR‑WDG — Widget

| ID | Statement | Priority | Status | Ref | Verification |
|---|---|---|---|---|---|
| FR‑WDG‑001 | An Android home-screen widget shall display the aggregated balance (confirmed transactions only, v1.3), read-only. | P2 | Proposed decision (reduced scope) | AUD‑05 | Test |
| FR‑WDG‑002 | Tapping the widget shall deep-link into the app's Input screen. | P2 | Proposed decision | AUD‑05 | Test |
| FR‑WDG‑003 | An iOS home-screen widget. | P3 | Future enhancement, pending native feasibility spike | AUD‑05 | — |
| FR‑WDG‑004 | Logging a new transaction directly within the widget UI. | — | Future enhancement, pending spike | AUD‑05 | — |
| FR‑WDG‑005 | "Smart input" predictive entry inside the widget. | — | Future enhancement | AUD‑05 | — |
| FR‑WDG‑006 | The widget shall read balance data via a shared-storage bridge, not direct SQLite access. | P2 | Proposed decision | AUD‑05 | Review |

### FR‑NAV — Navigation

| ID | Statement | Priority | Status | Ref | Verification |
|---|---|---|---|---|---|
| FR‑NAV‑001 | The app shall provide a bottom tab bar linking Records, Analysis, Budgets, Accounts, and Categories. | P0 | Confirmed | Source | Test |
| FR‑NAV‑002 | A floating action button on Records shall open the Input screen. | P0 | Confirmed | Source | Test |
| FR‑NAV‑003 | A sidebar/drawer shall expose Preferences, data-management actions, and Recurring Rules (v1.2). | P1 | Confirmed + extended | Source; Addendum | Test |
| FR‑NAV‑004 | On first launch with no accounts or categories, the app shall present a guided empty state. | P1 | Assumption | Required for usable first run | Demo |

### FR‑ERR — Errors

| ID | Statement | Priority | Status | Ref | Verification |
|---|---|---|---|---|---|
| FR‑ERR‑001 | **(Revised, v1.3 — resolves Forensic Review F‑009.)** The app shall reject a transaction whose amount expression is zero, non-numeric, or malformed (a trailing operator, an unbalanced expression, or division by zero); a valid expression's result shall be rounded to the currency's minor unit using round-half-up per BR‑12 before being stored — the app never persists, nor later re-rounds, a value requiring further rounding at read time. | P0 | Assumption | Basic validation; **BR‑12 (v1.3)** | Test |
| FR‑ERR‑002 | The app shall reject a Transfer where the source and destination account are the same. | P0 | Proposed decision | AUD‑09 | Test |
| FR‑ERR‑003 | The app shall show a non-destructive error message on a failed local write and retain the user's unsaved input. | P1 | Assumption | Standard resilience expectation | Test |
| FR‑ERR‑004 | The app shall detect and reject a corrupt or partially written local database file at launch, offering restore-from-backup. | P1 | Proposed decision | Relates to AUD‑08 | Test |
| FR‑ERR‑005 | The app shall show a clear message when a requested permission is denied, without crashing. | P1 | Assumption | Standard resilience expectation | Test |
| FR‑ERR‑006 | The app shall show a clear, non-silent message when the widget's required OS version/support is unavailable. | P2 | Proposed decision | AUD‑05 | Test |
| FR‑ERR‑007 | The app shall reject a RecurringRule with zero weekdays selected. | P0 | Proposed decision | Gap resolution, v1.2 | Test |
| FR‑ERR‑008 | The app shall reject a RecurringRule whose end date is earlier than its start date. | P0 | Proposed decision | Gap resolution, v1.2 | Test |
| **FR‑ERR‑009 (new, v1.3)** | **The app shall disable the Input screen's Save action for the duration of a single write (a debounce/disable-on-tap guard), and shall additionally enforce, at the repository level, that a second write carrying the same client-generated idempotency token as an already-committed write is not applied twice. Together these shall prevent a duplicate transaction from being created by a rapid double-tap of Save.** | **P0** | **Proposed decision** | **AUD‑25 (resolves Forensic Review F‑007)** | **Test** |
| **FR‑ERR‑010 (new, v1.3)** | **The app shall detect a write blocked by insufficient device storage during a transaction save, backup export, PDF generation, or recurring-rule catch-up batch, and shall fail that operation gracefully: prior data is left completely untouched, any partially-written output file is discarded, and the user sees a clear "not enough storage" message rather than a crash or silent truncation.** | **P1** | **Proposed decision** | **AUD‑35 (resolves Forensic Review F‑025)** | **Test** |

**Acceptance criteria — FR‑ERR‑001/BR‑12 (major, P0; new in v1.3):** Given the keypad expression "10÷3" with the FR‑SET‑003 decimal-places setting at 2, when the user confirms the amount, then the stored value is exactly 3.33 (never a value implying further rounding is needed at read time); given the expression "12+" with no second operand, when the user attempts to confirm, then the app rejects the entry and highlights the incomplete expression without saving.

**Acceptance criteria — FR‑ERR‑004 (major, P1; new in v1.3, resolves Forensic Review F‑013):** Given the local database file is corrupted (e.g., truncated by an interrupted write), when the app is launched, then it detects the corruption before rendering any screen, does not crash, and offers a "Restore from backup" action leading into FR‑BKP‑002.

**Acceptance criteria — FR‑ERR‑009 (major, P0; new in v1.3):** Given the user taps Save on the Input screen twice in rapid succession for the same entry, when both taps register before the first write completes, then exactly one transaction is created, not two.

**Acceptance criteria — FR‑ERR‑010 (P1; new in v1.3):** Given the device has no free storage remaining, when the user attempts a backup export, then the export fails with a clear "not enough storage" message, no partial backup file is left behind, and all existing app data is unchanged.


## 8. Non-Functional Requirements

| ID | Requirement | Status | Note |
|---|---|---|---|
| NFR‑01 | Core logging functions with no network connection. | Confirmed | Source |
| NFR‑02 | All personal financial data is stored on-device only in MVP; no data leaves the device except via explicit user-initiated export/backup. | Assumption | Consistent with offline-first framing |
| NFR‑03 | **(Revised, v1.3 — resolves Forensic Review F‑012; replaces "no more than one perceptible UI stutter" with measurable thresholds.)** Record, Analysis, and Budget screen scrolling shall maintain an average frame time of ≤16ms (60fps) with no single frame exceeding 100ms, measured at the AUD‑06/FR‑ACC‑007/FR‑CAT‑006 QA soft targets (500 accounts / 200 categories) on the Section 18 decision #14 reference device tier (mid-range Android, ~3GB RAM, ≈3-year-old class; oldest iOS device within the NFR‑04 window). The FR‑REC‑002 on-open catch-up check, including the FR‑REC‑011 worst case (50 rules × 30 occurrences, up to 1,500 rows), shall complete within 2 seconds on the same reference device before the navigator mounts (per §10.1's DbGate sequencing). | Proposed decision | Numeric targets set in v1.3 (AUD‑30); previously unmeasurable |
| NFR‑04 | The app supports the two most recent major Android and iOS releases at time of release. | Proposed decision | Not addressed in Source |
| NFR‑05 | Currency and date values are never displayed with float rounding artifacts. | Proposed decision | Tied to BR‑06/BR‑12 (v1.3) |
| NFR‑06 | The app must remain usable one-handed for core logging (Input screen). | Assumption | Not addressed in Source; overlaps with NFR‑07's touch-target guidance |
| **NFR‑07 (new, v1.3)** | **MVP accessibility baseline: (a) every icon-only interactive control (category/account icons, chart legend entries, navigation icons, Pause/Edit/Delete actions on SCR‑10) shall carry a screen-reader-accessible label; (b) all interactive touch targets shall be at least 44×44dp; (c) any state conveyed by color alone elsewhere in this document (e.g., the FR‑BUD‑004 over-budget warning) shall also be conveyed by a non-color signal (icon, text, or pattern); (d) the Input screen keypad and the Records list shall support the OS's dynamic-type/font-scaling setting at MVP; (e) text and icon contrast shall meet a minimum 4.5:1 ratio against its background for normal-size text. Formal conformance-level certification (e.g., a specific WCAG version/level) is a separate Open Question — see the Unresolved Decision Register, OQ‑02 — this baseline is the practical MVP target regardless of that answer.** | **Proposed decision** | **AUD‑23 (resolves Forensic Review F‑005)** |

Vague words ("fast," "secure," "user-friendly," "unlimited") are avoided elsewhere in this document without a measurable definition or explicit status label; NFR‑03 was the one place this discipline had slipped in v1.2 and is corrected above.


## 9. Technical Architecture

Confirmed constraints: React Native, Expo, local-only storage, no backend service.

**Required components:** Runtime: Expo SDK (managed workflow where possible), TypeScript. Navigation: Expo Router (file-based, built on React Navigation) — bottom tabs + stack + drawer, plus the SCR‑11 Lock Screen as a gate in front of the navigator (v1.3). Local relational storage: `expo-sqlite` — chosen over AsyncStorage for indexed date-range filtering, category aggregation, and SUM totals (AUD‑02). The on-open recurring-rule check (FR‑REC‑002) reuses this same layer and the same date-boundary utility (`utils/dates.ts`, AUD‑13) — no separate scheduling engine is introduced in MVP. Secure key-value storage: `expo-secure-store`, used for the passcode hash, small sensitive flags, and — new in v1.3 — the persisted failed-attempt counter and lockout-delay start time (FR‑SEC‑005, AUD‑21). State management: a lightweight store (Zustand or Context + reducers) for UI state; SQLite remains the source of truth for financial data. Forms/validation: a schema-validation library (Zod) applied at the input-screen boundary (supports FR‑ERR‑001/002/007/008, and, new in v1.3, the malformed-arithmetic-expression check in FR‑ERR‑001).

**Recommended components:** ORM/query layer: Drizzle ORM over `expo-sqlite`. Charts: a single chart library (e.g., `react-native-gifted-charts`), selected with attention to NFR‑07's contrast and non-color-encoding requirements (v1.3). PDF generation: `expo-print` + `expo-sharing`. Notifications: `expo-notifications` (subject to the Android OEM battery-optimization caveat noted under FR‑NOT‑001, v1.3). Biometrics: `expo-local-authentication`. List performance: `@shopify/flash-list` for the Records list. **Crash/analytics reporting (recommended, v1.3, Proposed decision — AUD‑24): Sentry's React Native SDK, chosen for first-class Expo support and configurable `beforeSend` payload scrubbing, which FR‑SEC‑007 requires to strip transaction amounts/notes before any report leaves the device.** **Accessibility (v1.3): rely on React Native's built-in `accessibilityLabel`/`accessibilityRole` props and the OS's dynamic-type API rather than a third-party library, to keep NFR‑07 dependency-free.**

**Optional / Future components:** Native widget modules (Android `AppWidgetProvider`, iOS `WidgetKit`) — Future, AUD‑05. IAP/entitlement SDK — Out of scope for MVP, AUD‑03. Database encryption (SQLCipher-compatible layer) — Future, AUD‑04/FR‑SEC‑006. `expo-task-manager` / `expo-background-fetch` — Future (Phase 2), for FR‑REC‑012 (Background firing mode); requires the same move off Expo Go already flagged for the widget (AUD‑05).

Platform-specific components: the widget; biometric API differences (abstracted by `expo-local-authentication`, still needing per-platform QA); the Phase 2 background task registration APIs also diverge by platform and will need the same treatment.

Development-only tooling: Expo development build (required once any native module is added); ESLint/Prettier; a seed-data script for QA (supports AUD‑06 and FR‑REC‑011 load testing, now including a storage-exhaustion simulation harness for FR‑ERR‑010, v1.3).

Dates and currency: dates stored as UTC ISO-8601 instants; grouping evaluated in local time at read time (AUD‑13) — this same rule governs "today" for recurring-rule firing (FR‑REC‑002), so no second date-handling code path exists in the app. Currency stored as integer minor-unit amount, formatting driven by global Preferences (BR‑06, BR‑07); **rounding centralized in a single `utils/money.ts` function per BR‑12 (v1.3), used by both the Input-screen keypad and any future feature that computes a derived monetary value.**

Testing: unit tests around balance-computation and transfer logic (BR‑02, BR‑03), the catch-up cap and pause-window exclusion logic (FR‑REC‑004/006, now covering multi-cycle pause history per AUD‑20), and, new in v1.3, the pending/confirmed/skipped status transitions (FR‑REC‑015/016), the rounding function (BR‑12), and the duplicate-submission idempotency guard (FR‑ERR‑009), given their correctness risk; component tests for Input-screen validation; no end-to-end framework is mandated.

Error monitoring: an opt-in crash-reporting SDK (Sentry, recommended v1.3) gated by the About-screen toggle (FR‑SET‑007), scrubbing transaction amounts/notes from any reported payload (FR‑SEC‑007); its data-collection profile is the basis for the FR‑SET‑009 store-disclosure metadata (v1.3).

Builds and releases: EAS Build for store binaries; a widget, background task, or any other native module addition requires moving off Expo Go for local development.

## 10. Project Structure

**Status:** Proposed decision (engineering-owned). This section creates no new "shall" requirement and does not change the status of any item in Section 7. **v1.3 change-control note:** the change-control rule in §1 now also requires that any Data Model change (§11) be made in the same revision as the Section 7 requirement it supports — several of this section's v1.3 additions below exist precisely because that wasn't true of v1.2's Recurring Rules addition.

### 10.1 Structure decisions

- Routing: Expo Router.
- One package, no backend.
- Launch states are gates, not routes: `DbGate` (open, migrate, integrity check, recovery) and `LockGate` (passcode/biometric, now the implementation behind SCR‑11, v1.3) wrap the navigator in the root layout. The on-open recurring-rule catch-up check (FR‑REC‑002) runs inside `DbGate`, after migration/integrity check succeed and before the navigator mounts, so a user never sees a partially-loaded Records screen followed by a late-arriving review dialog. **`LockGate` now also hosts the "Forgot passcode?" affordance (FR‑SEC‑009, v1.3), reachable before authentication succeeds.**
- Preferences in SQLite; secrets (passcode hash, failed-attempt counter, lockout-delay start time — v1.3) in SecureStore.
- IDs are text UUIDs, stable across backup/restore.
- Repositories are factories, taking the db handle as a parameter, for testability against in-memory SQLite.
- QA seed is a generated backup file (`scripts/generate-qa-backup.ts`), extended in v1.2 to also emit RecurringRule rows at the FR‑REC‑011 scale (50 rules) with a mix of due, paused, and stale (>30-day-missed) rules; **extended again in v1.3 to emit rules with multi-cycle pause history (for TC‑24), a mix of `pending`/`confirmed`/`skipped` occurrence statuses (for TC‑23), and a storage-exhaustion simulation mode (for TC‑36).**
- Native folders are generated, not committed.
- Drizzle is assumed as the query layer (Recommended in Section 9).

### 10.2 Repository layout (MVP)

    kwartracker/
    ├── app/                        # Expo Router routes only; thin screens
    ├── src/                        # all other application code; alias "@/" -> src/
    ├── drizzle/                    # numbered .sql migrations + migrations.js (committed)
    ├── tests/
    ├── scripts/
    ├── docs/
    ├── assets/
    ├── app.config.ts
    ├── eas.json
    ├── drizzle.config.ts
    ├── babel.config.js
    ├── metro.config.js
    ├── tsconfig.json
    ├── jest.config.js
    ├── jest.setup.ts
    ├── eslint.config.js
    ├── .prettierrc
    ├── .gitignore
    ├── package.json
    └── README.md

`app/` — routes

    app/
    ├── _layout.tsx                 # root Stack: providers > DbGate > LockGate > navigator; modal routes
    ├── +not-found.tsx
    ├── lock/                       # SCR-11 (NEW, v1.3)
    │   └── index.tsx               # passcode/biometric entry; "Forgot passcode?" -> reset.tsx (FR-SEC-009)
    ├── (main)/                     # signed-in shell: Drawer wrapping the tabs
    │   ├── _layout.tsx             # Drawer = sidebar SCR-08 (FR-NAV-003); adds a "Recurring Rules" entry (v1.2)
    │   ├── (tabs)/
    │   │   ├── _layout.tsx         # bottom tab bar (FR-NAV-001)
    │   │   ├── index.tsx           # Records, SCR-01; floating + opens /transaction/new; lists confirmed transactions only (v1.3)
    │   │   ├── analysis.tsx        # Expense Overview, SCR-02
    │   │   ├── budgets.tsx         # Budgets, SCR-04
    │   │   ├── accounts.tsx        # Accounts, SCR-06; picker excludes archived (FR-ACC-009, v1.3)
    │   │   └── categories.tsx      # Categories, SCR-07; picker excludes archived (FR-CAT-007, v1.3)
    │   ├── preferences/             # SCR-09
    │   │   ├── _layout.tsx
    │   │   ├── index.tsx
    │   │   ├── passcode.tsx
    │   │   └── notifications.tsx
    │   ├── recurring-rules/         # SCR-10 (v1.2)
    │   │   ├── _layout.tsx          # nested Stack
    │   │   ├── index.tsx            # rule list; pending-review badge (v1.3); Pause/Edit/Delete (FR-REC-010)
    │   │   └── review.tsx           # missed-occurrence batch review modal (FR-REC-003/004); confirm/skip sets status (v1.3)
    │   ├── export-report.tsx
    │   ├── backup-restore.tsx       # restore now runs FR-BKP-011 referential-integrity check before commit (v1.3)
    │   └── reset.tsx
    ├── transaction/
    │   ├── new.tsx                  # Input screen, SCR-05; ?duplicateOf=<id>; "Repeat" toggle -> recurring/new.tsx; Save debounced (FR-ERR-009, v1.3)
    │   └── [id].tsx                 # Transfer edit here now goes through FR-TRN-013's atomic path (v1.3)
    ├── account/
    │   ├── new.tsx
    │   └── [id].tsx
    ├── category/
    │   ├── new.tsx
    │   └── [id].tsx
    ├── budget/
    │   └── [categoryId].tsx
    └── recurring/                   # v1.2
        ├── new.tsx                  # create a rule from the Input screen's "Repeat" toggle (FR-REC-001)
        └── [id].tsx                 # edit a rule (FR-REC-009)

`src/` — data, domain and services

    src/
    ├── db/
    │   ├── client.ts
    │   ├── schema.ts                # + recurring_rules, + transactions.recurringRuleId (v1.2); + transactions.status, + recurring_rule_pause_periods (v1.3)
    │   ├── migrate.ts
    │   ├── seed.ts
    │   └── reset.ts
    ├── repositories/
    │   ├── accountsRepo.ts          # hard-delete guard checks recurringRulesRepo (BR-11, v1.2); active-picker query excludes archived (FR-ACC-009, v1.3)
    │   ├── categoriesRepo.ts        # same guard + picker extension (v1.2/v1.3)
    │   ├── transactionsRepo.ts      # create() takes an idempotency token (FR-ERR-009, v1.3); status-aware aggregate queries (FR-REC-015, v1.3)
    │   ├── budgetsRepo.ts
    │   ├── settingsRepo.ts
    │   ├── recurringRulesRepo.ts    # v1.2: CRUD + pause/resume + unique(ruleId, occurrenceDate); v1.3: pause/resume now writes/closes a RecurringRulePausePeriod row
    │   └── index.ts
    ├── domain/
    │   ├── types.ts                 # + RecurringRule type (v1.2); + TransactionStatus, PausePeriod types (v1.3)
    │   ├── money.ts                 # + roundToMinorUnit() per BR-12 (v1.3), used by amountExpression.ts
    │   ├── balances.ts              # sums confirmed-status transactions only (BR-03, v1.3)
    │   ├── budgets.ts
    │   ├── analysis.ts
    │   ├── amountExpression.ts      # + malformed-expression detection (FR-ERR-001, v1.3)
    │   └── recurrence.ts            # due-date calculation, 30-occurrence cap (FR-REC-004), pause-window exclusion now reading full pause-period history (FR-REC-006, v1.3); pure TS, unit-tested
    ├── schemas/
    │   ├── transaction.ts
    │   ├── account.ts
    │   ├── category.ts
    │   ├── budget.ts
    │   ├── settings.ts
    │   ├── backup.ts                 # includes recurring_rules + recurring_rule_pause_periods + transactions.status in the schema-validated backup shape (v1.3)
    │   └── recurringRule.ts          # weekdays non-empty (FR-ERR-007), endDate >= startDate (FR-ERR-008)
    ├── services/
    │   ├── backup/
    │   │   ├── backupService.ts      # exports recurring_rules + pause periods (FR-BKP-009, v1.3); fails gracefully on storage exhaustion (FR-ERR-010, v1.3)
    │   │   └── restoreService.ts     # runs referential-integrity check (FR-BKP-011, v1.3) before replace; maps older-schema backups to defaults (FR-BKP-010, v1.3)
    │   ├── resetService.ts           # invoked from both SCR-08 (Sidebar) and SCR-11 (Lock Screen forgot-passcode path, v1.3)
    │   ├── pdf/
    │   │   ├── pdfExportService.ts   # confirmed-only; Transfer/recurring representation (FR-PDF-005, v1.3); fails gracefully on storage exhaustion
    │   │   └── reportTemplate.ts
    │   ├── notifications/
    │   │   └── reminderService.ts
    │   ├── security/
    │   │   ├── passcodeService.ts    # attempt counter + 30s fixed delay, persisted in SecureStore across restart (FR-SEC-005, v1.3)
    │   │   └── biometricService.ts   # falls back to passcode field on failure/unavailability (FR-SEC-003, v1.3)
    │   ├── recurring/
    │   │   └── recurringCheckService.ts  # runs inside DbGate; computes due occurrences via domain/recurrence.ts (now pause-history-aware); writes as `pending` or `confirmed` per FR-REC-002/007 (v1.3)
    │   └── diagnostics/
    │       └── crashReporting.ts     # Sentry integration; beforeSend scrubs amounts/notes (FR-SEC-007)

`src/` — UI layer and shared code

    src/
    ├── hooks/
    │   ├── useAccounts.ts           # excludes archived from active-picker variant (v1.3)
    │   ├── useCategories.ts         # same (v1.3)
    │   ├── useTransactions.ts       # confirmed-only by default; pending/skipped surfaced only to SCR-10 (v1.3)
    │   ├── useMonthSummary.ts
    │   ├── useBudgets.ts
    │   ├── useAnalysis.ts
    │   ├── useCurrencyFormatter.ts
    │   ├── useAppLock.ts            # + forgot-passcode action (v1.3)
    │   └── useRecurringRules.ts     # list, pause/resume, pending-review state and count badge (v1.3)
    ├── state/
    │   ├── lockStore.ts
    │   ├── periodStore.ts
    │   └── preferencesStore.ts
    ├── components/
    │   ├── ui/
    │   │   ├── ConfirmDialog.tsx
    │   │   ├── EmptyState.tsx
    │   │   └── MonthSwitcher.tsx
    │   ├── records/                    # RecordRow gains a recurring-icon tag when confirmed + recurringRuleId set (FR-REC-014); accessibilityLabel required on icon-only elements (NFR-07, v1.3)
    │   ├── input/                      # + RepeatToggle, WeekdayPicker (v1.2); Save button debounced (FR-ERR-009, v1.3)
    │   ├── analysis/
    │   ├── budgets/                     # over-budget indicator uses icon+color, not color alone (NFR-07, v1.3)
    │   ├── accounts/
    │   ├── categories/
    │   ├── security/                    # + ForgotPasscodeFlow.tsx (v1.3), hosts FR-SEC-009 on SCR-11
    │   ├── recurring/                   # RuleRow, RuleForm, MissedOccurrenceReview (confirm/skip sets status, v1.3)
    │   └── system/
    ├── theme/                           # contrast tokens meet NFR-07's 4.5:1 minimum (v1.3)
    ├── constants/
    └── utils/
        ├── currency.ts
        ├── dates.ts                    # single source of truth for "local today"; used by both AUD-13 and FR-REC-002
        ├── money.ts                     # NEW, v1.3: roundToMinorUnit() implementing BR-12; re-exported from domain/money.ts
        └── ids.ts                       # + generateIdempotencyToken() for FR-ERR-009 (v1.3)

`tests/`, `scripts/`, `docs/`, `assets/` — unchanged in structure; new test files listed in Section 15.


## 11. Data Model and Storage

**Status:** Proposed decision throughout unless noted. **v1.3 change:** two entities gain fields/relations to make FR‑REC‑002/006/015/016 implementable (resolving Forensic Review F‑001, F‑002); one field name is corrected (resolving F‑016).

### Entities

**Account** — id, name, icon, openingBalance (integer, minor unit), isArchived, createdAt, updatedAt.

**Category** — id, type (Income | Expense), name, icon, isArchived, createdAt, updatedAt.

**Transaction** — id, type (Income | Expense | Transfer), amount (integer, minor unit; rounded per BR‑12 before storage, v1.3), date (UTC instant), note (nullable), accountId (FK Account), categoryId (FK Category, nullable — required for Income/Expense, null for Transfer), toAccountId (FK Account, nullable — required for Transfer, null otherwise), recurringRuleId (FK RecurringRule, nullable — set only for a rule-generated row), occurrenceDate (nullable — the local calendar date this row represents, set only alongside recurringRuleId; unique together with recurringRuleId), **`status`** (**new, v1.3** — enum `pending` | `confirmed` | `skipped`; every manually-created transaction is created directly as `confirmed` and never transitions away from it; a recurring-generated row starts as `pending` or `confirmed` per FR‑REC‑002/007 and, if `pending`, may transition to `confirmed` or `skipped` per FR‑REC‑003/005 — see FR‑REC‑015/016 for what each status means for visibility and aggregation), createdAt, updatedAt.

**Budget** — id, categoryId (FK Category), month (year-month), limitAmount (integer, minor unit), createdAt, updatedAt.

**Preferences** — a single-row settings table: currencySign, currencyPosition, decimalPlaces, notesVisibleInList, uiMode, theme, dailyReminderEnabled, dailyReminderTime, analyticsOptIn (default false), passcodeEnabled, biometricEnabled.

**RecurringRule** *(v1.2)* — id, type (Income | Expense | Transfer), amount (integer, minor unit; same BR‑12 rounding), accountId (FK Account), toAccountId (FK Account, nullable, Transfer only), categoryId (FK Category, nullable, Income/Expense only), note (nullable), weekdays (bitmask or small-int-array, non-empty per FR‑ERR‑007), startDate, endDate (nullable; must be ≥ startDate per FR‑ERR‑008), firingMode (onOpen | background — MVP supports onOpen only, per FR‑REC‑012), confirmBeforeAdding (boolean, default true), isPaused (boolean), **isArchivedSource** (boolean, derived — true when the referenced account/category is archived; **name corrected in v1.3 from the inconsistent "isArchived-source-derived" used in v1.2** — resolves Forensic Review F‑016), createdAt, updatedAt.

**RecurringRulePausePeriod** *(new, v1.3 — resolves Forensic Review F‑002)* — id, recurringRuleId (FK RecurringRule), pausedAt (timestamp, set the instant `isPaused` flips to true — by direct user action per FR‑REC‑010, or automatically per FR‑REC‑008), resumedAt (nullable timestamp; null while the rule is still paused; set the instant `isPaused` flips back to false). A rule may accumulate any number of these rows over its lifetime, one per pause/resume cycle, which is what lets `domain/recurrence.ts` correctly exclude every historical paused window from catch-up generation (FR‑REC‑006) no matter how many times the rule has been paused and resumed — a single boolean, as in v1.2, could not represent this.

### Relationships

Account 1—* Transaction (via accountId and, for Transfers, toAccountId). Category 1—* Transaction. Category 1—* Budget. Account/Category 1—* RecurringRule *(v1.2)*. RecurringRule 1—* Transaction (via recurringRuleId) *(v1.2)*. **RecurringRule 1—* RecurringRulePausePeriod (new, v1.3).**

### Indices (with rationale)

Transaction(date) — month/range queries (Records, Analysis). Transaction(accountId), Transaction(categoryId) — balance and category-aggregate computation. Transaction(recurringRuleId, occurrenceDate) UNIQUE — the idempotency guard behind FR‑REC‑002's on-open catch-up, preventing the same occurrence from ever being generated twice. **Transaction(status)** — **new, v1.3**; every screen-facing and aggregate query (Records, balance, Budgets, Analysis, PDF export) now filters on `status = 'confirmed'` per FR‑REC‑015, so this index keeps that filter cheap even as the pending/skipped backlog grows. Budget(categoryId, month) UNIQUE — one budget per category per month (BR‑05). RecurringRule(isPaused, isArchivedSource) — the on-open check's WHERE clause (FR‑REC‑002) filters on both. **RecurringRulePausePeriod(recurringRuleId)** — **new, v1.3**; `domain/recurrence.ts` looks up a rule's full pause history by this key on every catch-up pass.

### Storage responsibilities

SQLite: all financial data (accounts, categories, transactions of every status, budgets, recurring rules, pause-period history). SecureStore: passcode hash, biometric-enabled flag, **failed-attempt counter and lockout-delay start time (new, v1.3 — FR‑SEC‑005)**. A lightweight KV/AsyncStorage-class store (or SQLite's Preferences table) — the theme/UI-mode toggle only, since it must be read before the database is guaranteed open.


## 12. Internal Service Boundaries

Repository pattern; each repo owns one entity's CRUD and enforces the business rules that apply to it.

- `accountsRepo` / `categoriesRepo` — enforce BR‑04/BR‑11 hard-delete rejection (checking both `transactionsRepo` for any-status references and `recurringRulesRepo` for active/paused references); expose an `activePickerList()` query that excludes archived rows, backing FR‑ACC‑009/FR‑CAT‑007 (v1.3), alongside the existing unfiltered `all()` used for historical-record rendering.
- `transactionsRepo` — enforces BR‑06/BR‑12 rounding at the write boundary (delegating to `domain/money.ts`); **`create()` now accepts a client-generated idempotency token (v1.3) and rejects a second write carrying a token already committed, backing FR‑ERR‑009**; exposes status-aware queries (`confirmedOnly()`, used by every balance/budget/analysis/PDF/Records read; `pendingForRule(ruleId)`, used by SCR‑10's review batch) so no calling code has to remember the `status = 'confirmed'` filter itself.
- `budgetsRepo` — enforces BR‑05 (one budget per category per month) and reads only `confirmedOnly()` transactions for "Total Spent" (FR‑BUD‑004, v1.3).
- `recurringRulesRepo` *(v1.2; extended v1.3)* — enforces FR‑ERR‑007/008 on create/edit; on pause, opens a new `RecurringRulePausePeriod` row (`pausedAt = now`); on resume, closes the open row (`resumedAt = now`); exposes `pausePeriodsFor(ruleId)` for `domain/recurrence.ts`.
- `recurringCheckService` *(v1.2; extended v1.3)* — runs once per app open inside `DbGate`, after migration/integrity check, before the navigator mounts; computes due occurrences via `domain/recurrence.ts` (now consulting `pausePeriodsFor(ruleId)` to exclude every historical paused window, not just the current `isPaused` state); writes each due occurrence via `transactionsRepo.create()` with `status = 'pending'` or `'confirmed'` per FR‑REC‑002/007; **wraps each rule's catch-up batch in one SQL transaction (unchanged from v1.2), so a failure partway through one rule's catch-up cannot corrupt another rule's occurrences, and now also surfaces an FR‑ERR‑010 storage-exhaustion failure cleanly if the device runs out of space mid-batch (v1.3)**.
- `backupService` / `restoreService` — `backupService` serializes every entity including `RecurringRulePausePeriod` and `transactions.status` (FR‑BKP‑009). **`restoreService` now runs a referential-integrity pass (v1.3, FR‑BKP‑011) — every foreign key in the incoming file must resolve within that same file — before beginning the destructive replace; a schema-version older than current maps missing tables/fields to empty/default rather than failing (FR‑BKP‑010).**
- `resetService` — implements Delete & Reset (FR‑BKP‑008); **now invoked from two entry points (v1.3): the Sidebar (SCR‑08, requires being unlocked) and the Lock Screen's "Forgot passcode?" affordance (SCR‑11, reachable without unlocking, FR‑SEC‑009).**
- `pdfExportService` — reads only `confirmedOnly()` transactions (FR‑PDF‑001); **renders Transfers as excluded-from-totals line items and tags confirmed recurring rows with a text marker (v1.3, FR‑PDF‑005); fails gracefully on storage exhaustion (FR‑ERR‑010).**
- `passcodeService` — hashes/verifies the passcode (FR‑SEC‑002); **persists the failed-attempt counter and lockout-delay start time in SecureStore, surviving app kill/reboot (v1.3, FR‑SEC‑005).**
- `biometricService` — wraps `expo-local-authentication`; **falls back to the passcode field automatically on any failure or unavailability (v1.3, FR‑SEC‑003).**
- `crashReporting` *(v1.3)* — thin wrapper around the Sentry SDK; `beforeSend` strips transaction amounts/notes (FR‑SEC‑007) before any payload leaves the device; active only when `Preferences.analyticsOptIn` is true (FR‑SET‑007).

## 13. Validation and Error Handling

| Rule | Enforced where | Ref |
|---|---|---|
| Amount required, non-zero, numeric | Input screen (immediate) + `transactionsRepo` (defense in depth) | FR‑ERR‑001 |
| **Malformed arithmetic expression rejected (trailing operator, division by zero); valid result rounded per BR‑12 (v1.3)** | **Input screen keypad (`domain/amountExpression.ts`) + `transactionsRepo`** | **FR‑ERR‑001, BR‑12** |
| Transfer source ≠ destination | Input screen + `transactionsRepo` | FR‑ERR‑002 |
| Referenced account/category cannot be hard-deleted (any-status transactions or active/paused rules) | `accountsRepo` / `categoriesRepo` | BR‑04, BR‑11 |
| RecurringRule needs ≥1 weekday | Rule form + `recurringRulesRepo` | FR‑ERR‑007 |
| RecurringRule endDate ≥ startDate | Rule form + `recurringRulesRepo` | FR‑ERR‑008 |
| Corrupt DB detected at launch | `DbGate` integrity check | FR‑ERR‑004 |
| Failed write leaves prior state intact | All repos (SQLite transaction wrapping) | FR‑ERR‑003 |
| **Duplicate Save (double-tap) does not create two rows (v1.3)** | **Input screen debounce + `transactionsRepo.create()` idempotency-token check** | **FR‑ERR‑009** |
| **Restore file referential integrity validated before commit (v1.3)** | **`restoreService`, pre-flight pass** | **FR‑BKP‑011** |
| **Storage-exhaustion failures are graceful, not silent or crash-causing (v1.3)** | **`backupService`, `pdfExportService`, `recurringCheckService`** | **FR‑ERR‑010** |
| **A rule's pause-period rows never overlap and are always well-formed (open period closed before a new one opens) (v1.3, internal invariant)** | **`recurringRulesRepo` pause/resume methods** | **Supports FR‑REC‑006; verified by TC‑24** |

## 14. Security and Privacy

| Item | Category | Status | Ref |
|---|---|---|---|
| Passcode gate | Access control | Confirmed | FR‑SEC‑001 |
| Passcode hashed + salted in SecureStore, work factor ≥ PBKDF2-SHA256/100k or Argon2id-equivalent | Access control | Proposed decision | FR‑SEC‑002, FR‑SEC‑010 (v1.3) |
| Biometric unlock, falls back to passcode on failure | Access control | Proposed decision | FR‑SEC‑003 |
| Auto re-lock after backgrounding | Access control | Proposed decision (mechanism); Open question (duration) | FR‑SEC‑004; Unresolved Decision Register OQ‑01 |
| **Failed-attempt counter + 30s fixed delay, persisted across app kill/device restart (v1.3)** | **Access control / brute-force mitigation** | **Proposed decision** | **FR‑SEC‑005; AUD‑21** |
| **Forgot-passcode / lockout recovery via Delete & Reset, reachable pre-authentication on SCR‑11 (v1.3)** | **Access control / data-recovery** | **Proposed decision** | **FR‑SEC‑009; AUD‑22** |
| Database encryption at rest | Confidentiality | Unsupported claim — not made | FR‑SEC‑006 |
| Backup file encryption | Confidentiality | Unsupported claim — not made | FR‑SEC‑006 |
| No sensitive data in logs/crash reports | Privacy | Proposed decision | FR‑SEC‑007 |
| Opt-in analytics, default OFF | Privacy | Proposed decision | FR‑SET‑007 |
| **App-store privacy-disclosure metadata (Apple/Google) synced with actual analytics SDK behavior before every submission (v1.3)** | **Privacy / release compliance** | **Proposed decision; release-blocking, see §16.1** | **FR‑SET‑009; AUD‑24** |
| Formal privacy policy | Privacy / compliance | **Not addressed — release-blocking (unchanged from v1.2; see Unresolved Decision Register, OQ‑03)** | Section 16.1 |
| **Data-privacy regulatory regime applicable to target launch markets** | **Compliance** | **Open question — no specific law is assumed; see Unresolved Decision Register, OQ‑04** | — |


## 15. Testing and QA

**Strategy:** Unit tests for pure domain logic (balances, recurrence, rounding). Repository tests against in-memory SQLite for CRUD + business-rule enforcement. Component tests for Input-screen validation. A small set of representative manual/scripted test cases below covers the highest-risk end-to-end flows; this is not the full test plan.

| ID | Scenario | Requirement(s) |
|---|---|---|
| TC‑01 | Create an Income transaction; verify it appears in Records and account balance updates | FR‑TRN‑001/002, BR‑03 |
| TC‑02 | Create a Transfer; verify both account balances update and it is excluded from Income/Expense totals | FR‑TRN‑007/008, BR‑02 |
| TC‑03 | Attempt a Transfer with source = destination; verify rejection | FR‑ERR‑002 |
| TC‑04 | Create a transaction dated in a different time zone/day boundary; verify it lands in the correct local month | AUD‑13 |
| TC‑05 | Archive a category with existing transactions; verify transactions remain intact and the category is hidden from new-entry pickers | BR‑04, FR‑CAT‑004 |
| TC‑06 | Set a budget, log expenses past the limit; verify the over-budget indicator appears | FR‑BUD‑004 |
| TC‑07 | Transfer delete; verify atomic reversal of both accounts' balances | FR‑TRN‑010 |
| TC‑08 | Archive an account with existing transactions; verify it disappears from active pickers but historical transactions still render it correctly | FR‑ACC‑005, **FR‑ACC‑009 (v1.3)** |
| TC‑09 | Export a backup, then restore it on a fresh install; verify data matches exactly | FR‑BKP‑001/002/004 |
| TC‑10 | Attempt restore from a corrupted file; verify rejection and untouched existing data | FR‑BKP‑005 |
| TC‑11 | Fail the passcode 5 times; verify the fixed delay is imposed | FR‑SEC‑005 |
| TC‑12 | Deny notification permission; verify a clear, non-crashing message | FR‑NOT‑002, FR‑ERR‑005 |
| TC‑13 | Set decimal places to 0 and to 2; verify amount display and entry both respect it | FR‑SET‑003 |
| TC‑14 | Duplicate an existing transaction; verify the new entry pre-fills fields and behaves as a fresh manual entry | FR‑TRN‑006, **FR‑TRN‑014 (v1.3)** |
| TC‑15 | First launch with zero accounts/categories; verify the guided empty state appears | FR‑NAV‑004 |
| TC‑16 | Create a Mon/Wed/Fri ₱200 rule; skip opening the app for 10 days; verify exactly the matching missed weekdays are generated as a review batch, capped at 30 | FR‑REC‑002/003/004 |
| TC‑17 | Pause a rule, wait through 5 of its matching weekdays, resume it; verify none of the 5 paused-window occurrences are ever generated | FR‑REC‑006 |
| TC‑18 | Archive the category referenced by an active rule; verify the rule auto-pauses and un-archiving does not auto-resume it | FR‑REC‑008 |
| TC‑19 | Attempt to hard-delete an account referenced by an active rule; verify rejection with Archive offered | FR‑REC‑013, BR‑11 |
| TC‑20 | Restore a pre-v1.2 backup file (no recurring_rules table); verify it restores cleanly with zero rules rather than failing | FR‑BKP‑009, **FR‑BKP‑010 (v1.3)** |
| TC‑21 | Load-test the on-open check at 50 rules × 30 missed occurrences each; verify it completes within the NFR‑03 2-second bound (v1.3) | FR‑REC‑011, NFR‑03 |
| TC‑22 | Create a rule with zero weekdays selected, and one with endDate before startDate; verify both are rejected | FR‑ERR‑007/008 |
| **TC‑23 (new, v1.3)** | **Generate 3 `pending` occurrences for a rule; verify they are excluded from Records, account balance, Budget "Total Spent," Analysis totals, and PDF export until confirmed; confirm all 3 and verify all five surfaces update immediately; skip one instead and verify it never appears anywhere and is never regenerated on a later check** | **FR‑REC‑002/003/015/016** |
| **TC‑24 (new, v1.3)** | **Pause a rule on day 10, resume on day 20, pause again on day 30, resume on day 35; run catch-up on day 40; verify days 10–20 and 30–35 are never generated while days 21–29 and 36–40 are** | **FR‑REC‑006** |
| **TC‑25 (new, v1.3)** | **Fail the passcode 4 times, force-quit the app, reopen it, fail a 5th time; verify the attempt count survived the restart and the 30-second delay is imposed; verify a device reboot mid-delay does not shorten it** | **FR‑SEC‑005** |
| **TC‑26 (new, v1.3)** | **From the Lock Screen, select "Forgot passcode?"; confirm Delete & Reset; verify the app returns to first-launch state; then restore a valid backup file and verify all data returns** | **FR‑SEC‑009, FR‑BKP‑002/004** |
| **TC‑27 (new, v1.3)** | **With a screen reader active, navigate Accounts/Categories/Budgets; verify every icon-only control announces a label, the over-budget indicator is identifiable without color, all interactive targets measure ≥44×44dp, and text respects the OS dynamic-type setting on the Input screen and Records list** | **NFR‑07** |
| **TC‑28 (new, v1.3)** | **Rapidly double-tap Save on the Input screen for one entry; verify exactly one transaction is created** | **FR‑ERR‑009** |
| **TC‑29 (new, v1.3)** | **Edit an existing Transfer's amount, then separately its destination account; verify both account balances update atomically with no observable one-sided intermediate state** | **FR‑TRN‑013** |
| **TC‑30 (new, v1.3)** | **Enter "10÷3" and other non-terminating-decimal expressions at each FR‑SET‑003 decimal-place setting; verify round-half-up is applied consistently and the stored value never requires further rounding; enter "12+" and verify rejection** | **BR‑12, FR‑ERR‑001** |
| **TC‑31 (new, v1.3)** | **Duplicate a confirmed recurring-generated transaction; verify the new row has `recurringRuleId`, `occurrenceDate` cleared and `status = confirmed` as an ordinary manual entry, with no recurring-icon tag** | **FR‑TRN‑006/014** |
| **TC‑32 (new, v1.3)** | **Verify an archived account/category is absent from the new-transaction picker and the new-recurring-rule picker, but still renders correctly on transactions/rules created before archiving** | **FR‑ACC‑009, FR‑CAT‑007** |
| **TC‑33 (new, v1.3)** | **Measure actual scroll frame time on Records/Analysis/Budgets at the 500-account/200-category QA soft target on the reference device tier; verify ≤16ms average, no frame >100ms** | **NFR‑03** |
| **TC‑34 (new, v1.3)** | **Construct a backup file with the current schema version but a transaction referencing a non-existent accountId; attempt restore; verify rejection before any existing data is touched** | **FR‑BKP‑011** |
| **TC‑35 (new, v1.3)** | **Generate a PDF for a period containing one Transfer and one confirmed recurring transaction; verify the Transfer is shown as an excluded-from-totals line item and the recurring transaction carries a text marker matching its on-screen tag** | **FR‑PDF‑005** |
| **TC‑36 (new, v1.3)** | **Fill the test device's available storage; attempt a backup export and a PDF generation; verify both fail gracefully with a clear message, no partial file remains, and existing data is unchanged** | **FR‑ERR‑010** |
| **TC‑37 (new, v1.3)** | **Background the app past the (to-be-determined) FR‑SEC‑004 duration; verify it re-locks; background it for less than that duration; verify it does not — blocked pending the Unresolved Decision Register's OQ‑01** | **FR‑SEC‑004** |
| **TC‑38 (new, v1.3)** | **Edit an account's name/icon/opening balance (FR‑ACC‑004); edit a category's icon/title (FR‑CAT‑003); change a preference and restart the app (FR‑SET‑008); verify each persists correctly** | **FR‑ACC‑004, FR‑CAT‑003, FR‑SET‑008** |


## 16. Release Plan

**MVP:** Records, Input (Income/Expense/Transfer incl. atomic Transfer edit v1.3), Accounts, Categories, one Budget view, one Analysis chart, backup/restore (with referential-integrity validation, v1.3), PDF export (with Transfer/recurring representation, v1.3), passcode + optional biometric + forgot-passcode recovery (v1.3), basic preferences, daily reminder, MVP accessibility baseline (v1.3), weekday-based Recurring Transaction Rules with a complete pending/confirmed/skipped occurrence model and multi-cycle pause history (v1.2 feature, data model and behavior completed in v1.3).

**Phase 2:** Background firing mode for recurring rules (FR‑REC‑012), full escalating passcode-lockout hardening beyond the MVP fixed delay (FR‑SEC‑005), CSV/XLSX export, extended analysis date ranges, budget rollover.

**Phase 3:** Android home-screen widget (read-only, tap-to-deep-link), then iOS widget and in-widget logging pending a native feasibility spike, additional themes, Free/Pro entitlement.

### 16.1 MVP Release-Gate Checklist (new, v1.3 — resolves Forensic Review's recommendation to consolidate release-blocking items)

An MVP build shall not be submitted to either app store until every item below is checked:

**Product**
- [ ] Objectives O1–O4 (Section 2) approved by PO (AUD‑34/decision #34).
- [ ] All Section 18 decisions marked "Resolve by: before release" are closed (see Unresolved Decision Register for the current list).

**Engineering**
- [ ] Transaction.status (pending/confirmed/skipped) and RecurringRulePausePeriod are implemented and TC‑23/TC‑24 pass.
- [ ] FR‑SEC‑005's attempt-counter persistence and FR‑SEC‑009's forgot-passcode flow are implemented and TC‑25/TC‑26 pass.
- [ ] FR‑ERR‑009 (duplicate-submission), FR‑ERR‑010 (storage exhaustion), FR‑TRN‑013 (Transfer-edit atomicity), and BR‑12 (rounding) are implemented and TC‑28/TC‑29/TC‑30/TC‑36 pass.

**QA**
- [ ] NFR‑03's measurable performance thresholds are met on the reference device tier (TC‑33, TC‑21).
- [ ] All 38 test cases in Section 15 pass, or any failure is triaged and explicitly accepted by the PO with a written reason.

**Security**
- [ ] FR‑SEC‑002's hash work-factor is verified (FR‑SEC‑010) against current OWASP guidance.
- [ ] FR‑SEC‑007's crash-report payload scrubbing is verified to exclude transaction amounts/notes.

**Privacy**
- [ ] A formal privacy policy is published (unresolved since v1.2 — see Unresolved Decision Register, OQ‑03).
- [ ] Apple App Privacy and Google Play Data Safety metadata (FR‑SET‑009) match the actual behavior of the Sentry integration and the FR‑SET‑007 opt-in toggle's default-OFF state.
- [ ] The jurisdiction/compliance scope question (Unresolved Decision Register, OQ‑04) has been reviewed for the specific markets this release targets, even if the answer is "no action needed for this market."

**Accessibility**
- [ ] NFR‑07's five-point MVP baseline is implemented and TC‑27 passes.

**Documentation**
- [ ] This document's Section 18/18a/18b decisions are all either Approved or explicitly carried into the Unresolved Decision Register with an owner and a resolve-by stage.
- [ ] The Final Audit (below) shows no remaining Critical or High item without an accepted mitigation.


## 17. Traceability Matrix

Condensed — grouped by feature area; per-requirement Ref/Verification columns in Section 7 are the authoritative row-level trace. **v1.3 adds rows for every new feature area introduced by the Forensic Review remediation.**

| Objective | Feature | Use Case(s) | Requirement group | Screen(s) | Data | Test case(s) | Status |
|---|---|---|---|---|---|---|---|
| O1 | Quick entry | UC‑01, UC‑02 | FR‑TRN‑001–006, FR‑TRN‑013/014 (v1.3) | SCR‑05 | Transaction | TC‑01, TC‑02, TC‑14, TC‑28, TC‑29, TC‑30, TC‑31 | In progress |
| O2 | Spend visibility | UC‑07 | FR‑ANA‑001–004 | SCR‑02 | Transaction (confirmed only, v1.3) | — | In progress |
| O2 | Budgets | UC‑06 | FR‑BUD‑001–007 | SCR‑04 | Budget, Transaction | TC‑06 | In progress |
| O2/O4 | Balances | UC‑04 | FR‑ACC‑002/003, BR‑03 | SCR‑06 | Account, Transaction (confirmed only, v1.3) | TC‑01, TC‑23 | In progress |
| O3 | Data control | UC‑08, UC‑09 | FR‑BKP‑001–011 (extended v1.3) | SCR‑08 | Account, Category, Transaction, Budget, RecurringRule, RecurringRulePausePeriod (v1.3) | TC‑09, TC‑10, TC‑20, TC‑34 | In progress |
| O3 | App-lock | UC‑11 | FR‑SEC‑001–005, FR‑SEC‑009/010 (v1.3) | SCR‑09, SCR‑11 (v1.3) | Preferences, SecureStore | TC‑11, TC‑25, TC‑26, TC‑37 | In progress |
| O4 | Recurring rules | UC‑14, UC‑15, UC‑16 | FR‑REC‑001–016 (extended v1.3), BR‑11 | SCR‑10, SCR‑05 | RecurringRule, RecurringRulePausePeriod (v1.3), Transaction | TC‑16–TC‑19, TC‑21, TC‑22, TC‑23, TC‑24 | In progress |
| — | Export | UC‑10 | FR‑PDF‑001–005 (extended v1.3) | SCR‑08, SCR‑09 | Transaction (confirmed only, v1.3) | TC‑35 | In progress |
| — | Preferences | UC‑12 | FR‑SET‑001–009 (extended v1.3) | SCR‑09 | Preferences | TC‑13, TC‑38 | In progress |
| — | Reminders | UC‑13 | FR‑NOT‑001–004 | (system) | Preferences | TC‑12 | In progress |
| — | Categories | UC‑05 | FR‑CAT‑001–007 (extended v1.3) | SCR‑07 | Category | TC‑05, TC‑32, TC‑38 | In progress |
| — | Accounts | UC‑04 | FR‑ACC‑001–009 (extended v1.3) | SCR‑06 | Account | TC‑08, TC‑32, TC‑38 | In progress |
| — | First launch | — | FR‑NAV‑004, FR‑CAT‑005 | (all) | Category (seed) | TC‑15 | In progress |
| **O3 (new, v1.3)** | **Forgot-passcode recovery** | **UC‑17** | **FR‑SEC‑009, FR‑BKP‑002/004/011** | **SCR‑11, SCR‑08** | **SecureStore, Account/Category/Transaction/Budget/RecurringRule (post-reset)** | **TC‑26** | **In progress** |
| **— (cross-cutting, new v1.3)** | **Accessibility** | **(all)** | **NFR‑07** | **(all)** | **—** | **TC‑27** | **In progress** |
| **— (cross-cutting, new v1.3)** | **Error resilience** | **(all)** | **FR‑ERR‑001, FR‑ERR‑004, FR‑ERR‑009, FR‑ERR‑010, BR‑12** | **(all)** | **Transaction, filesystem** | **TC‑22, TC‑28, TC‑30, TC‑36** | **In progress** |

**Orphaned / correctly out-of-scope (no requirement expected):** Search/filter (FR‑TRN‑011, Future — AUD‑14). Multi-currency (FR‑ACC‑008, Out of scope — AUD‑07). Server sync / multi-device / bank linking (Out of scope, Section 2). Background firing mode (FR‑REC‑012, Future — Phase 2). Widget beyond Android read-only (FR‑WDG‑003/004/005, Future). Budget rollover (FR‑BUD‑008, Future). Database/backup encryption (FR‑SEC‑006, Future). Formal accessibility conformance-level certification beyond the MVP baseline (Open question, OQ‑02).


## 18. Final Decisions and Actions

**v1.3 change (resolves Forensic Review F‑019):** every decision below now carries a named accountable **Owner/Approver** role (not a generic "PO" for every item) and a **Resolve By** milestone, in addition to the recommended answer already provided. Decisions #1–#19 are carried forward from v1.2 unchanged in substance; decisions #20–#36 are new in v1.3, one per AUD‑19…AUD‑35 item in Section 18b.

| # | Decision Needed | Recommended Answer | Owner/Approver | Resolve By | Where It's Used |
|---|---|---|---|---|---|
| 1 | Local storage technology | Expo SQLite (relational), not a plain KV store | Engineering Lead | Before design | AUD‑02; all data access |
| 2 | Free/Pro entitlement for MVP | Out of scope; unified feature set | Product Owner | Before approval | AUD‑03; Feature Catalogue |
| 3 | Encryption scope | Passcode gate only in MVP; encryption is Phase 2 | Product Owner + Security | Before approval | AUD‑04; FR‑SEC‑006 |
| 4 | Widget feasibility/scope | Android-only, read-only, deep-link only, Phase 3 | Engineering Lead | Before design (Phase 3 planning) | AUD‑05; FR‑WDG group |
| 5 | Soft QA scale targets | 500 accounts / 200 categories | QA Lead + Engineering Lead | Before QA | AUD‑06; FR‑ACC‑007/FR‑CAT‑006 |
| 6 | Backup replace vs. merge | Replace-only in MVP; merge is Phase 2 | Product Owner | Before approval | AUD‑08; FR‑BKP‑002/007 |
| 7 | Transfer accounting model | Dedicated Transfer type, excluded from aggregates | Product Owner | Before approval | AUD‑09; FR‑TRN‑007/008, BR‑02 |
| 8 | Hard-delete vs. archive | Archive-only when referenced; hard-delete only when unreferenced | Product Owner | Before approval | AUD‑10; FR‑ACC‑005/006, FR‑CAT‑004 |
| 9 | Balance computation model | Computed on read, not cached | Engineering Lead | Before design | AUD‑11; BR‑03 |
| 10 | Budget rollover | No rollover in MVP | Product Owner | Before approval | AUD‑12; FR‑BUD‑006 |
| 11 | Time-zone/day-boundary handling | UTC storage, local-time evaluation at read | Engineering Lead | Before design | AUD‑13; date grouping everywhere |
| 12 | Search/filter for MVP | Deferred to Future | Product Owner | Before approval | AUD‑14; FR‑TRN‑011 |
| 13 | MVP export format | PDF-only; CSV/XLSX is Phase 2 | Product Owner | Before approval | FR‑PDF‑003/004 |
| 14 | QA reference device tier | Mid-range Android (~3GB RAM, ≈3-year-old class) + oldest supported iOS | QA Lead | Before QA | NFR‑03/04, FR‑REC‑011 |
| 15 | Recurring-rule catch-up cap | 30 most recent missed occurrences per rule | Product Owner | Before approval | AUD‑15; FR‑REC‑004 |
| 16 | Recurring-rule backup coverage | Full inclusion (rule + pause history, v1.3) in every backup | Engineering Lead | Before development | AUD‑16; FR‑BKP‑009 |
| 17 | Recurring-rule pause-window exclusion | Permanently excluded, never backfilled | Product Owner | Before approval | AUD‑17; FR‑REC‑006 |
| 18 | Recurring-rule auto-pause on archive | Auto-pause on archive; no auto-resume on un-archive | Product Owner | Before approval | AUD‑18; FR‑REC‑008 |
| 19 | Default starter category set content | Product Owner to supply the specific list (illustrative starting point: Food, Transport, Bills, Shopping, Health, Salary, Other) | Product Owner | Before development | FR‑CAT‑005 |
| **20 (v1.3)** | **Pending vs. confirmed recurring-occurrence model** | **Three-state `status` (pending/confirmed/skipped); pending/skipped excluded from all aggregates until confirmed** | **Product Owner + Engineering Lead** | **Before design** | **AUD‑19; FR‑REC‑002/003/007/015/016** |
| **21 (v1.3)** | **RecurringRule pause-period history structure** | **New `RecurringRulePausePeriod` child table (not a boolean + timestamp)** | **Engineering Lead / Data Architect** | **Before design** | **AUD‑20; §11 Data Model** |
| **22 (v1.3)** | **Passcode lockout: counter persistence + delay duration** | **Persist in SecureStore across app kill/reboot; fixed delay = 30 seconds** | **Security-minded Engineering Lead** | **Before development** | **AUD‑21; FR‑SEC‑005** |
| **23 (v1.3)** | **Forgot-passcode / lockout recovery mechanism** | **Lock-screen "Forgot passcode?" → Delete & Reset → restore from backup; no server-side recovery** | **Product Owner + UX + Security** | **Before design** | **AUD‑22; FR‑SEC‑009** |
| **24 (v1.3)** | **MVP accessibility baseline scope** | **The 5-point NFR‑07 checklist (labels, touch targets, dynamic type, non-color indicators, contrast); formal conformance-level certification kept separate as OQ‑02** | **Product Owner + UX Lead** | **Before design** | **AUD‑23; NFR‑07** |
| **25 (v1.3)** | **Analytics/crash SDK selection + store-disclosure process** | **Sentry (RN/Expo support, configurable scrubbing); disclosure metadata reviewed every submission** | **Product Owner / Release Manager** | **Before release (SDK choice: before development)** | **AUD‑24; FR‑SET‑009** |
| **26 (v1.3)** | **Duplicate-submission protection mechanism** | **UI debounce + repository-level idempotency token (defense in depth)** | **Engineering Lead / QA** | **Before development** | **AUD‑25; FR‑ERR‑009** |
| **27 (v1.3)** | **Transfer-edit atomicity implementation approach** | **Atomic reverse-then-reapply within one SQL transaction** | **Product Owner / Engineering** | **Before development** | **AUD‑26; FR‑TRN‑013** |
| **28 (v1.3)** | **Rounding rule for non-integer arithmetic results** | **Round-half-up, centralized in one utility function (BR‑12)** | **Engineering / Product** | **Before development** | **AUD‑27; BR‑12, FR‑ERR‑001** |
| **29 (v1.3)** | **Duplicate-of-recurring-transaction behavior** | **Always clear recurringRuleId/occurrenceDate/status on duplicate** | **Engineering / Product** | **Before development** | **AUD‑28; FR‑TRN‑006/014** |
| **30 (v1.3)** | **Archived-entity visibility in pickers** | **Hidden from active pickers; retained and correct on historical records** | **Product Owner** | **Before QA** | **AUD‑29; FR‑ACC‑009/FR‑CAT‑007** |
| **31 (v1.3)** | **NFR‑03 measurable performance thresholds** | **≤16ms avg / ≤100ms max frame time; 2-second on-open check bound** | **Engineering Lead / QA** | **Before QA** | **AUD‑30; NFR‑03** |
| **32 (v1.3)** | **Formalize backward-compatible restore as a normative FR** | **New FR‑BKP‑010, codifying already-accepted §10.5 behavior — no new judgment call** | **Document Author / PM** | **Before approval** | **AUD‑31; FR‑BKP‑010** |
| **33 (v1.3)** | **Restore-time referential-integrity validation policy** | **Reject the entire restore on any unresolved foreign key (safest for financial data)** | **Engineering Lead** | **Before development** | **AUD‑32; FR‑BKP‑011** |
| **34 (v1.3)** | **PDF representation of Transfers and recurring transactions** | **Transfer as excluded-from-totals line item; recurring rows carry a text marker matching on-screen** | **Product / Design** | **Before development** | **AUD‑33; FR‑PDF‑005** |
| **35 (v1.3)** | **Objectives O1–O4 measurable rewording** | **As stated in Section 2 (v1.3)** | **Product Owner** | **Before approval** | **AUD‑34; §2 Objectives** |
| **36 (v1.3)** | **Storage-exhaustion handling policy** | **Fail gracefully, preserve prior data, discard partial output, clear message** | **Engineering / QA** | **Before development** | **AUD‑35; FR‑ERR‑010** |


## 18a. Recurring Transaction Rules — Gap Resolution Log (v1.2)

*(Unchanged from v1.2 — preserved as the historical record of the internal feasibility review performed before the Recurring Rules Addendum was merged into this document. See Section 18b for the external Forensic Review's later, separate remediation pass.)*

| ID | Gap identified in the Addendum as drafted | Risk if unresolved | Resolution adopted | Status | Ref |
|---|---|---|---|---|---|
| AUD‑15 | No cap stated on how many missed occurrences a long-dormant rule could generate at once | A rule left un-reviewed for months could flood the review batch with hundreds of entries | Cap catch-up at the 30 most recent missed occurrences per rule; older ones are skipped with a notice | Proposed decision | FR‑REC‑004; decision #15 |
| AUD‑16 | Original Addendum draft did not specify whether RecurringRule rows travel with backup/restore | A restored device could silently lose all recurring rules, breaking O4 | Backup export/import includes the full RecurringRule table under the existing schema-versioned, replace-all semantics | Proposed decision | FR‑REC‑013/BKP‑009; decision #16 |
| AUD‑17 | Pausing a rule mid-cycle left it ambiguous whether resuming would backfill the paused dates | Backfilling paused dates would silently create transactions the user deliberately opted out of | Occurrences within any paused window are never generated, even after resume | Proposed decision | FR‑REC‑006; decision #17 |
| AUD‑18 | No behavior defined for archiving an account/category an active rule depends on | A rule could keep trying to reference a now-archived entity indefinitely | Archiving auto-pauses the referencing rule; un-archiving does not auto-resume it | Proposed decision | FR‑REC‑008/013, BR‑11; decision #18 |

## 18b. Forensic Review Remediation Log (v1.3)

*(New in v1.3 — the same gap-resolution format as Section 18a, applied to the 26 findings of the external Forensic PRD/SRS Review of v1.2. Findings resolved by a direct, non-judgment-call documentation fix rather than a stakeholder decision — F‑013, F‑016, F‑019 [format change applied directly], F‑020, F‑021, F‑022, F‑023, F‑024, F‑026 — are not repeated here as AUD items; they are listed in the companion Change Log instead.)*

| ID | Forensic Review finding | Risk if unresolved | Resolution adopted | Status | Ref |
|---|---|---|---|---|---|
| AUD‑19 | F‑001 (Critical) — FR‑REC‑002 said a missed occurrence becomes an ordinary Transaction row unconditionally; FR‑REC‑003/007 implied it should wait for confirmation; no data-model field distinguished the two states | Recurring occurrences could silently distort budget/balance/analysis totals before a user ever reviewed them, directly violating Objective O4 | New `Transaction.status` (pending/confirmed/skipped); pending/skipped excluded from every aggregate and view (new FR‑REC‑015/016); BR‑03/FR‑BUD‑004/FR‑ANA‑003/FR‑PDF‑001/SCR‑01 all updated to filter on `status = confirmed` | Proposed decision | FR‑REC‑002/003/007/015/016; decision #20 |
| AUD‑20 | F‑002 (Critical) — RecurringRule stored only a boolean `isPaused`, which cannot reconstruct which calendar dates were paused if a rule is paused/resumed more than once | FR‑REC‑006's pause-window-exclusion rule could not be correctly implemented across multiple pause cycles | New `RecurringRulePausePeriod` entity records every pause/resume cycle with start/end timestamps | Proposed decision | §11 Data Model; decision #21 |
| AUD‑21 | F‑003 (High) — FR‑SEC‑005's attempt counter had no stated persistence rule across app kill/reboot, and "fixed short delay" had no actual duration | Brute-force protection could be trivially bypassed by force-quitting the app | Counter and delay-start persisted in SecureStore, surviving app kill/device restart; delay set to 30 seconds (recommended value, pending sign-off) | Proposed decision | FR‑SEC‑005; decision #22 |
| AUD‑22 | F‑004 (Critical) — No recovery path existed for a user who forgets their passcode on an offline-only app with no cloud account | A locked-out user could permanently lose all financial data | New "Forgot passcode?" affordance on the Lock Screen (SCR‑11), leading to Delete & Reset with an explicit data-loss warning, reachable pre-authentication | Proposed decision | FR‑SEC‑009; decision #23 |
| AUD‑23 | F‑005 (High) — Zero accessibility requirements existed anywhere in the document | Risk of excluding assistive-technology users; store-review and reputational risk | New NFR‑07: screen-reader labels, ≥44dp touch targets, non-color state indicators, dynamic type, 4.5:1 contrast minimum, as the MVP baseline | Proposed decision | NFR‑07; decision #24 |
| AUD‑24 | F‑006 (High) — No app-store privacy-disclosure requirement existed despite the app's own opt-in analytics feature | Store submission could be rejected or delayed independent of the general privacy-policy gate already flagged | New FR‑SET‑009 naming Sentry as the recommended SDK and requiring disclosure metadata be kept in sync with its actual behavior before every submission | Proposed decision | FR‑SET‑009; decision #25 |
| AUD‑25 | F‑007 (High) — No requirement or test protected against a duplicate transaction from a rapid double-tap of Save | Users could end up with duplicate transactions, inflating totals silently | New FR‑ERR‑009: UI debounce + repository-level idempotency-token check | Proposed decision | FR‑ERR‑009; decision #26 |
| AUD‑26 | F‑008 (High) — FR‑TRN‑010 defined atomic Transfer-delete but not Transfer-edit | A single-sided Transfer edit could break dual-account balance symmetry | New FR‑TRN‑013: atomic reverse-then-reapply for any Transfer edit | Proposed decision | FR‑TRN‑013; decision #27 |
| AUD‑27 | F‑009 (High) — No rounding rule existed for arithmetic keypad results that don't terminate exactly in the currency's minor unit, despite BR‑06 banning floating point | Two builds could store different amounts for the same division input, breaking auditability | New BR‑12: round-half-up, centralized in one utility function; FR‑ERR‑001 updated to reference it | Proposed decision | BR‑12, FR‑ERR‑001; decision #28 |
| AUD‑28 | F‑010 (Medium) — Duplicating a recurring-generated transaction had undefined recurringRuleId/status handling | Could violate the FR‑REC‑002 unique constraint or mis-tag a manual entry as recurring | FR‑TRN‑006 updated; new FR‑TRN‑014 states the duplicate always clears recurringRuleId/occurrenceDate/status | Proposed decision | FR‑TRN‑006/014; decision #29 |
| AUD‑29 | F‑011 (Medium) — TC‑08 tested archived-entity picker exclusion with no corresponding written requirement | A test case with no requirement to trace to; an engineer could reasonably skip the behavior entirely | New FR‑ACC‑009/FR‑CAT‑007 make the picker-exclusion behavior an explicit, normative requirement | Proposed decision | FR‑ACC‑009, FR‑CAT‑007; decision #30 |
| AUD‑30 | F‑012 (Medium/High) — NFR‑03's "no more than one perceptible UI stutter" was not objectively instrumentable | Inconsistent QA sign-off across testers/releases; no baseline to detect regressions against | NFR‑03 rewritten with numeric frame-time and on-open-check-duration thresholds | Proposed decision | NFR‑03; decision #31 |
| AUD‑31 | F‑014 (Medium) — Backward-compatible restore of pre-v1.2 backups was described only in the non-normative §10 engineering notes | The guarantee could silently change without triggering the §1 change-control rule, which is keyed to Section 7 | New FR‑BKP‑010 formalizes the behavior as a normative requirement | Proposed decision (formalizes already-accepted behavior) | FR‑BKP‑010; decision #32 |
| AUD‑32 | F‑015 (Medium) — No requirement addressed restore-time referential-integrity validation of an internally inconsistent (but schema-valid) backup file | Undefined behavior on restore of a corrupted-but-parseable file; could silently orphan rows or corrupt balances | New FR‑BKP‑011: validate all foreign keys resolve before committing a restore; reject the whole restore on failure | Proposed decision | FR‑BKP‑011; decision #33 |
| AUD‑33 | F‑017 (Medium) — FR‑PDF‑001 did not state how Transfers or recurring-origin markers appear on the exported PDF | A PDF could look incomplete against a bank statement, or lose the on-screen recurring-transaction traceability | New FR‑PDF‑005: Transfer as excluded-from-totals line item; recurring rows carry a matching text marker | Proposed decision | FR‑PDF‑005; decision #34 |
| AUD‑34 | F‑018 (Medium) — Objectives O1–O4 were all unapproved Assumptions with no measurable target | No verifiable anchor for downstream design/QA decisions to trace to | O1–O4 reworded with concrete, measurable bars (Section 2) | Proposed decision | §2 Objectives; decision #35 |
| AUD‑35 | F‑025 (Medium) — No requirement addressed on-device storage exhaustion during backup export, PDF generation, or a large recurring-rule catch-up batch | An unhandled disk-full condition could leave a partially-written backup or PDF, or corrupt an in-progress catch-up batch | New FR‑ERR‑010: detect and fail gracefully, leaving prior data untouched | Proposed decision | FR‑ERR‑010; decision #36 |


## Final Audit

*(Rewritten in v1.3 to correct an overstated claim the Forensic Review identified — F‑013 — and to reflect the state of the document after remediation.)*

- No leftover "MyMoney" references remain anywhere in this document (verified by full-text check).
- BR‑01 through BR‑12 do not contradict each other or any FR/NFR (verified by cross-reference; BR‑03 and BR‑12 were the two rules amended in v1.3, both to close gaps rather than to change prior intent).
- Storage responsibilities (SQLite / SecureStore / lightweight KV) are clearly separated in Section 11, including the two new v1.3 SecureStore items (attempt counter, lockout-delay start) and the two new SQLite entities (Transaction.status is a column, not a new entity; RecurringRulePausePeriod is a new entity).
- MVP / Future / Out-of-scope status is separated explicitly for every feature (Section 4) and every requirement (Section 7/8), including all v1.3 additions.
- **Given/When/Then acceptance-criteria coverage claim (corrected in v1.3):** every Critical and High finding from the Forensic Review, and every P0/P1 requirement this document or that review identified as carrying real ambiguity, now carries an explicit Given/When/Then block. This includes the v1.2 items the Forensic Review found missing one (FR‑TRN‑010, FR‑ACC‑006, FR‑CAT‑004, FR‑ERR‑004, FR‑BKP‑005/006) and every substantively new v1.3 requirement with comparable ambiguity (FR‑REC‑002/006/015, FR‑SEC‑005/009, FR‑ERR‑001/009/010, FR‑TRN‑013, FR‑BKP‑011, FR‑PDF‑005). Lower-ambiguity additions (FR‑ACC‑009, FR‑CAT‑007, FR‑TRN‑014, FR‑SET‑009, FR‑SEC‑010) are covered by a named test case (Section 15) instead, which this document considers sufficient for their ambiguity level — this is a narrower, accurate claim than v1.2's blanket statement, made narrower specifically because the Forensic Review showed the blanket version was false.
- Every in-scope requirement (Confirmed, Approved, or Proposed decision) in Section 7/8 has a Verification method, a Ref, and at least one Section 15 test case, review, demonstration, or inspection — verified by cross-reference; the v1.2 gaps the Forensic Review found (FR‑SEC‑004 had none; FR‑ACC‑004/FR‑CAT‑003/FR‑SET‑008 had none) are closed by TC‑37 (blocked pending OQ‑01, but present) and TC‑38.
- The RecurringRule field-naming inconsistency ("isArchived-source-derived" vs. "isArchivedSource") is corrected; the field is `isArchivedSource` everywhere in Section 11.
- The Table of Contents in this Markdown edition uses section-number anchors rather than page numbers, avoiding the pagination-drift risk the Forensic Review flagged (F‑023) for the Word edition of v1.2; if this document is converted to Word, generate the Table of Contents as a live field at that time.
- "Priority" on a Future-enhancement/Out-of-scope item is now explicitly stated (Section 7 preamble) to rank within that item's future phase, not MVP.
- Testing-process obligations phrased "QA shall verify…" (FR‑ACC‑007, FR‑CAT‑006, FR‑REC‑011) remain visually tagged "(QA target only)" and distinguished in the Section 7 preamble from normative product-behavior requirements.
- All ID series (FR‑TRN, FR‑REC, FR‑ACC, FR‑CAT, FR‑BUD, FR‑ANA, FR‑BKP, FR‑PDF, FR‑SEC, FR‑SET, FR‑NOT, FR‑WDG, FR‑NAV, FR‑ERR, BR, NFR, SCR, UC, TC, AUD) are unique and sequential within their series, with every v1.3 addition placed at the next available number in its own series — verified by full-document ID scan.
- Recommendations are specific and actionable enough to approve or implement directly; where a genuine stakeholder decision remains (rather than a documentation fix), it is carried in Section 18/18a/18b with a named Owner and Resolve-By stage, and duplicated, de-duplicated, into the companion Unresolved Decision Register.
- This document does not invent settled business decisions where none exists: every new v1.3 "Proposed decision" carries an explicit recommended value and an explicit approver, exactly like the v1.2 methodology already established for AUD‑01 through AUD‑18 — none is silently promoted to "Approved" or "Confirmed."

