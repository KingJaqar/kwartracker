# Kwartracker — Execution Phases

**Companion to:** Kwartracker PRD/SRS v1.11.1 (the normative baseline)
**Scope:** Android EAS cloud Build and internal APK installation only. No store uploads (including Google Play test tracks), TestFlight, OTA publishing, public hosting or production deployment. The PRD Section 16 applicability table defers iOS/store-specific legs for this milestone.

**Maintenance revision:** 1.11.1; requested filenames retained. Shared workflow lives in Section 3.5; Section 6 owns final scenario eligibility.

**Purpose:** The order in which to build Kwartracker, what each phase delivers, and the evidence that closes it.
**Authority:** This plan sequences work; it never changes requirements. If a phase uncovers a defect or gap in the PRD/SRS, the PRD/SRS is revised first under its Section 1 change control, then this plan is updated. Requirement, test, and gate IDs below are the PRD/SRS IDs.

---

## 1. How the plan works

1. **Nine phases, zero to eight.** Each ends with the required Android evidence on an EAS-built internal APK: the development profile supports daily Metro work; the standalone validation profile supplies final offline/performance/native acceptance. Follow PRD Section 16 applicability; no store or production deployment closes a phase.
2. **Phases are ordered by dependency and by risk.** Money, storage, and security come before features that sit on top of them. Features that depend on everything else (assistive suggestions) come last.
3. **A phase closes only when** (a) every applicable assertion in its listed "full pass" scenarios has passing evidence in its required automated or device environment, (b) earlier affected assertions and required regression suites have passing evidence tied to the current source/build/environment under Section 3.5, (c) the demo build works offline on active Android reference/compatibility devices, and (d) the device evidence listed for that phase is captured. Nothing is carried forward as "will fix later."
4. **Device evidence starts early.** Performance, accessibility, and design checks are run from Phase 1, so the last phase confirms them instead of discovering problems.
5. **Sizes are relative** (S, M, L, XL), not calendar estimates. They tell you where the weight is, not how long it takes with a given team.

## 2. Phase overview

| Phase | Name | What you can demo at the end | Size | Depends on | Gates it advances |
|---|---|---|---|---|---|
| 0 | Foundation, guardrails, and de-risking spikes | A gated empty app on active Android reference/compatibility devices; every risky platform assumption proven or flagged | L | — | RG-10 |
| 1 | Core ledger loop | A fully usable offline ledger: accounts, categories, income/expense/transfer, balances, Dark and Light | XL | 0 | RG-01, RG-02, RG-08, RG-09, RG-12 |
| 2 | Refunds, Budgets, and Analysis | Refund a purchase, set budgets, see spending analysis | L | 1 | RG-01, RG-02, RG-09 |
| 3 | Recurrence engine | Recurring rules that generate transactions, with a recoverable backlog | XL | 2 | RG-03 |
| 4 | Security and lock | Passcode, biometrics, lockout, auto-lock | L | 3 | RG-05 |
| 5 | Backup, restore, reset, and recovery | Export, restore, and delete-and-reset that survive being killed mid-way | XL | 4 | RG-03, RG-04 |
| 6 | Delivery services: PDF, notifications, privacy | PDF export, daily reminder, consent-gated crash reports, OS-backup exclusion | L | 5 | RG-02, RG-06, RG-07 |
| 7 | Assistive suggestions | The advisory features: duplicate warning, pace alerts, forecasts, and suggestions | L | 6 | RG-11 |
| 8 | Hardening and internal validation candidate | Signed internal validation candidate with the complete evidence index | L | 7 | RG-01–RG-12 |

```
0 ─► 1 ─► 2 ─► 3 ─► 4 ─► 5 ─► 6 ─► 7 ─► 8
```

**Why this order**
- Budgets and Analysis (2) need transactions and refunds, so they come after the ledger (1).
- Recurrence (3) creates transactions and touches deletion, archive, and timezones, so the ledger must be solid first.
- Security (4) comes before backup (5) because *Delete & Reset* must be authenticated (FR-SEC-007, FR-BKP-009), and because restore must normalize security state.
- Backup (5) comes after recurrence (3) so the portable schema is complete; restoring a schema that is still changing is the most expensive rework in the project.
- PDF, notifications, and privacy (6) are delivery wrappers around data that is already correct.
- Assistive features (7) read from Budgets, recurring rules, and notifications, and add nothing to the financial core, so they go last and ship behind D-65 local build-time rollout control only; no remote-config service or new backend.

---

## 3. Cross-cutting tracks (run in every phase)

### 3.1 Test infrastructure
| Item | Built in | Notes |
|---|---|---|
| CI with `AUTO-PR`: lint, typecheck, unit/repository/component tests, token scan | Phase 0 | Runs the affected subset on every pull request and the full suite on `main` |
| Fault-injection harness (fail between any two steps of a transaction, kill mid-write) | Phase 0 | Required by TC-07, TC-29, TC-41, TC-55, TC-65, and REC-BKP-01; build it once, early |
| PERF-01 fixture generator with a recorded seed hash (10,000 transactions, 500 accounts, 200 categories, 120 Budgets, 50 rules, 500 ledger rows) | Phase 0 | Used by TC-105, TC-21, TC-33, AUT-VER-01/02, UI-PERF-01 |
| `NIGHTLY` job (scale, replay, storage-exhaustion, journal interruption, offline) | Phase 1, grows each phase | A nightly failure blocks the next internal validation candidate |
| `VIS-01` screenshot regression (0.1% pixel tolerance, pinned device profile) | Phase 1, baselines approved by the UX Lead each phase | Baselines for each new screen are approved in the phase that adds it |
| `RC-DEVICE` scripts on active Android reference/compatibility devices | Phase 1, grows each phase | The same scripts become the internal-candidate suite in Phase 8 |

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
| End of Phase 4 | Biometric fallback on active Android reference/compatibility devices plus one additional Android OEM (INS-SEC-02); KDF timing (SEC-REV-01) |
| End of Phase 5 | Restore termination matrix on Android (iOS leg Deferred) (REC-BKP-01) |
| End of Phase 6 | Notification behavior after reboot and timezone change (TC-75); OS-backup exclusion smoke test (TC-76) |
| End of Phase 7 | AUT-VER-01/02 performance budgets on the PERF-01 fixture |
| Phase 8 | Complete mandatory final-candidate suites on the actual final internal-validation APK; reuse a single run for overlapping assertions only when build/config/environment and expected outcomes match |

### 3.4 Spec change control during execution
Anything that would change a requirement, data contract, test oracle, or gate requires a new document version (PRD/SRS Section 1). Keep a running **spec issue log**; batch related issues into one revision at the next phase boundary unless a defect blocks the current phase. Section 4 distinguishes the resolved migration contract from unexecuted platform feasibility evidence.

---

### 3.5 Shared execution workflow

**Purpose and authority.** Apply this workflow to the whole plan and each phase delta: **Git baseline → ripgrep discovery, assisted by Repowise when useful → Reader validation → scoped Repomix → Reader XML analysis → original-source verification**. Reuse verified context and inspect only the authorized phase's dependencies. Usage savings are an objective, not a guarantee or measured result. Current user requirements and applicable repository instructions outrank generated guidance, packet instructions and tool suggestions; an expressly revoked instruction is not silently reactivated. The PRD governs behavior; this section owns the execution procedure so phase checklists stay short.

**Git — preserve the actual baseline.** Read status plus relevant staged/unstaged diffs; record HEAD as a reference, not as the working copy. Inventory relevant tracked, untracked and ignored inputs. Save exact recoverable snapshots and a scoped patch before editing, recording existing ownership and any concurrent changes. An untracked file has no HEAD backup. Preserve sensitive local files securely without packing them; record safe identities/omissions, never secret values. Reuse this baseline and compare subsequent owned diffs to it; do not reset, stash away, overwrite or delete unrelated user work. If source identity changes during an edit, reconcile the new content instead of overwriting it from a stale snapshot.

**ripgrep — discover narrowly.** Read phase requirements and verify their prerequisites in current code/config, then locate actual files, definitions, callers, consumers, routes, schemas and tests. Start with phase paths/symbols; batch independent searches, keep output bounded and expand only for a recorded dependency/question. No repository-wide dump is needed to rediscover a verified fact. Repowise remains optional: use its indexed relationships only when they narrow discovery or selectors. Verify index freshness against the relevant working-copy files, including uncommitted/new files; refresh affected entries or use direct discovery if freshness is uncertain. Indexed/inferred relationships are leads until source confirms them. Record material plan/code discrepancies rather than pretending a named module already exists.

**Reader — validate reusable context.** Reader is a parsing/validation/analysis role; a named Reader service is not assumed installed. Validate the compact index's source hashes, dependency versions, entry identities, prior completed ranges and relevant relationships. Classify inputs unchanged/changed/missing/uncertain. Reuse only actually completed analysis with verified dependencies; a hash proves content identity, not correctness or completeness. Invalidate dependent findings when their inputs change. Record Repowise scope/freshness when used. A prior phase PASS or graph edge is not prerequisite/acceptance evidence by itself.

**Repomix — prepare only missing context.** Repomix is required for scoped XML context, using a pinned installed/cached version and recorded flags. Keep security checks, built-in exclusions and applicable gitignore rules enabled; explicitly exclude secrets, financial data, databases, keys, generated native/build output and unrelated directories. Select confirmed requirements, instructions, contracts, consumers and tests; do not include a whole historical library. Record intended selectors, actual included paths, source hashes, packet SHA-256/tool version/config, security result, generation exit status, token estimate and omissions; reconcile expected-versus-actual entries. If a file is deliberately range-extracted, record exact original ranges and all omitted portions. Prefer a supplemental packet for changed/missing inputs. Retain historical packet IDs and mark supersession; avoid repacking unchanged inputs just to refresh a timestamp. If the cached tool is unavailable or security excludes a required file, record the gap and continue only independent work; complete the required packet step before dependent edits. Do not relabel a hand-built XML file as Repomix or disable scanning to force an unexplained omission through.

**Reader — read and analyze the XML.** Extract at most **12,000 characters or 200 lines, whichever is reached first**, initially. Record packet/entry identity, first/last extracted line or character, extraction counts, explicit continuation boundary and whether the required entry is complete. Continue from the next boundary until every required entry/range has been read; never silently truncate or call a partial read complete. Split an individual overlong line by character offsets if needed. A larger justified chunk is allowed only with its reason/coverage recorded. Reuse unchanged analyzed entries rather than replaying an entire packet. Tie concise findings to requirement IDs and original-source locations; record compression/range omissions and uncertainty. Packet token estimates are not actual model usage and do not prove savings.

**Original source — close gaps and implement.** Inspect omitted bodies, handlers, effects, validation, styles and cleanup only when they affect the phase. Resolve uncertain relationships against current source/schema/config and relevant version-matched authoritative docs. Before editing, run relevant existing checks once and preserve exact commands, exit status, diagnostics, input identities and environment. An already verified run with matching source/build/environment may be reused with its evidence link. Implement the smallest complete authorized change; review the owned diff, confirm every acceptance assertion and rerun affected checks after the change. Broaden only for shared behavior, a failure, an unresolved risk, required cadence or the final-candidate suite. Repeat a check only after relevant change, diagnosed failure, required cadence or another concrete recorded reason; retain full diagnostics privately so recovering truncated output does not require rerunning the operation. Reuse CI/device evidence only for matching artifacts/assertions; actual build changes still require the specified final acceptance coverage. Never trade security/correctness/acceptance for lower usage.

**Bounded work, cleanup and handoff.** A phase checkpoint is scope baseline → identified gap → minimal change → affected evidence → exit review, with no automatic restart of the workflow or repeated unchanged tool/build/test submission. Diagnose a failure and change a relevant input/external condition before retry; when independent progress is exhausted, report the exact missing prerequisite without claiming completion. Runtime recovery follows PRD Section 12/FR-ERR-005, not an unbounded retry helper. Raw internal error codes stay in sanitized evidence, while UI uses plain explanations. Remove superseded helpers/routes/files only after an ownership check, reference search (imports/routes/tests/config/docs), replacement acceptance and a recoverable snapshot; remove stale imports/config references in the same owned change. Historical baselines, contracts, the supplied guide, user-owned changes and recovery data are not automatically unused. No broad directory deletion or deletion solely to reduce context size is authorized.

**Tool/environment applicability.** MuMuPlayer may be the main repeatable Android emulator for development, seeded functional checks, UI navigation and applicable fault injection. Record image/API/ABI, emulator/version/host, APK variant/hash and missing native services; install an EAS-built APK instead of compiling locally. Real-device performance, biometric hardware/OEM behavior, reboot/backup/scheduler and mandatory physical OS compatibility still require physical evidence. Docker is optional for applicable isolated domain/schema/repository tests and does not emulate Android security/storage. Brave/browser automation is permitted only for a discovered authorized browser surface; this plan adds no web/admin app or deployment. A tool permission is not a new feature or a passed gate. EAS cloud Build/internal APK restrictions in Section 12 remain unchanged.

**Compact context index.** Maintain [execution-context/index.json](execution-context/index.json) as current facts, not repeated narratives. Minimum fields: phase/revision/scope; Git reference plus working-copy input identities/ownership and safe snapshot/patch references; applicable/revoked instructions; dependency/tool versions; discoveries and verified callers/consumers; packet identities/selectors/actual contents/security/omissions; completed read ranges and continuation status; findings with source locations and dependency hashes; changed/invalidated facts; check command/environment/result/evidence and reuse reason; unresolved questions and next gates. Local packet/snapshot locations are references, not committed sensitive payloads. A missing cache path requires regeneration/verification, not fabricated reuse. Update changed facts in place, keep historical packet IDs identifiable, and link full logs externally rather than copying them into every phase. Never store credentials, raw private financial data or unrelated repository context in the index.

## 4. Foundation decisions and feasibility spikes

### SF-01 — App database migration strategy resolved

PRD FR-ERR-005 and Section 12 now define the app-local migration contract: PRAGMA user_version, initial app schema 1, recognized sources, complete forward-only atomic chain, preserved unsupported/newer databases and no repeat on an already-current open. Portable backup schema stays v6. Implement and fault-test this in Phase 0 with TC-122 and use it for Phase 5 staging; do not defer the decision or infer mappings from backup versions. Phase 0 may use synthetic migration harness fixtures; every real supported version later added must receive matching source/target fixtures and tests before use.

### Spikes (each has a pass condition; a failure triggers a spec revision, not a workaround)
| Spike | Question | Pass condition | Affects |
|---|---|---|---|
| S1 Staged-swap restore | Can `expo-sqlite` databases be closed, replaced atomically, and reopened (including WAL side files) on Android (iOS leg Deferred)? | An isolated synthetic harness demonstrates each pre/post-DB_COMMITTED dataset/device-state outcome from PRD Section 12; prototype evidence does not close the later full recovery suite | FR-BKP-006/007, BR-19 |
| S2 PBKDF2 at 600,000 iterations | Which implementation verifies a passcode in ≤750 ms on active Android reference/compatibility devices, with constant-time comparison? | Measured ≤750 ms on active Android reference/compatibility devices. Select only from measured implementations, record dependency provenance and constant-time review; do not claim a pure-JS/native timing result without a run | FR-SEC-002, SEC-REV-01 |
| S3 UI stack sanity | Do Reanimated, Gesture Handler, FlashList v2, Lucide per-icon imports, and Inter work together on React Native 0.86 in an EAS internal-validation APK? | An isolated nonshipping prototype with synthetic input demonstrates the NFR-11 interactions/scale on required physical Android evidence; it does not require the completed Phase 1 product screens | Section 6A, NFR-11 |
| S4 Notifications | Per-identifier schedule and cancel, reboot and timezone behavior, and permission flows on Android (iOS leg Deferred) | Synthetic native schedule/cancel/permission probes support feasibility; full product reconciliation and inactivity tests remain in Phases 6–7 | FR-NOT, FR-AUT-006 |
| S5 OS backup exclusion | Can the SQLite file and SecureStore be excluded from OS backup and device transfer through config plugins? | TC-76 style smoke test passes on Android (iOS leg Deferred) | FR-PRV-001, NFR-02 |
| S6 Startup path timing | How long does journal recovery → migration → integrity and foreign-key checks take on the 10,000-row fixture? | Record five cold-start stage timings on the versioned 10,000-row fixture; prove gate ordering/one migration pass and existing NFR-11 responsiveness where measured. No separate subjective or invented cold-start-duration gate applies | FR-ERR-003, FR-NAV-002 |

---

## 5. Phase details

### Phase 0 — Foundation, guardrails, and de-risking spikes (L)

**Execution checklist** — apply shared Section 3.5 once, then only this phase’s delta.

| Check | Phase-specific obligation |
|---|---|
| Scope/prerequisites | Existing starter app; documented EAS project/variant prerequisites and safe baseline. Implement foundations/probes only, not future product screens. |
| Context inputs | package.json/lock, app config, build workflow/guide hash, v6 contract, domain/db/test skeletons; existing verified metadata before expanding. |
| Baseline | Run available config/type/domain/fixture checks once; record missing scripts separately from PASS. Migration failure probes use synthetic data. |
| Acceptance/cleanup | Complete TC-120/122 and native prerequisite probe evidence. Other listed Phase 0 legs are partial; cache/snapshot/index handoff via Section 3.5. |


**Goal:** A reproducible Android EAS cloud development-build/install/Metro workflow and standalone internal-validation APK, plus the foundation and native feasibility evidence required before Phase 1.

**Scope**
- Repository on Expo SDK 57 with TypeScript and Expo Router; all route files under `src/app/` as stubs for every implemented MVP SCR (Deferred SCR-03 excluded), with the provider chain `DbGate` → `LockGate` → root stack in place and the lock gate as a pass-through.
- App configuration: portrait lock, phone-only, automatic appearance, splash, generated native folders not committed, OS-backup exclusion settings (verified in Phase 6).
- Dependencies installed with the Expo version check; first COMPAT-01 record.
- Design tokens, bundled Inter, icon registry, appearance resolution, and the literal-ban lint rule.
- Domain core, as pure functions: money in integer minor units with BR-05–BR-07 rounding and the display formatter; arithmetic expression evaluator (FR-TRN-003); accounting date and timezone rules (BR-08, FR-TRN-005); balance computation (BR-02, BR-03).
- Database core: portable tables for schema v6, migration framework (SF-01), exclusive-transaction helper with typed error codes (FR-ERR-001), idempotency-token repository base (FR-TRN-011), restore-lock hook (for FR-BKP-005 later).
- CI, fault-injection harness, PERF-01 fixture generator, and a dev-only component showcase route that is absent from internal-validation APKs.
- Spikes S1–S6 and the FR-ERR-005 migration implementation.

#### Phase 0 Android development-build setup from the supplied guide

Read [Expo Android Development Build Guide](../documentation_guides/expo-android-development-build-guide.docx) and follow [Android EAS Build Workflow](Android-EAS-Build-Workflow.md). Use the existing G:\codebase\kwartracker project; do not scaffold a replacement. Select guide Step 5B (EAS cloud), then its Steps 6–9. Step 5A/local native compilation is outside this milestone.

1. Record SDK/package-manager/CLI versions; preserve app config and select distinct stable development/validation Android package IDs and schemes via APP_VARIANT, preserving the base identity and data-bearing installs. Install SDK-compatible expo-dev-client with Expo's installer when Phase 0 is actually executed.
2. Login/verify the intended Expo account, configure/link its EAS project and record real identifiers. Audit effective build profiles after build:configure: retain only the development and validation internal APK profiles from the [example](contracts/eas-build-profiles.example.json). Remove generated production/submit entries; inspect hooks/CI and disable auto-submit/OTA/hosting actions. No Google Play or Apple credentials/account are needed.
3. Build using `npx eas-cli@latest build --platform android --profile development`, install the private APK, then set APP_VARIANT=development in the Metro terminal and run `npx expo start --dev-client --lan` and open this session's QR/URL in the installed app. Record APK hash, build ID, signing-identity metadata, device/install/launch and Metro result in BUILD-VER-01.
4. Verify daily startup, Fast Refresh, private-network/firewall checks, --clear, optional tunnel/data-flow acknowledgement, and native-change rebuild triggers. Rebuild via EAS only; do not assume an old APK contains a new native module.
5. Build the validation profile through EAS cloud, install its standalone APK, stop Metro/remote debugging, enter airplane mode and cold-launch the available gated shell. Record actual bundled-JS/release-mode/runtime flags. This verifies the shell only; feature-specific offline/performance/native tests repeat as each feature arrives.
6. Never invoke store upload, EAS Submit/auto-submit, a Google Play test track, TestFlight, OTA publishing or hosting deployment. These are explicit exclusions throughout Phases 0–8; building/signing an APK never grants publication authority.

**Added requirements:** FR-DEV-001–007, Section 16 platform/store applicability. **Added evidence:** TC-120 complete setup/profile/install/Metro; TC-121 shell/runtime legs only (whole scenario completes in Phase 8). **Added artifact:** BUILD-VER-01 (Engineering Lead + QA Lead). No APK/cloud build is claimed until those actual runtime results exist.

**Requirements:** BR-05–BR-08 (domain), FR-TRN-003, FR-TRN-011 (repository), FR-ERR-001 (helper), FR-ERR-005 (app-local migrations), FR-NAV-001 (route skeleton), FR-DSN-002 and FR-DSN-003 (token and font foundations).

**Full-pass tests:** TC-120, TC-122. Whole-case PASS requires every assertion in its PRD oracle.
**Partial probes:** TC-13/28/30/39/43/97 domain/token/repository legs and TC-121 shell only; no whole-case PASS before prerequisites.
**Artifacts started:** INS-ARC-01 (first review), COMPAT-01 (first record), QA-PLAN-01 (first draft mapping every TC to a suite and owner).

**Demo:** Install/open the EAS development APK through Metro, then stop Metro and cold-launch the separate validation APK offline on the active Android reference device; show the empty gated shell in the correct appearance.
**Exit:** TC-120 and TC-121 Phase 0 legs have actual APK/install/runtime evidence; BUILD-VER-01 confirms only internal EAS APK profiles/workflows. All six spikes have recorded Android outcomes (iOS legs explicitly Deferred). FR-ERR-005/TC-122 are implemented and pass for the available schema paths. Any failed prerequisite blocks dependent work until resolved by measured fix or authorized requirements revision; logging a failure alone does not close Phase 0.

---

### Phase 1 — Core ledger loop (XL)

**Execution checklist** — apply shared Section 3.5 once, then only this phase’s delta.

| Check | Phase-specific obligation |
|---|---|
| Scope/prerequisites | Phase 0 prerequisites pass; implement only the existing core ledger/accounts/categories and their UI. |
| Context inputs | Actual transaction/account/category repositories, their callers, records/input routes, tokens, formatter, receipt base and tests; no rules/PDF dump. |
| Baseline | Reuse Phase 0 identity-verified context; run relevant pre-edit ledger/UI checks once and record source/build/environment. |
| Acceptance/cleanup | Complete this phase’s Section 6 cases and available physical UI metrics; retain partial clone/rule/restore/screen legs for their final phase; remove only proven owned replacement debris. |


**Goal:** Meet O1. A person can record an income or expense in seconds and trust the balance.

**Scope**
- Accounts and categories: create, edit, archive, restore, delete under BR-09/BR-10 for transaction references; seeded categories and the first-launch guided state.
- Transactions: Income, purchase Expense, and Transfer — create, edit, delete, duplicate; notes; accounting date and optional time; idempotent writes; storage-exhaustion handling on save.
- Preferences needed now: currency presentation, decimals (2→0→2 display without rewriting stored values), notes visibility, appearance mode.
- UI: tab shell and drawer, SCR-01 Records with keyset paging and aggregate month summary, SCR-05 entry screen with the keypad, SCR-06 Accounts, SCR-07 Categories, the SCR-09 sections that exist so far.
- Design system: the Phase 1 components in Section 3.2, including state matrix and error boundaries on every screen.

**Requirements:** BR-01–BR-04, BR-09, BR-10 (transaction side); FR-TRN-001/002/004–007, FR-TRN-008/009 (non-refund paths), FR-TRN-011; FR-ACC-001–004; FR-CAT-001–004; FR-ACC-005 and FR-CAT-005 (scale targets, verified through the PERF-01 fixture and TC-105); FR-SET-001/002; FR-NAV-002 (first-launch); FR-ERR-004; FR-DSN-001–014 for the screens that exist.

**Full-pass tests:** TC-01, TC-02, TC-03, TC-04, TC-05, TC-07, TC-08, TC-13, TC-15, TC-28, TC-29, TC-30, TC-39, TC-79, TC-97, TC-101, TC-103, TC-105, TC-113, TC-114. Whole-case PASS requires every assertion in its PRD oracle.

**Device evidence:** UX-01 dry run, Records scroll dry run, UI-PERF-01 dry run.
**Demo:** An offline ledger usable end to end in Dark and Light.
**Exit:** UX-01 dry run is within limits (at most five non-keypad activations; the design targets three). The keypad meets the NFR-11 response limit on active Android reference/compatibility devices. If it does not, fix it now, because every later screen inherits these components.

---

### Phase 2 — Refunds, Budgets, and Analysis (L)

**Execution checklist** — apply shared Section 3.5 once, then only this phase’s delta.

| Check | Phase-specific obligation |
|---|---|
| Scope/prerequisites | Core ledger dependencies pass; implement refunds, Budgets and Analysis only. |
| Context inputs | Refund original/receivers, Budget/Analysis query consumers, date/money helpers, affected screens and fixtures. |
| Baseline | Confirm linked-refund/domain prerequisites in current code and baseline affected accounting tests once. |
| Acceptance/cleanup | Exact refund/concurrency/range tests and current performance/accessibility evidence pass; PDF/restore legs stay partial; update context/owned diff. |


**Goal:** Insight into spending, with refunds handled exactly.

**Scope**
- Linked Expense refunds (BR-23): creation only from a confirmed purchase, cumulative over-refund guard under concurrent writes, edit and delete rules, balance and Budget effects.
- Budgets: create per category and month, spent and remaining, over-limit state, refund-aware "Net refund", unbudgeted-category list, explicit delete (FR-BUD-007).
- Analysis: Income and net Expense over a custom date range, ranked chart and full ranked list built from the same result set.
- SCR-02 and SCR-04.

**Requirements:** BR-11, BR-23, BR-02/03 refund effects; FR-TRN-008–010 (refund paths); FR-BUD-001–005, FR-BUD-007; FR-ANA-001–003; BR-10 for Budget references.

**Full-pass tests:** TC-06, TC-27, TC-33, TC-41, TC-58, TC-59, TC-60, TC-61, TC-84, TC-96, TC-118. Whole-case PASS requires every assertion in its PRD oracle.

**Partial legs:** TC-40 manual/refund validation and TC-57/83/85 PDF/restore comparisons remain pending until their Section 6 phase.
**Device evidence:** TC-33 formally on active Android reference/compatibility devices.
**Demo:** Refund a purchase, watch Budget and Analysis totals move correctly, with the "Net refund" label appearing when it should.
**Exit:** Every refund rule is covered by an automated test that includes a race between two final refunds.

---

### Phase 3 — Recurrence engine (XL)

**Execution checklist** — apply shared Section 3.5 once, then only this phase’s delta.

| Check | Phase-specific obligation |
|---|---|
| Scope/prerequisites | Ledger/refunds ready; implement recurrence, revisions, pause, ledger and review only. |
| Context inputs | Scheduling zone/revision/cursor helpers, occurrence repository, archive/delete consumers, SCR-10, fixtures and whole-pass fault tests. |
| Baseline | Verify immutable-origin/receipt/archive dependencies, then baseline recurrence/domain tests once; do not assume backup exists. |
| Acceptance/cleanup | Complete recurrence-only cases in Section 6; TC-40/46/54/111/112 restore legs wait for Phase 5. Hand off exact source/packet/test identities. |


**Goal:** Recurring transactions that never silently lose or duplicate an occurrence.

**Scope**
- Rules and revisions, weekday-cadence scheduling in the rule's own timezone, the occurrence ledger and its dispositions, evaluation on cold launch, foreground, and first focus, the occurrence cap with a recoverable backlog, pause/resume/edit/remove, tombstones, and whole-pass atomic rollback.
- Interaction rules with the rest of the app: archive blocks, deletion of recurring-origin transactions, BR-10 references from rules and ledger rows.
- SCR-10 including backlog review (generate or exclude) and the persistent count and date-range display.

**Requirements:** BR-12–BR-17, BR-10 (rule/ledger references), BR-08 (rule timezone); FR-REC-001–016 (FR-REC-017 is deferred); FR-TRN-005 (rule zone), FR-TRN-009 (recurring deletion, BR-15); FR-ACC-003, FR-CAT-002.

**Full-pass tests:** TC-14, TC-16, TC-17, TC-18, TC-19, TC-21, TC-22, TC-23, TC-24, TC-31, TC-32, TC-42, TC-44, TC-45, TC-47, TC-48, TC-49, TC-50, TC-51, TC-52, TC-55, TC-56, TC-82, TC-110. Whole-case PASS requires every assertion in its PRD oracle.

**Partial legs:** TC-40/46/53/54/111/112 backup/restore assertions remain pending until Phase 5.
**Device evidence:** TC-21 (recurrence portion of PERF-01) on active Android reference/compatibility devices.
**Demo:** Create weekly rules, advance the clock, and see occurrences generated; cap a backlog and recover it by explicit user action.
**Exit:** The whole-pass rollback test (TC-55) passes with failure injected after every rule.

---

### Phase 4 — Security and lock (L)

**Execution checklist** — apply shared Section 3.5 once, then only this phase’s delta.

| Check | Phase-specific obligation |
|---|---|
| Scope/prerequisites | Core routing and recurrence gates exist; implement passcode/biometrics/lockout only. |
| Context inputs | Credential/lockout store, LockGate/root route consumers, reviewed KDF dependency, logging hooks, physical-device scripts. |
| Baseline | Confirm native capability/version and previous timing evidence validity; baseline affected security/gate cases once. |
| Acceptance/cleanup | Complete security cases/required physical OEM evidence. Recovery-reset and final navigation/full-screen legs remain partial; scrub secrets from all context. |


**Goal:** An access gate that is correct, honest about its limits, and fast enough to use.

**Scope**
- Six-digit passcode enrollment and verification using the implementation chosen in spike S2 (PBKDF2-HMAC-SHA-256, 600,000 iterations, 256-bit output, constant-time comparison), with SecureStore for salt, verifier, and lockout state.
- Optional biometrics with device-credential fallback disabled.
- The persisted lockout state machine, including clock-rollback handling.
- Lock on cold launch and after 60 seconds in the background; the real `LockGate` replaces the pass-through; SCR-11.
- The "Forgot passcode" path to Delete & Reset (the destination is finished in Phase 5).
- Copy review: the app lock is never described as encryption.

**Requirements:** FR-SEC-001–009, BR-21, FR-NAV-002 (gate ordering); recover/reset integration stays pending until Phase 5.

**Full-pass tests:** TC-11, TC-25, TC-37, TC-70, TC-71, TC-72, TC-73. Whole-case PASS requires every assertion in its PRD oracle.
**Partial legs:** TC-26 reset/restore, TC-98 recovery appearance, TC-106 complete navigation and TC-117 normalization integration remain pending.
**Re-run:** TC-45 (recurrence evaluation after unlock now uses the real gate).
**Artifacts:** INS-SEC-01, INS-SEC-02 (active Android reference/compatibility devices plus one additional Android OEM), INS-SEC-03, SEC-REV-01 (timing on active Android reference/compatibility devices).

**Demo:** Enroll a passcode, fail attempts through the lockout tiers, restart the app mid-lockout, unlock with biometrics.
**Exit:** No financial text exists in the accessibility tree before unlock, and passcode plaintext appears in no log or storage.

---

### Phase 5 — Backup, restore, reset, and recovery (XL)

**Execution checklist** — apply shared Section 3.5 once, then only this phase’s delta.

| Check | Phase-specific obligation |
|---|---|
| Scope/prerequisites | Recurrence and security dependencies pass; implement existing v6 export/restore/reset/recovery only. |
| Context inputs | Exact schema/manifest/validator, stage/journal/migrations, receipts, all relevant writers, credential/scheduler state adapters and recovery tests. |
| Baseline | Verify source/staging schema and protocol dependencies; baseline fixture/recovery checks once, retaining logs privately. |
| Acceptance/cleanup | Phase 5 cases pass including restore legs and migration regression; notification/consent/assistive cleanup integration finishes in Phases 6–7. No blanket complete-device-state claim early. |


**Goal:** Recovery produces the precise pre/post-commit outcomes in PRD Section 12, preserving old data before commit and completing new data/device normalization after commit.

**Scope**
- Export of a canonical schema-v6 package with manifest hashes and counts; read from one database snapshot, written/validated in private temporary storage, then explicitly shared/saved; external document providers control their final writes.
- Restore preflight (schema, hashes, constraints, refund links, recurrence backlog), the maintenance lock, the staged swap and journal phases, automatic completion or rollback at startup, and normalization of device-local state after restore.
- Delete & Reset with authentication and its own recovery rules.
- SCR-08 (backup, restore, reset parts) and SCR-12 (pre-authentication recovery).
- Launch integrity and foreign-key checks that block the financial UI and offer restore or reset (FR-ERR-003).
- Unsupported-schema rejection (v1–v5 and unknown versions) with no change to local data.

**Requirements:** BR-18–BR-20, FR-BKP-001–011 and FR-BKP-013 (FR-BKP-012 deferred), FR-ERR-002/003/005, FR-SEC-007, FR-NAV-002 (recovery gate), FR-DSN-013 (restore with unknown icon key).

**Full-pass tests:** TC-09, TC-10, TC-26, TC-34, TC-40, TC-43, TC-46, TC-53, TC-54, TC-62, TC-63, TC-64, TC-65, TC-66, TC-67, TC-68, TC-80, TC-98, TC-109, TC-111, TC-112, TC-115, TC-116, TC-119. Whole-case PASS requires every assertion in its PRD oracle.
**Artifacts:** REC-BKP-01 (termination matrix across every restore phase on Android (iOS leg Deferred)), INS-BKP-01, INS-BKP-02.

**Partial legs:** TC-117 real notification/consent/assistive cleanup completes only after those feature adapters are integrated; complete it in Phase 7.
**Device evidence:** REC-BKP-01 on active Android reference/compatibility devices.
**Demo:** Export, kill the app during restore at several points, and verify the exact phase-specific old/new dataset and device-state oracle, not merely either hash.
**Exit:** Every restore phase has a passing termination test on Android (iOS leg Deferred), and a restore of a backup containing an unrecognized icon key succeeds.

---

### Phase 6 — Delivery services: PDF, notifications, privacy (L)

**Execution checklist** — apply shared Section 3.5 once, then only this phase’s delta.

| Check | Phase-specific obligation |
|---|---|
| Scope/prerequisites | Data recovery exists; implement existing PDF, reminder and consent/privacy paths only. |
| Context inputs | Exporter/formatter consumers, notification identifiers/permissions, crash capture/queue/consent, backup metadata and relevant source guide/config. |
| Baseline | Confirm adapters and queue/scheduler tests exist, baseline affected checks once; do not assume a provider is already selected. |
| Acceptance/cleanup | Applicable PDF/notification/Android backup/privacy cases pass; assistive-specific transport captures and inactivity cleanup finish in Phase 7; record physical evidence. |


**Goal:** The remaining user-facing services, each built on data that is already trustworthy.

**Scope**
- PDF export: correct labels for Transfers, recurring purchases, and refunds; refunds subtract from Expense and never add to Income; storage-exhaustion handling.
- Daily reminder: permission handling, exactly-one scheduling, change and disable, reconciliation after restart, reboot, and timezone change.
- Privacy: OS-backup exclusion configured/tested with documented iOS limits, consent-gated crash reporting with an allowlist, opt-out, queued-file deletion, and controlled tester-facing privacy notice and consent; store declarations and public hosting Deferred.
- SCR-09 completion (reminder, crash-report consent, passcode and biometric enrollment).

**Requirements:** FR-PDF-001–003 (FR-PDF-004 deferred), FR-NOT-001–004, FR-PRV-001–005, FR-SET-003, FR-TRN-004 (notes never logged).

**Full-pass tests:** TC-12, TC-35, TC-36, TC-38, TC-57, TC-69, TC-74, TC-75, TC-76, TC-83, TC-85. Whole-case PASS requires every assertion in its PRD oracle.
**Artifacts:** INS-PRV-01, INS-PRV-02, INS-PRV-03, PRIV-VER-01 (base capture paths), PRIV-VER-02.

**Partial legs:** TC-77 base capture paths pass here; FR-AUT capture contexts and final TC-117 cleanup finish in Phase 7.
**Device evidence:** TC-75 and TC-76 on active Android reference/compatibility devices.
**Demo:** Export a PDF, enable the reminder, toggle crash-report consent.
**Exit:** Controlled-transport inspection shows only allowlisted fields; every implemented MVP SCR route exists and resolves (Deferred SCR-03 excluded) (TC-78).

---

### Phase 7 — Assistive suggestions (L)

**Execution checklist** — apply shared Section 3.5 once, then only this phase’s delta.

| Check | Phase-specific obligation |
|---|---|
| Scope/prerequisites | Budgets/rules/notifications/privacy prerequisite implementations pass; implement the already approved advisory features only. |
| Context inputs | Actual suggestion detection/state/queue, source financial query consumers, notification/telemetry consumers, SCR-05/06/07 and tests. |
| Baseline | Verify advisory writes stay after financial commit and no egress; baseline scoped heuristic/performance/privacy tests once. |
| Acceptance/cleanup | Complete advisory/full-route/popup/final cleanup integration cases and physical budgets; preserve existing UX/features and invalidate only changed context. |


**Goal:** Helpful, strictly advisory features that cannot change financial data on their own and cannot make saving slower.

**Scope** (build in this order inside the phase, so the framework exists before the features that need it)
1. `SuggestionState` entity (Section 11 v1.7 schema), the master toggle, reset, and the arbitration queue (FR-AUT-008, FR-AUT-009, BR-26, BR-27); D-65 local build-time rollout control only; no remote-config service or new backend.
2. Duplicate warning on the Save path with the three-strikes counter (FR-AUT-002), within the 50 ms budget.
3. Entry-cadence nudge as an independent local notification (FR-AUT-006).
4. Category pre-fill with its own dismiss control (FR-AUT-003).
5. Budget pace (FR-AUT-004) and low-balance forecast (FR-AUT-005).
6. Dormant-entity review (FR-AUT-007).
7. Recurring-pattern suggestion (FR-AUT-001).

**Requirements:** FR-AUT-001–009, BR-24–BR-27, NFR-09, NFR-10, Section 11 `SuggestionState`.

**Full-pass tests:** TC-77, TC-78, TC-86, TC-87, TC-88, TC-89, TC-90, TC-91, TC-92, TC-93, TC-94, TC-95, TC-102, TC-117. Whole-case PASS requires every assertion in its PRD oracle.
**Artifacts:** INS-AUT-01, AUT-VER-01, AUT-VER-02, A11Y-AUT-01, PRIV-VER-01 (final, with FR-AUT captures).

**Device evidence:** AUT-VER-01/02 on active Android reference/compatibility devices against the PERF-01 fixture.
**Demo:** Trigger each suggestion, dismiss it, and show it stays dismissed; show Save latency with the features on and off.
**Exit:** No suggestion creates, edits, or deletes financial data without an explicit user action, and no FR-AUT content appears in any crash payload.

---

### Phase 8 — Hardening and internal validation candidate (L)

**Execution checklist** — apply shared Section 3.5 once, then only this phase’s delta.

| Check | Phase-specific obligation |
|---|---|
| Scope/prerequisites | All earlier implemented assertions and deferred-leg mapping are complete; fix in-scope defects only. |
| Context inputs | Compact index plus changed packets/diffs and final artifact identities; full acceptance map/evidence links, not a regenerated repo dump. |
| Baseline | Validate final candidate SHA/config/environment and existing CI results; identify required missing/invalidated assertions once. |
| Acceptance/cleanup | Complete all mandatory final-candidate suites and every applicable assertion; review owned cleanup, open defects and named gates. No APK/store/OTA/production publication beyond allowed EAS Build. |


**Goal:** Turn a feature-complete build into a signed internal validation candidate with a complete evidence index.

**Scope**
- Fix everything the earlier phases logged; no new features.
- Run the complete suites: `AUTO-PR`, `NIGHTLY`, and `RC-DEVICE` on the final signed internal-validation APK.
- Formal artifacts: PERF-01, PERF-GOV-01 (reference-device lifecycle review), COMPAT-01 (the two supported Android OS majors), UX-01 (final five runs per device), A11Y-01 (both appearances, default and 200% font scale), UI-PERF-01, DSG-REV-01, VIS-01 baseline approval, INS-ARC-01, QA-PLAN-01 final, and REL-EVD-01.
- Internal tester material: privacy/consent notice matching the APK, build notes and support content that explain the suggestion-history reset after restore or reinstall, copy that never claims encryption.
- Gate sign-offs RG-01 through RG-12 by their named owners.

**Full-pass tests:** TC-81, TC-99, TC-100, TC-104, TC-106, TC-107, TC-108, TC-121. Whole-case PASS requires every assertion in its PRD oracle.
**Exit:** TC-120 profile/workflow guardrails and TC-121 final standalone Android flows are rerun. REL-EVD-01 links a passing result for every applicable Android test and artifact, with iOS/store legs explicitly Deferred; no mandatory Android result is waived or marked not run; no store/OTA/production action is performed; the owners sign their gates.

---

## 6. Test-to-phase map

This is the single primary complete-pass map. **Tests first eligible for a complete scenario PASS** have all product prerequisites by the listed phase. Partial/prototype legs may run earlier and keep their precise assertion labels; they do not close the entire scenario. Later affected regressions and required final-candidate suites still run under Section 3.5. TC-20 is retired; every other TC-01–TC-122 appears exactly once below. No scenario depends on unfinished future-phase behavior.

| Phase | Tests first eligible for a complete scenario PASS |
|---|---|
| 0 | TC-120, TC-122 |
| 1 | TC-01, TC-02, TC-03, TC-04, TC-05, TC-07, TC-08, TC-13, TC-15, TC-28, TC-29, TC-30, TC-39, TC-79, TC-97, TC-101, TC-103, TC-105, TC-113, TC-114 |
| 2 | TC-06, TC-27, TC-33, TC-41, TC-58, TC-59, TC-60, TC-61, TC-84, TC-96, TC-118 |
| 3 | TC-14, TC-16, TC-17, TC-18, TC-19, TC-21, TC-22, TC-23, TC-24, TC-31, TC-32, TC-42, TC-44, TC-45, TC-47, TC-48, TC-49, TC-50, TC-51, TC-52, TC-55, TC-56, TC-82, TC-110 |
| 4 | TC-11, TC-25, TC-37, TC-70, TC-71, TC-72, TC-73 |
| 5 | TC-09, TC-10, TC-26, TC-34, TC-40, TC-43, TC-46, TC-53, TC-54, TC-62, TC-63, TC-64, TC-65, TC-66, TC-67, TC-68, TC-80, TC-98, TC-109, TC-111, TC-112, TC-115, TC-116, TC-119 |
| 6 | TC-12, TC-35, TC-36, TC-38, TC-57, TC-69, TC-74, TC-75, TC-76, TC-83, TC-85 |
| 7 | TC-77, TC-78, TC-86, TC-87, TC-88, TC-89, TC-90, TC-91, TC-92, TC-93, TC-94, TC-95, TC-102, TC-117 |
| 8 | TC-81, TC-99, TC-100, TC-104, TC-106, TC-107, TC-108, TC-121 |

| Phase | Named artifacts |
|---|---|
| 0 | BUILD-VER-01 dev/shell evidence; INS-ARC-01 migration/prototype leg; COMPAT-BKP-01 investigation; QA-PLAN-01 complete assertion/phase mapping; EXEC-VER-01 context/baseline leg |
| 1 | UX-01/UI-PERF-01 dry runs; first applicable VIS-01 baselines; EXEC-VER-01 phase delta |
| 2 | TC-33 current screens; UX-01 O2 leg via TC-118; EXEC-VER-01 phase delta |
| 3 | TC-21 recurrence metrics; whole-pass fault results; EXEC-VER-01 phase delta |
| 4 | INS-SEC-01/02/03 and SEC-REV-01 physical evidence; RG-05 still awaits TC-26 in Phase 5 |
| 5 | INS-BKP-01/02; REC-BKP-01 database/credential legs; INS-ARC-01 TC-122; remaining real scheduler/consent integration pending |
| 6 | INS-PRV-01/02/03; PRIV-VER-01 base captures; PRIV-VER-02 tester notice; PLAT-VER-01 Android native/config evidence |
| 7 | INS-AUT-01; AUT-VER-01/02; A11Y-AUT-01; final FR-AUT transport captures; TC-117/REC-BKP-01 full normalization integration |
| 8 | Final applicable PERF-01/PERF-GOV-01/COMPAT-01/UX-01/A11Y-01/UI-PERF-01/DSG-REV-01/VIS-01; BUILD-VER-01 final artifact; INS-ARC-01/QA-PLAN-01/DOC-VER-01/EXEC-VER-01/REL-EVD-01 |

## 7. Internal-build gate readiness

| Gate | Evidence complete after | Notes |
|---|---|---|
| RG-01 Product behavior | Phase 8 | Needs every product FR test and the final UX-01 |
| RG-02 Financial integrity | Phase 6 | Last pieces are the PDF legs of TC-57, TC-83, TC-85 |
| RG-03 Recurrence durability | Phase 5 | The backup and restore legs of TC-53 close it |
| RG-04 Backup/recovery | Phase 7 | Phase 6 completes PDF/storage legs; Phase 7 completes TC-117 real consent/notification/assistive normalization and full REC-BKP-01 |
| RG-05 Security | Phase 5 | Phase 4 supplies native/KDF evidence; required TC-26 reset/restore completes only in Phase 5 |
| RG-06 Privacy/internal-build compliance | Phase 7 | PRIV-VER-01 is finalized with the FR-AUT captures |
| RG-07 Notifications | Phase 6 | |
| RG-08 Accessibility | Phase 8 | A11Y-01 in both appearances |
| RG-09 Performance/compatibility/offline | Phase 8 | PERF-01 final, COMPAT-01, UX-01, TC-81 |
| RG-10 Architecture/documentation | Phase 8 | TC-122, corrected assertion/phase map, verified context, owned cleanup and DOC-VER-01/EXEC-VER-01/REL-EVD-01 |
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
| R6 | Notification delivery varies by OEM battery policy | Phase 6, 7 | The spec already states OS control of delivery; verify on active Android reference/compatibility devices and keep copy honest |
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
- All scenarios first eligible in this phase are complete, applicable earlier regressions have matching valid evidence, and required suite cadence/final-build checks pass under Section 3.5.
- The internal-validation APK demo works offline on active Android reference/compatibility devices.
- The device evidence for the phase (Section 3.3) is captured and stored.
- Any spec issue found has been logged, and anything blocking is resolved in a new PRD/SRS version.

## 10. Where work can run in parallel

The phases are sequential for *closing*, but inside a phase these streams are independent and can proceed at the same time:
- **Phase 0:** tokens and fonts, domain core, database core, CI and fault harness, and each spike.
- **Phase 1:** account/category screens, the entry screen and keypad, Records list and paging, and Preferences.
- **Phase 2:** refunds, Budgets, and Analysis, once the refund repository rules exist.
- **Phase 3:** the scheduling and ledger engine versus the SCR-10 and backlog UI, once the engine's interface is fixed.
- **Phases 4–6:** security and the early parts of PDF and notification work do not depend on each other, but each phase closes in order.


## 11. Inherited contracts and maintenance coverage

The existing v6 backup/receipt/refund/revision contracts remain mandatory and are referenced by the phase scope and primary Section 6 map rather than a second competing full-pass table. In particular TC-109/111/112/115/116/119 finish their restore legs in Phase 5; TC-110 includes recurring date correction and finishes in Phase 3; TC-113/114 finish in Phase 1; TC-118 finishes in Phase 2; TC-117 real scheduler/privacy/advisory integration finishes in Phase 7. No document or fixture pass is an application/device pass. The source [v6 contract](contracts/Backup-v6.md) and [PRD/SRS v1.11.1](Kwartracker-PRD-SRS-v1_11.md) define the outcomes.

Maintenance revision 1.11.1 adds no feature/UI. It resolves SF-01 through FR-ERR-005/TC-122, centralizes shared work in Section 3.5, documents the optional tools and physical-evidence limits, and corrects circular/early acceptance mappings. [execution-context/index.json](execution-context/index.json) identifies inspected sources, reusable reads and actual checks; cached packets/snapshots are not shipped runtime code. Historical baselines remain referenced provenance and are not deleted as unused files.

## 12. EAS-only acceptance boundary

| Phase / concern | Mandatory current evidence | Explicitly excluded or deferred |
|---|---|---|
| Phase 0 setup | Guide/EAS-path mapping, TC-120, TC-121 shell legs, BUILD-VER-01 actual Android APK/install/Metro results | Local compiler path, replacement project scaffold, store accounts, uploads, production/submit profiles |
| Phases 1–7 | Development APK for coding; EAS internal-validation APK for actual Android offline/performance/native assertions | Dev-client benchmarks reported as final validation; iOS-specific device legs (Deferred) |
| Phase 8 | TC-120 profile/workflow inspection repeated, TC-121 final offline flow, applicable Android gates/fixtures/evidence with unchanged quality oracles | Google Play on every track, Apple/TestFlight, EAS Submit/auto-submit, OTA publication, hosting and real production deployment |
| Privacy | Internal tester notice, actual consent/provider/retention and Android backup tests | Store declarations, public policy hosting and market launch approval (Deferred) |

The guide is reference evidence, not permission to run either build branch automatically. Only Phase 0's selected EAS branch is part of this plan. No EAS job, emulator session, Docker test or browser product test is claimed by this documentation revision. A later distribution scope requires a new explicit user instruction and an updated baseline.
