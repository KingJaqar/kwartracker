# Phase 1 acceptance-mapping correction — proposed

Prepared 2026-11-03. **Scheduling correction approved and applied in the current chat on 2026-11-03.** The prior proposal below is retained as historical rationale. Plan Phase1/4/5 lists, primary map, integration summary and QA case-phase fields now reflect that approval. Original PRD oracles remain unchanged; broader maintenance-revision edits were not performed. See [current execution evidence](../2026-11-03-execution-final.json).

Review the [exact proposed patch](Acceptance-mapping.patch) and [coverage check](Acceptance-mapping-check.json). The patch passes `git apply --check` against the current plan. Its complete-case map contains all 121 active cases exactly once. The PRD and its test oracles remain unchanged.

The Phase 1 full-pass list currently includes tests whose complete oracles require later workflows. This proposal changes scheduling only. It preserves every test assertion, monetary limit, motion limit and safety guard.

| Test | Phase 1 evidence remains required | First complete-case eligibility | Remaining oracle |
|---|---|---|---|
| TC-103 | Current-screen animation inventory, worklet/transform/opacity rules, reduced motion, implemented feedback and interaction measurements | Phase 4 | Passcode-error shake and its reduced-motion/color/text behavior. Future changed screens still run affected regression checks. Missing haptics in the pinned APK stays explicitly deferred under Section 3.6. |
| TC-113 | Signed account and positive transaction boundaries, half-up rounding, unchanged stored cents, exact totals above the safe Number range, rejected out-of-range writes | Phase 5 | Budget writes in Phase 2, rule writes in Phase 3 and real product-import rejection in Phase 5. An unavailable/deferred import path never receives a whole-case PASS. |

## Exact proposed plan edits

1. Phase 1: remove TC-103 and TC-113 from the **Full-pass tests** list; add a **Partial legs** paragraph retaining the Phase 1 obligations above and explicitly linking whole-case eligibility to Phases 4 and 5.
2. Phase 4: add TC-103 to its full-pass list, conditional on all applicable assertions actually passing.
3. Phase 5: add TC-113 to its full-pass list, conditional on the real import boundary and preceding money-write assertions actually passing.
4. Section 6 primary complete-pass map: move TC-103 from row 1 to row 4 and TC-113 from row 1 to row 5, preserving exactly one complete-pass owner per test.
5. The later v6 integration summary currently saying TC-113/114 finish in Phase 1 should instead say TC-114 finishes in Phase 1; TC-113 finishes in Phase 5 after its earlier write legs.
6. Regenerate the QA assertion map and check every active TC remains assigned once. Keep earlier real results as historical evidence; do not relabel missing assertions PASS.

## Change control after approval

Prepare maintenance revision 1.11.3 under PRD Section 1. Record this scheduling correction in document control/change log, execution coverage, decision register and remaining-evidence sections where affected. No change to the Section 15 TC-103/113 oracle text or schema v6 is proposed. No later-phase feature implementation is authorized by approving this mapping.

## Decision requested

Approve this scheduling correction, or reject it with the intended complete-case phase for each test. Approval does not waive the current interaction-performance failure, TalkBack verification or visual-baseline review. Phase 1 remains open until its compatible acceptance gates are verified.
