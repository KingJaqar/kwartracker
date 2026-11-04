# Phase 1 native acceptance — pending

**Superseding continuation — 2026-11-03:** The one existing development client has now exercised the compatible Phase1 flows described in the [dated plan note](../../Kwartracker-PRD-SRS-v1_11-Execution-Phases.md#phase-1-execution-continuation--2026-11-03). The older upload/build/standalone prerequisites below are historical and superseded by Section3.6. Do not request or create another APK or test profile to finish these procedures. Current no-long-task, accessibility, VIS and remaining interaction assertions retain their actual unpassed status.

No Phase 1 APK was submitted, installed or exercised in this execution. Host tests and a Hermes export do not close native gates. Current authorization excludes source uploads/cloud builds. Existing Phase 0 APKs contain older JavaScript and cannot establish Phase 1 acceptance; the two added native packages also require a compatible binary.

## Entry and preservation

1. Obtain authorization for the reviewed Phase 1 source upload/internal Android build. Check actual account capacity/reset/pending jobs and reserve capacity for later phases, final acceptance and diagnosed corrections before submission. Do not submit merely to discover capacity; no paid upgrade, publication, OTA, commit or push is authorized.
2. Use MuMu **james**, previously recorded as `127.0.0.1:16384`, Android 12/API32/x86_64, 1080×1920/density480. Read back its actual current identity, renderer, refresh rate, free storage, thermal/battery state, timezone and font scale. Earlier evidence is historical. Retain the approved james-only override; do not present emulator results as physical-device evidence.
3. Normal validation identity from the current effective configuration is `com.alex123superman.kwartracker.validation`, scheme `kwartracker-validation`. Record EAS build ID, reviewed source/lock/config manifest and APK SHA-256. Verify standalone release compilation, Hermes, native font/package availability, no debugging/development UI, portrait, no tablet layout and disabled updates. Preserve data-bearing installs; do not uninstall, clear app data or substitute the probe package.
4. Establish a disposable, isolated test dataset and a reviewed, data-preserving fixture-loading/recovery method before mutation. PERF-01 fixture identity remains `tests/fixtures/perf-manifest.json`: 10,000 Transactions, 500 Accounts, 200 Categories, 120 Budgets, 50 Rules and 500 ledger rows. The older probe package's private database is not the normal app's database. Loading this fixture into the actual Phase 1 validation app remains a native-run setup obligation; no normal-app fixture-loading procedure was exercised here. Do not inject synthetic data into a user's ledger or relax the non-debuggable acceptance condition.
5. Retain Android state and restore it after each procedure. Keep raw console/server/native diagnostics and result calculations, with stable identifiers and scrubbed errors. Do not capture real financial data in screenshots/logs.

## Functional/offline run

Run on the candidate in Dark and Light with networking unavailable; keep Metro stopped for standalone acceptance. Record every actual result, not an expected pass.

| Journey | Actions and oracle |
|---|---|
| First launch | In a disposable fresh ledger, exactly the six approved Expense categories and Income Salary appear. Records offers **Create your first account**. Create Cash with opening balance zero; return to usable Records. Restart does not seed again. |
| Income / Expense | Open **Add transaction**, select Income/Expense, enter an amount, choose an active account and matching category, Save. Exactly one row and creation receipt exist; account and month amounts match exact minor units. Verify notes and archived historical names. |
| Transfer | Create Bank, transfer 1000.00 Cash→Bank. Cash decreases and Bank increases by exactly 100000 minor units; Income/Expense totals do not change. Same/missing/archived targets reject without changing rows or receipts. |
| Edit / delete / duplicate | Correct amount, account/destination, note and explicit date/time. Old effects disappear together and new effects appear together. Creation metadata stays fixed. Delete reverses both Transfer sides together. Duplicate opens a fresh manual draft/token, retaining only active selectable targets; cancel creates nothing. |
| Archive / restore / delete | Archive then restore a referenced account and category. Active pickers hide/show them; history and balances stay invariant. Referenced hard deletion is refused with counts and an Archive route. Unreferenced deletion retains receipts. Verify unchanged historical archived targets remain valid on edit. |
| Money / settings | Store 12.34; save decimals 2→0→2 and observe 12.34→12→12.34 without stored financial changes. Verify signed opening balances and rounding vectors, currency prefix/suffix, notes visibility and persisted System/Light/Dark. Native pickers must follow the app appearance. |
| Dates | Verify local noon when time is omitted, midnight month membership, DST gap rejection and explicit offset choice for a fold. Travel never regroups a saved date. Explicit correction moves the period effect once. |
| Failure / concurrency | Run the reviewed native fault/storage-pressure harness against disposable data. Save failure retains the entire draft and no partial receipt/Transaction. Repeated Save admits one operation. Retry of an unchanged command reuses its token; stale edit cannot overwrite a newer version. No unknown filesystem pressure or destructive setup is authorized by this checklist. |
| Navigation / keyboard | Back closes the top layer and is blocked during writes. Inactive tabs preserve scroll/state; drawer edge gesture applies only to tabs. Fields remain above the keyboard, the keypad returns after note entry, all actions remain reachable at 200% text. Check empty/loading/error/content states and render-error Retry on each Phase 1 screen. |

## UX-01 / UI-PERF-01 / Records dry runs

- Five O1 runs, from activating Records **Add transaction** until the saved row appears, for Income and Expense with existing selectable targets. Median ≤10 seconds; ≤5 non-keypad activations overall. The opened entry's design path is account, category, Save (three); count digits/operators separately.
- Load and verify the exact PERF-01 dataset in the actual candidate. Confirm page size50, contiguous keysets, insert/delete while scrolling without duplicates or omissions, and header/day totals independent of loaded rows. Rows issue no queries. Host coverage does not establish native scroll quality.
- Capture actual platform frame/response measurements and JS task evidence for keypad, pop button, sheet open and close, segmented selection, tab switch and sustained Records fling, both appearances. Ten runs per interaction: response-to-next-frame p95≤100ms; animation mean≥55fps; ≤2% Android jank; no frame>100ms; no JS task>50ms; no blank list rows; ten ordered keypad taps within one second. A sample with unavailable/empty event or task evidence is pending, not a pass. Use a reviewed measurement method; the nonshipping Phase 0 prototype is not a substitute for product screens.
- Records scroll dry run: one warm-up, three60-second runs; retain actual frame exports and PERF-01 limits (mean≥55fps, <1% frames>100ms, p95 response≤200ms in addition to NFR-11). Record emulator limitations and exact candidate identity.

## VIS-01 and accessibility

Pin image/API/resolution/density, bundled fonts, locale, clock/battery display, appearance and 100%/200% font scale; disable animations. Capture SCR-01,05,06,07 and implemented09 key states. Obtain UX-owner approval of the first baselines; no generated screenshot becomes approved automatically. Subsequent comparison uses the specified perceptual-distance0.1/anti-alias rule and fails above0.1% differing pixels. No approved Phase 1 baseline or screenshot comparison exists yet.

Audit TalkBack labels/roles/states, modal title focus and restoration, hidden background traversal, 44dp targets, long names and complete monetary text in both appearances. Check reduced-motion behavior and haptics on an actual candidate. Sign-off remains pending.

## Closure rules and plan discrepancy

Attach raw outcomes to the source/APK/environment identity in `results.json`; do not replace pending rows with host results. Remote NIGHTLY execution is unrun; its prepared workflow submits no EAS build. Phase 1 stays partially complete until its native/UX/VIS gates pass.

TC-113's write/rounding/exact-total assertions have host evidence. Its wording also names **import** rejection, while the plan schedules the app's restore/import path in Phase5. Only schema/storage boundary checks exist now; do not credit them as an exercised app import. This discrepancy is recorded in Phase 1 progress without moving another phase or changing the PRD's criterion.
