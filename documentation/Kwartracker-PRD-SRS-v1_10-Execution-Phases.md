# Kwartracker — Execution Phases

**Companion to:** Kwartracker PRD/SRS v1.10 (the normative baseline)
**Purpose:** The order in which to build Kwartracker, what each phase delivers, and the evidence that closes it.
**Authority:** This plan sequences work; it never changes requirements. If a phase uncovers a defect or gap in the PRD/SRS, the PRD/SRS is revised first under its Section 1 change control, then this plan is updated. Requirement, test, and gate IDs below are the PRD/SRS IDs.

---

## 1. How the plan works

1. **Nine phases, zero to eight.** Each ends in a runnable *release-mode* build installed on both reference devices (PERF-01), not just green unit tests.
2. **Phases are ordered by dependency and by risk.** Money, storage, and security come before features that sit on top of them. Features that depend on everything else (assistive suggestions) come last.
3. **A phase closes only when** (a) every test listed as its "full pass" is green in CI, (b) every earlier test still passes (regression never stops), (c) the demo build works offline on both reference devices, and (d) the device evidence listed for that phase is captured. Nothing is carried forward as "will fix later."
4. **Device evidence starts early.** Performance, accessibility, and design checks are run from Phase 1, so the last phase confirms them instead of discovering problems.
5. **Sizes are relative** (S, M, L, XL), not calendar estimates. They tell you where the weight is, not how long it takes with a given team.

## 2. Phase overview

| Phase | Name | What you can demo at the end | Size | Depends on | Gates it advances |
|---|---|---|---|---|---|
| 0 | Foundation, guardrails, and de-risking spikes | A gated empty app on both devices; every risky platform assumption proven or flagged | L | — | RG-10 |
| 1 | Core ledger loop | A fully usable offline ledger: accounts, categories, income/expense/transfer, balances, Dark and Light | XL | 0 | RG-01, RG-02, RG-08, RG-09, RG-12 |
| 2 | Refunds, Budgets, and Analysis | Refund a purchase, set budgets, see spending analysis | L | 1 | RG-01, RG-02, RG-09 |
| 3 | Recurrence engine | Recurring rules that generate transactions, with a recoverable backlog | XL | 2 | RG-03 |
| 4 | Security and lock | Passcode, biometrics, lockout, auto-lock | L | 3 | RG-05 |
| 5 | Backup, restore, reset, and recovery | Export, restore, and delete-and-reset that survive being killed mid-way | XL | 4 | RG-03, RG-04 |
| 6 | Delivery services: PDF, notifications, privacy | PDF export, daily reminder, consent-gated crash reports, OS-backup exclusion | L | 5 | RG-02, RG-06, RG-07 |
| 7 | Assistive suggestions | The advisory features: duplicate warning, pace alerts, forecasts, and suggestions | L | 6 | RG-11 |
| 8 | Hardening and release candidate | Signed release candidate with the complete evidence index | L | 7 | RG-01–RG-12 |

```
0 ─► 1 ─► 2 ─► 3 ─► 4 ─► 5 ─► 6 ─► 7 ─► 8
```

**Why this order**
- Budgets and Analysis (2) need transactions and refunds, so they come after the ledger (1).
- Recurrence (3) creates transactions and touches deletion, archive, and timezones, so the ledger must be solid first.
- Security (4) comes before backup (5) because *Delete & Reset* must be authenticated (FR-SEC-007, FR-BKP-009), and because restore must normalize security state.
- Backup (5) comes after recurrence (3) so the portable schema is complete; restoring a schema that is still changing is the most expensive rework in the project.
- PDF, notifications, and privacy (6) are delivery wrappers around data that is already correct.
- Assistive features (7) read from Budgets, recurring rules, and notifications, and add nothing to the financial core, so they go last and ship behind the D-65 rollout flag.

---

## 3. Cross-cutting tracks (run in every phase)

### 3.1 Test infrastructure
| Item | Built in | Notes |
|---|---|---|
| CI with `AUTO-PR`: lint, typecheck, unit/repository/component tests, token scan | Phase 0 | Runs the affected subset on every pull request and the full suite on `main` |
| Fault-injection harness (fail between any two steps of a transaction, kill mid-write) | Phase 0 | Required by TC-07, TC-29, TC-41, TC-55, TC-65, and REC-BKP-01; build it once, early |
| PERF-01 fixture generator with a recorded seed hash (10,000 transactions, 500 accounts, 200 categories, 120 Budgets, 50 rules, 500 ledger rows) | Phase 0 | Used by TC-105, TC-21, TC-33, AUT-VER-01/02, UI-PERF-01 |
| `NIGHTLY` job (scale, replay, storage-exhaustion, journal interruption, offline) | Phase 1, grows each phase | A nightly failure blocks the next release candidate |
| `VIS-01` screenshot regression (0.1% pixel tolerance, pinned device profile) | Phase 1, baselines approved by the UX Lead each phase | Baselines for each new screen are approved in the phase that adds it |
| `RC-DEVICE` scripts on both reference devices | Phase 1, grows each phase | The same scripts become the release-candidate suite in Phase 8 |

### 3.2 Design system (Section 6A) delivery
| Phase | Design-system pieces delivered |
|---|---|
| 0 | Token source (colors, spacing, radius, type, motion), bundled Inter, Lucide icon registry with the key-to-icon table, appearance resolution (`uiMode`), lint rule banning literals outside the token source |
| 1 | PopButton, GhostButton, IconButton, Card, HeroCard, TransactionRow, Chip, SegmentedControl, AmountDisplay, AmountKeypad, TextField, ListRowToggle, Badge, EmptyState, Skeleton, Toast, Dialog, BottomSheet, tab bar, drawer, error boundary, SCR-01/05/06/07 layouts |
| 2 | ProgressBar, RankedBarRow, RankedListRow, SCR-02 and SCR-04 layouts, refund and "Net refund" display conventions |
| 3 | SCR-10 layouts, backlog review screen |
| 4 | SCR-11 lockscreen (dot indicators, lock keypad, shake, countdown) |
| 5 | SCR-08 and SCR-12 layouts, non-dismissible destructive dialogs |
| 6 | SCR-09 completion, PDF/notification/permission flows |
| 7 | Banner, SuggestedIndicator, FR-AUT alert sheet and suggestion sheet |
| 8 | `DSG-REV-01` sign-off over every screen, both appearances, default and 200% font scale |

### 3.3 Device evidence cadence
| When | Evidence |
|---|---|
| End of Phase 1 | UX-01 dry run (five O1 runs per device); Records scroll dry run; UI-PERF-01 dry run for keypad, sheets, tab switch |
| End of Phase 2 | TC-33 (scroll portion of PERF-01) formally run for Records, Analysis, Budgets |
| End of Phase 3 | TC-21 (recurrence catch-up portion of PERF-01) formally run |
| End of Phase 4 | Biometric fallback on both devices plus one additional Android OEM (INS-SEC-02); KDF timing (SEC-REV-01) |
| End of Phase 5 | Restore termination matrix on both OSes (REC-BKP-01) |
| End of Phase 6 | Notification behavior after reboot and timezone change (TC-75); OS-backup exclusion smoke test (TC-76) |
| End of Phase 7 | AUT-VER-01/02 performance budgets on the PERF-01 fixture |
| Phase 8 | Everything re-run on the final signed build |

### 3.4 Spec change control during execution
Anything that would change a requirement, data contract, test oracle, or gate requires a new document version (PRD/SRS Section 1). Keep a running **spec issue log**; batch related issues into one revision at the next phase boundary unless a defect blocks the current phase. The two items already known are in Section 4.

---

## 4. Known spec follow-ups and spikes (resolve in Phase 0)

### SF-01 — App database migration strategy (spec gap)
The PRD/SRS requires migrations to run before the integrity check (FR-ERR-003) and places them in `src/db/`, but never defines how the app's own SQLite schema is versioned between releases. That is separate from the backup format (`backupSchemaVersion = 5`).
**Recommended resolution, to be written into the next PRD/SRS revision:**
- Version the app database with SQLite's `PRAGMA user_version`.
- Keep ordered, forward-only migrations in `src/db/migrations`; each runs in one exclusive transaction and is idempotent.
- Run migrations after restore-journal recovery and before the integrity and foreign-key checks, matching FR-ERR-003.
- Refuse to open a database newer than the app understands: show an "update required" screen and change nothing.
- Add a test fixture and test per migration, run in `AUTO-PR`.
- Keep this independent of the backup schema version.

### Spikes (each has a pass condition; a failure triggers a spec revision, not a workaround)
| Spike | Question | Pass condition | Affects |
|---|---|---|---|
| S1 Staged-swap restore | Can `expo-sqlite` databases be closed, replaced atomically, and reopened (including WAL side files) on both OSes? | A database file swap survives a kill at every step with an intact old-or-new database | FR-BKP-006/007, BR-19 |
| S2 PBKDF2 at 600,000 iterations | Which implementation verifies a passcode in ≤750 ms on both reference devices, with constant-time comparison? | Measured ≤750 ms on both devices. A pure-JavaScript implementation is likely too slow on Hermes, so expect a native-backed crypto module and record its provenance | FR-SEC-002, SEC-REV-01 |
| S3 UI stack sanity | Do Reanimated, Gesture Handler, FlashList v2, Lucide per-icon imports, and Inter work together on React Native 0.86 in a *release* build? | Keypad, sheet, and a 10,000-row list meet NFR-11 on both devices | Section 6A, NFR-11 |
| S4 Notifications | Per-identifier schedule and cancel, reboot and timezone behavior, and permission flows on both OSes | Behavior matches FR-NOT-001–004 and FR-AUT-006 | FR-NOT, FR-AUT-006 |
| S5 OS backup exclusion | Can the SQLite file and SecureStore be excluded from OS backup and device transfer through config plugins? | TC-76 style smoke test passes on both OSes | FR-PRV-001, NFR-02 |
| S6 Startup path timing | How long does journal recovery → migration → integrity and foreign-key checks take on the 10,000-row fixture? | Acceptable cold start; if not, tune before building on it | FR-ERR-003, FR-NAV-002 |

---

## 5. Phase details

### Phase 0 — Foundation, guardrails, and de-risking spikes (L)

**Goal:** A skeleton nobody has to rework, plus proof that the risky platform assumptions hold.

**Scope**
- Repository on Expo SDK 57 with TypeScript and Expo Router; all route files under `src/app/` as stubs for every SCR, with the provider chain `DbGate` → `LockGate` → root stack in place and the lock gate as a pass-through.
- App configuration: portrait lock, phone-only, automatic appearance, splash, generated native folders not committed, OS-backup exclusion settings (verified in Phase 6).
- Dependencies installed with the Expo version check; first COMPAT-01 record.
- Design tokens, bundled Inter, icon registry, appearance resolution, and the literal-ban lint rule.
- Domain core, as pure functions: money in integer minor units with BR-05–BR-07 rounding and the display formatter; arithmetic expression evaluator (FR-TRN-003); accounting date and timezone rules (BR-08, FR-TRN-005); balance computation (BR-02, BR-03).
- Database core: portable tables for schema v6, migration framework (SF-01), exclusive-transaction helper with typed error codes (FR-ERR-001), idempotency-token repository base (FR-TRN-011), restore-lock hook (for FR-BKP-005 later).
- CI, fault-injection harness, PERF-01 fixture generator, and a dev-only component showcase route that is stripped from release builds.
- Spikes S1–S6 and the SF-01 decision.

**Requirements:** BR-05–BR-08 (domain), FR-TRN-003, FR-TRN-011 (repository), FR-ERR-001 (helper), FR-NAV-001 (route skeleton), FR-DSN-002 and FR-DSN-003 (token and font foundations).

**Full-pass tests:** TC-13, TC-28, TC-30, TC-39, TC-43, TC-97.
**Artifacts started:** INS-ARC-01 (first review), COMPAT-01 (first record), QA-PLAN-01 (first draft mapping every TC to a suite and owner).

**Demo:** A release build installs on both devices and opens to an empty, gated shell in the correct appearance.
**Exit:** All six spikes have recorded outcomes. SF-01 is decided. Any spike failure has a spec issue logged before Phase 1 starts.

---

### Phase 1 — Core ledger loop (XL)

**Goal:** Meet O1. A person can record an income or expense in seconds and trust the balance.

**Scope**
- Accounts and categories: create, edit, archive, restore, delete under BR-09/BR-10 for transaction references; seeded categories and the first-launch guided state.
- Transactions: Income, purchase Expense, and Transfer — create, edit, delete, duplicate; notes; accounting date and optional time; idempotent writes; storage-exhaustion handling on save.
- Preferences needed now: currency presentation, decimals (2→0→2 display without rewriting stored values), notes visibility, appearance mode.
- UI: tab shell and drawer, SCR-01 Records with keyset paging and aggregate month summary, SCR-05 entry screen with the keypad, SCR-06 Accounts, SCR-07 Categories, the SCR-09 sections that exist so far.
- Design system: the Phase 1 components in Section 3.2, including state matrix and error boundaries on every screen.

**Requirements:** BR-01–BR-04, BR-09, BR-10 (transaction side); FR-TRN-001/002/004–007, FR-TRN-008/009 (non-refund paths), FR-TRN-011; FR-ACC-001–004; FR-CAT-001–004; FR-ACC-005 and FR-CAT-005 (scale targets, verified through the PERF-01 fixture and TC-105); FR-SET-001/002; FR-NAV-002 (first-launch); FR-ERR-004; FR-DSN-001–014 for the screens that exist.

**Full-pass tests:** TC-01, TC-02, TC-03, TC-04, TC-05, TC-07, TC-08, TC-14, TC-15, TC-29, TC-31, TC-32, TC-38, TC-79, TC-98, TC-99, TC-101, TC-103, TC-105, TC-108.
**Incremental tests started** (extended with every new screen, final pass in Phase 8): TC-81, TC-100, TC-102, TC-104, TC-106, TC-107.

**Device evidence:** UX-01 dry run, Records scroll dry run, UI-PERF-01 dry run.
**Demo:** An offline ledger usable end to end in Dark and Light.
**Exit:** UX-01 dry run is within limits (at most five non-keypad activations; the design targets three). The keypad meets the NFR-11 response limit on both devices. If it does not, fix it now, because every later screen inherits these components.

---

### Phase 2 — Refunds, Budgets, and Analysis (L)

**Goal:** Insight into spending, with refunds handled exactly.

**Scope**
- Linked Expense refunds (BR-23): creation only from a confirmed purchase, cumulative over-refund guard under concurrent writes, edit and delete rules, balance and Budget effects.
- Budgets: create per category and month, spent and remaining, over-limit state, refund-aware "Net refund", unbudgeted-category list, explicit delete (FR-BUD-007).
- Analysis: Income and net Expense over a custom date range, ranked chart and full ranked list built from the same result set.
- SCR-02 and SCR-04.

**Requirements:** BR-11, BR-23, BR-02/03 refund effects; FR-TRN-008–010 (refund paths); FR-BUD-001–005, FR-BUD-007; FR-ANA-001–003; BR-10 for Budget references.

**Full-pass tests:** TC-06, TC-27, TC-33, TC-41, TC-58, TC-59, TC-60, TC-61, TC-84, TC-96.
**Legs started, completed later:** TC-57, TC-83, TC-85 (PDF and backup legs finish in Phases 5–6), TC-40 (rule leg finishes in Phase 3), TC-100 (refund display).

**Device evidence:** TC-33 formally on both devices.
**Demo:** Refund a purchase, watch Budget and Analysis totals move correctly, with the "Net refund" label appearing when it should.
**Exit:** Every refund rule is covered by an automated test that includes a race between two final refunds.

---

### Phase 3 — Recurrence engine (XL)

**Goal:** Recurring transactions that never silently lose or duplicate an occurrence.

**Scope**
- Rules and revisions, weekday-cadence scheduling in the rule's own timezone, the occurrence ledger and its dispositions, evaluation on cold launch, foreground, and first focus, the occurrence cap with a recoverable backlog, pause/resume/edit/remove, tombstones, and whole-pass atomic rollback.
- Interaction rules with the rest of the app: archive blocks, deletion of recurring-origin transactions, BR-10 references from rules and ledger rows.
- SCR-10 including backlog review (generate or exclude) and the persistent count and date-range display.

**Requirements:** BR-12–BR-17, BR-10 (rule/ledger references), BR-08 (rule timezone); FR-REC-001–016 (FR-REC-017 is deferred); FR-TRN-005 (rule zone), FR-TRN-009 (recurring deletion, BR-15); FR-ACC-003, FR-CAT-002.

**Full-pass tests:** TC-16, TC-17, TC-18, TC-19, TC-21, TC-22, TC-23, TC-24, TC-40, TC-42, TC-44, TC-45, TC-46, TC-47, TC-48, TC-49, TC-50, TC-51, TC-52, TC-54, TC-55, TC-56, TC-82.
**Legs started, completed later:** TC-53 (backup and restore legs finish in Phase 5).

**Device evidence:** TC-21 (recurrence portion of PERF-01) on both devices.
**Demo:** Create weekly rules, advance the clock, and see occurrences generated; cap a backlog and recover it by explicit user action.
**Exit:** The whole-pass rollback test (TC-55) passes with failure injected after every rule.

---

### Phase 4 — Security and lock (L)

**Goal:** An access gate that is correct, honest about its limits, and fast enough to use.

**Scope**
- Six-digit passcode enrollment and verification using the implementation chosen in spike S2 (PBKDF2-HMAC-SHA-256, 600,000 iterations, 256-bit output, constant-time comparison), with SecureStore for salt, verifier, and lockout state.
- Optional biometrics with device-credential fallback disabled.
- The persisted lockout state machine, including clock-rollback handling.
- Lock on cold launch and after 60 seconds in the background; the real `LockGate` replaces the pass-through; SCR-11.
- The "Forgot passcode" path to Delete & Reset (the destination is finished in Phase 5).
- Copy review: the app lock is never described as encryption.

**Requirements:** FR-SEC-001–009, BR-21, FR-NAV-002 (gate ordering).

**Full-pass tests:** TC-11, TC-25, TC-37, TC-70, TC-71, TC-72, TC-73, TC-106.
**Re-run:** TC-45 (recurrence evaluation after unlock now uses the real gate).
**Artifacts:** INS-SEC-01, INS-SEC-02 (both reference devices plus one additional Android OEM), INS-SEC-03, SEC-REV-01 (timing on both devices).

**Demo:** Enroll a passcode, fail attempts through the lockout tiers, restart the app mid-lockout, unlock with biometrics.
**Exit:** No financial text exists in the accessibility tree before unlock, and passcode plaintext appears in no log or storage.

---

### Phase 5 — Backup, restore, reset, and recovery (XL)

**Goal:** The user's data survives being killed at any moment, and recovery never loses the old data unless the new data is complete.

**Scope**
- Export of a canonical schema-v5 package with manifest hashes and counts; written to a temporary file, validated, then renamed.
- Restore preflight (schema, hashes, constraints, refund links, recurrence backlog), the maintenance lock, the staged swap and journal phases, automatic completion or rollback at startup, and normalization of device-local state after restore.
- Delete & Reset with authentication and its own recovery rules.
- SCR-08 (backup, restore, reset parts) and SCR-12 (pre-authentication recovery).
- Launch integrity and foreign-key checks that block the financial UI and offer restore or reset (FR-ERR-003).
- Unsupported-schema rejection (v1–v5 and unknown versions) with no change to local data.

**Requirements:** BR-18–BR-20, FR-BKP-001–011 (FR-BKP-012 deferred), FR-ERR-002, FR-ERR-003, FR-SEC-007, FR-NAV-002 (recovery gate), FR-DSN-013 (restore with unknown icon key).

**Full-pass tests:** TC-09, TC-10, TC-26, TC-34, TC-53, TC-62, TC-63, TC-64, TC-65, TC-66, TC-67, TC-68, TC-80.
**Artifacts:** REC-BKP-01 (termination matrix across every restore phase on both OSes), INS-BKP-01, INS-BKP-02.

**Device evidence:** REC-BKP-01 on both devices.
**Demo:** Export, kill the app during restore at several points, and show the old-or-new dataset every time.
**Exit:** Every restore phase has a passing termination test on both platforms, and a restore of a backup containing an unrecognized icon key succeeds.

---

### Phase 6 — Delivery services: PDF, notifications, privacy (L)

**Goal:** The remaining user-facing services, each built on data that is already trustworthy.

**Scope**
- PDF export: correct labels for Transfers, recurring purchases, and refunds; refunds subtract from Expense and never add to Income; storage-exhaustion handling.
- Daily reminder: permission handling, exactly-one scheduling, change and disable, reconciliation after restart, reboot, and timezone change.
- Privacy: OS-backup exclusion configured/tested with documented iOS limits, consent-gated crash reporting with an allowlist, opt-out, queued-file deletion, and published privacy policy and store declarations.
- SCR-09 completion (reminder, crash-report consent, passcode and biometric enrollment).

**Requirements:** FR-PDF-001–003 (FR-PDF-004 deferred), FR-NOT-001–004, FR-PRV-001–005, FR-SET-003, FR-TRN-004 (notes never logged).

**Full-pass tests:** TC-12, TC-35, TC-36, TC-57, TC-69, TC-74, TC-75, TC-76, TC-77, TC-78, TC-83, TC-85.
**Artifacts:** INS-PRV-01, INS-PRV-02, INS-PRV-03, PRIV-VER-01 (base capture paths), PRIV-VER-02.

**Device evidence:** TC-75 and TC-76 on both devices.
**Demo:** Export a PDF, enable the reminder, toggle crash-report consent.
**Exit:** Controlled-transport inspection shows only allowlisted fields; every SCR route exists and resolves (TC-78).

---

### Phase 7 — Assistive suggestions (L)

**Goal:** Helpful, strictly advisory features that cannot change financial data on their own and cannot make saving slower.

**Scope** (build in this order inside the phase, so the framework exists before the features that need it)
1. `SuggestionState` entity (Section 11 v1.7 schema), the master toggle, reset, and the arbitration queue (FR-AUT-008, FR-AUT-009, BR-26, BR-27); the D-65 rollout flag.
2. Duplicate warning on the Save path with the three-strikes counter (FR-AUT-002), within the 50 ms budget.
3. Entry-cadence nudge as an independent local notification (FR-AUT-006).
4. Category pre-fill with its own dismiss control (FR-AUT-003).
5. Budget pace (FR-AUT-004) and low-balance forecast (FR-AUT-005).
6. Dormant-entity review (FR-AUT-007).
7. Recurring-pattern suggestion (FR-AUT-001).

**Requirements:** FR-AUT-001–009, BR-24–BR-27, NFR-09, NFR-10, Section 11 `SuggestionState`.

**Full-pass tests:** TC-86, TC-87, TC-88, TC-89, TC-90, TC-91, TC-92, TC-93, TC-94, TC-95, TC-102.
**Artifacts:** INS-AUT-01, AUT-VER-01, AUT-VER-02, A11Y-AUT-01, PRIV-VER-01 (final, with FR-AUT captures).

**Device evidence:** AUT-VER-01/02 on both devices against the PERF-01 fixture.
**Demo:** Trigger each suggestion, dismiss it, and show it stays dismissed; show Save latency with the features on and off.
**Exit:** No suggestion creates, edits, or deletes financial data without an explicit user action, and no FR-AUT content appears in any crash payload.

---

### Phase 8 — Hardening and release candidate (L)

**Goal:** Turn a feature-complete build into a signed release candidate with a complete evidence index.

**Scope**
- Fix everything the earlier phases logged; no new features.
- Run the complete suites: `AUTO-PR`, `NIGHTLY`, and `RC-DEVICE` on the final signed build.
- Formal artifacts: PERF-01, PERF-GOV-01 (reference-device lifecycle review), COMPAT-01 (both OS majors per platform), UX-01 (final five runs per device), A11Y-01 (both appearances, default and 200% font scale), UI-PERF-01, DSG-REV-01, VIS-01 baseline approval, INS-ARC-01, QA-PLAN-01 final, and REL-EVD-01.
- Release material: privacy policy and store declarations matching the build, release notes and support content that explain the suggestion-history reset after restore or reinstall, copy that never claims encryption.
- Gate sign-offs RG-01 through RG-12 by their named owners.

**Full-pass tests:** every incremental test reaches its final pass: TC-81, TC-100, TC-102, TC-104, TC-106, TC-107 (and TC-98, TC-99, TC-101, TC-103, TC-105, TC-108 re-run across every screen).
**Exit:** REL-EVD-01 links a passing result for every required test and artifact; no required result is waived or marked not run; the owners sign their gates.

---

## 6. Test-to-phase map

Every test ID in the PRD/SRS (TC-20 is retired) belongs to exactly one "full pass" phase below. Incremental UI tests are started in Phase 1 and re-run on every new screen.

| Phase | Tests reaching full pass |
|---|---|
| 0 | TC-13, 28, 30, 39, 43, 97 |
| 1 | TC-01, 02, 03, 04, 05, 07, 08, 14, 15, 29, 31, 32, 38, 79, 98, 99, 101, 103, 105, 108 |
| 2 | TC-06, 27, 33, 41, 58, 59, 60, 61, 84, 96 |
| 3 | TC-16, 17, 18, 19, 21, 22, 23, 24, 40, 42, 44, 45, 46, 47, 48, 49, 50, 51, 52, 54, 55, 56, 82 |
| 4 | TC-11, 25, 37, 70, 71, 72, 73, 106 |
| 5 | TC-09, 10, 26, 34, 53, 62, 63, 64, 65, 66, 67, 68, 80 |
| 6 | TC-12, 35, 36, 57, 69, 74, 75, 76, 77, 78, 83, 85 |
| 7 | TC-86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 102 |
| 8 (final pass after incremental runs) | TC-81, 100, 104, 107 |

| Phase | Named artifacts |
|---|---|
| 0 | INS-ARC-01 (first review), COMPAT-01 (first record), QA-PLAN-01 (draft) |
| 1 | UX-01, UI-PERF-01, VIS-01 (dry runs and first baselines) |
| 4 | INS-SEC-01, INS-SEC-02, INS-SEC-03, SEC-REV-01 |
| 5 | REC-BKP-01, INS-BKP-01, INS-BKP-02 |
| 6 | INS-PRV-01, INS-PRV-02, INS-PRV-03, PRIV-VER-01 (base), PRIV-VER-02 |
| 7 | INS-AUT-01, AUT-VER-01, AUT-VER-02, A11Y-AUT-01, PRIV-VER-01 (final) |
| 8 | PERF-01, PERF-GOV-01, COMPAT-01, UX-01, A11Y-01, UI-PERF-01, DSG-REV-01, VIS-01, INS-ARC-01, QA-PLAN-01, REL-EVD-01 |

## 7. Release-gate readiness

| Gate | Evidence complete after | Notes |
|---|---|---|
| RG-01 Product behavior | Phase 8 | Needs every product FR test and the final UX-01 |
| RG-02 Financial integrity | Phase 6 | Last pieces are the PDF legs of TC-57, TC-83, TC-85 |
| RG-03 Recurrence durability | Phase 5 | The backup and restore legs of TC-53 close it |
| RG-04 Backup/recovery | Phase 6 | The storage-exhaustion leg of TC-36 covers PDF as well |
| RG-05 Security | Phase 4 | Includes the extra-OEM biometric check |
| RG-06 Privacy/store compliance | Phase 7 | PRIV-VER-01 is finalized with the FR-AUT captures |
| RG-07 Notifications | Phase 6 | |
| RG-08 Accessibility | Phase 8 | A11Y-01 in both appearances |
| RG-09 Performance/compatibility/offline | Phase 8 | PERF-01 final, COMPAT-01, UX-01, TC-81 |
| RG-10 Architecture/documentation | Phase 8 | Traceability, test ownership, REL-EVD-01 |
| RG-11 Assistive features | Phase 7 | |
| RG-12 Design system and UI quality | Phase 8 | Incremental from Phase 1 |

## 8. Risk register

| # | Risk | Where it bites | Mitigation |
|---|---|---|---|
| R1 | Passcode verification cannot reach ≤750 ms at 600,000 iterations | Phase 4 | Spike S2 in Phase 0; if no implementation meets it, raise a spec revision before building the lock screen |
| R2 | Database file swap is not atomic or reliable on one OS | Phase 5 | Spike S1 in Phase 0; the restore design depends on it |
| R3 | Keypad or list does not meet NFR-11 on the mid-range Android reference device | Phase 1 and later | Spike S3 and the Phase 1 exit check; fix the shared components before more screens are built on them |
| R4 | Schema churn after backup is built | Phase 5 | Backup comes after recurrence; any later schema change reopens backup, restore, and fixtures |
| R5 | Recurrence edge cases (timezones, DST, cap, deletion, restore) | Phase 3 | Fault-injection harness from Phase 0; whole-pass rollback test; TC-42 across timezones |
| R6 | Notification delivery varies by OEM battery policy | Phase 6, 7 | The spec already states OS control of delivery; verify on both devices and keep copy honest |
| R7 | A library upgrade or renamed Lucide icon breaks the build | Any | Versions pinned through the Expo version check; TC-107 fails the build on a missing icon |
| R8 | Assistive features slow the Save path | Phase 7 | The 50 ms budget is tested by AUT-VER-02 before the phase closes |
| R9 | Late-found defects pile up in Phase 8 | Phase 8 | Device evidence from Phase 1; no phase closes with open defects |
| R10 | Spec and code drift | All | Spec issue log; versioned revisions at phase boundaries |

## 9. Definitions

**A story is done when**
- Its tests (named in Section 6) are automated and green in CI.
- It uses only tokens and catalogue components, with no literals outside the token source.
- It has accessible names, roles, and states, and works in Dark and Light and at 200% font scale.
- Every data screen it touches has loading, empty, error, and content states.
- Every write is transactional and idempotent where the PRD/SRS requires it; failures return stable error codes.
- Nothing sensitive reaches a log, a crash payload, or telemetry.

**A phase is done when**
- All its full-pass tests are green and every earlier test still passes.
- The release-mode demo works offline on both reference devices.
- The device evidence for the phase (Section 3.3) is captured and stored.
- Any spec issue found has been logged, and anything blocking is resolved in a new PRD/SRS version.

## 10. Where work can run in parallel

The phases are sequential for *closing*, but inside a phase these streams are independent and can proceed at the same time:
- **Phase 0:** tokens and fonts, domain core, database core, CI and fault harness, and each spike.
- **Phase 1:** account/category screens, the entry screen and keypad, Records list and paging, and Preferences.
- **Phase 2:** refunds, Budgets, and Analysis, once the refund repository rules exist.
- **Phase 3:** the scheduling and ledger engine versus the SCR-10 and backlog UI, once the engine's interface is fixed.
- **Phases 4–6:** security and the early parts of PDF and notification work do not depend on each other, but each phase closes in order.


## 11. v1.10 contract and verification amendments

This section adds mandatory work to the phases above. It does not create a competing baseline; the [v1.10 PRD/SRS](Kwartracker-PRD-SRS-v1_10.md), [v6 contract](contracts/Backup-v6.md), and JSON Schema define the outcomes. Phase exits include every item below in addition to the original tests. Earlier v5/generic old-or-new wording in historical phase descriptions is replaced by v6 and the phase-specific pre/post-DB_COMMITTED outcomes.

| Phase | Added scope | Full-pass assertions / evidence | Accountable owner |
|---|---|---|---|
| 0 | Review current authorization/provenance limits and actual prior v5 deployment; spike native journal/durability/WAL/backup-metadata/secret-clear primitives; freeze v6 wire contract before exporting user data | DOC-VER-01 document leg, COMPAT-BKP-01 investigation, PLAT-VER-01 prototype | Engineering Lead + Requirements Owner; Product/Release for compatibility |
| 1 | Signed opening balances, exact monetary limits/aggregates, immutable category type and explicit seeds; WriteReceipt infrastructure; independent date correction | TC-111/113/114; TC-110 transaction leg | Engineering Lead + Product Owner |
| 2 | Refund date correction across months, archived historical references, O2 two-view measurement | TC-110/118; TC-109 pre-backup leg | Engineering Lead + QA Lead |
| 3 | Sequenced same-boundary revisions, fixed rule timezone, confirmation policy snapshots, pending amount override and initial cursor | TC-50/112; TC-111 confirm/backlog legs | Engineering Lead / Data Architect + QA Lead |
| 4 | Gate all services during recovery; credential/lockout normalization retry harness | TC-117 SecureStore leg; existing security tests | Security Owner + Engineering Lead |
| 5 | Canonical schema v6, consistent export snapshot, archived round trip, receipts, replacement preview/auth/cancel, per-phase commit/recovery and all device-state normalization; invalidate old drafts | TC-109/111/112/115/116/119; TC-65/66/117; REC-BKP-01; INS-BKP-01/02 | Engineering Lead + QA Lead |
| 6 | Cancel reminder/inactivity requests on committed restore; no stale consent/queue/init; reapply iOS metadata and disclose its limit | TC-76/117 notification/privacy legs; PLAT-VER-01 final; PRIV-VER-02 acknowledgement | Privacy Owner + Security Owner + Release Manager |
| 7 | Restore/reset defaults assistive OFF, no SuggestionState restored; no Transfer-rule forecast input; resumed suggestions use normal writes and receipts | TC-93/111/117; existing FR-AUT tests | Engineering Lead + QA Lead |
| 8 | Full 119-ID accounting (118 active, TC-20 retired), assertion-to-procedure mapping, all gate approvals and device evidence; exclude Deferred SCR-03 from MVP screen checks | TC-109–TC-119 final runs; QA-PLAN-01; DOC-VER-01; REL-EVD-01 | Existing RG-01–RG-12 owners |

No output from fixture/document tooling alone closes a device or application test. Failed native feasibility, actual legacy-user compatibility requirements, or unsupported privacy copy must be resolved before the dependent phase/gate passes.
