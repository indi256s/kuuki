Execution ledger: execution-ledger/v1
Plan: .scratch/boarding-pass-quick-add/spec.md (sha256 3028c576… at transfer; amended with "Engineering resolution" by orchestrator 2026-10-12); execution map: this file + issues/
Workspace: /Users/indi256/.t3/worktrees/kuuki/feature-boarding-pass-quick-add; base 776f3c12e47a44cf114a04003d59b212dd755cf2; initial dirty state = 5 transferred artifacts + handoff note + implementation-brief (untracked)
Runtime: T3 delegate_task (claudeAgent); one implementation writer at a time (owner preference no-agent-swarms); read-only research/review may overlap
Authority: local spec/implement/verify. No commits, pushes, PRs, deploys, remote D1, external messages, unrelated cleanup.
Profiles: orchestrator claudeAgent/claude-opus-5-5 (thread metadata); workers required claudeAgent/claude-sonnet-5-5 — attested by delegate_task receipt fields providerInstanceId/model

## Execution map

| Node | Wave | Depends | Owned writes | State |
| --- | --- | --- | --- | --- |
| R1 OQ1 decoder research | 0 | — | none (read-only) | accepted |
| 01 admission + flown guard | 1 | — | functions/api/import/jobs.ts, _services/import{Job,Drafts,Conversion,Runtime}.ts, workers/import/ImportJob.ts, functions/test/import-{drafts,conversion,stream}.test.ts | accepted (review + repair) |
| 02 BCBP parser | 1 | — | apps/next/src/client/import/bcbp{,.test}.ts | accepted |
| 03 barcode reader | 1 | R1 | apps/next/package.json, pnpm-lock.yaml, apps/next/src/client/import/barcode-reader{,.test}.ts | accepted (browser paths → 05 journey; asset emission → final build) |
| 04 review questions/flown | 2 | 01 | apps/next/src/client/import/{import-types,draft-saver,review-model,questions,question-deck,review-row,review-step,copy}.* | accepted |
| 05 capture UI + integration | 3 | 02,03,04 | add-actions.tsx, lib/url-state.ts, import-client.tsx, import-api.ts, new quick-add source component, copy.ts (after 04), apps/next/tests/import.test.ts | accepted (+ polish) |
| 06 phone pilot (OQ4) | — | hardware/corpus | none | blocked |

## Requirements → node → evidence

| Req | Node(s) | Evidence |
| --- | --- | --- |
| QA-01 | 05 | browser journey: equal actions, cancel/replace, desktop entry |
| QA-02 | 02,03,01,05 | parser+real-decoder fixtures; journey: no source upload on local success |
| QA-03 | 05 | journey: unreadable → disclosed upload fallback |
| QA-04 | 02,01 | multi-leg parser cases; admission ordinal order |
| QA-05 | 04,05 | review render checks; no invented fields |
| QA-06 | 04,01 | ordinal/leap unit cases; reload keeps year decision |
| QA-07 | 01,04,05 | conversion guard tests; journey: preflight persisted then resumed confirm |
| QA-08 | 01 | future unconfirmed converts upcoming |
| QA-09 | 05 + existing | existing reload tests; finish-later lands in queue |
| QA-10 | existing | existing duplicate tests (unchanged path) |
| QA-11 | existing + 01 | existing confirm-runner/conversion tests |
| QA-12 | 01,02 | strict validation tests; parser drops PII; review |
| QA-13 | 04,05 | EN/RU, a11y/browser checks |

## Checks

| Check | Owner | Result |
| --- | --- | --- |
| pnpm typecheck:api / test:api / worker tsc | 01 worker, then primary at final | primary final: 0 / 731 pass / 0 |
| next typecheck + lint + full vitest + format:check | primary final | 0 / 0 / 1163 pass, 4 fail = pre-existing baseline (account/recovery.test.tsx, IntersectionObserver in jsdom; reproduced on 776f3c12 in a throwaway worktree, removed) / 0 |
| pnpm next:build → full test:next:navigation | primary (final, serialized) | build 0 (75 API routes, no tracked inventory diff) → 44 passed |
| agent-browser UI checks | primary | done on 05 (see events); polish deltas covered by Playwright + inspection |
| final independent review | codex/gpt-6.1-sol high (owner global rule) | 3 major + 1 minor; 3 accepted → repair, 1 declined (see events) |
| next:smoke | — | skipped: apps/next/worker.ts dispatch unchanged (jobs.ts handler change only) |

## Agents

| Task | Assignment | Model (receipt) | Status |
| --- | --- | --- | --- |
| bpqa-oq1-research-r1 | R1 | claudeAgent/claude-sonnet-5-5 (attested) | completed, accepted |
| bpqa-01-impl-r1 | 01 | claudeAgent/claude-sonnet-5-5 (attested) | completed |
| bpqa-01-review-r1 | 01 review (read-only, prompt-constrained) | claudeAgent/claude-sonnet-5-5 (attested) | completed: 0 crit/major, 2 minor → repair queued |
| bpqa-0203-impl-r1 | 02+03 | claudeAgent/claude-sonnet-5-5 (attested) | completed, accepted |
| bpqa-01-repair-r1 | 01 repair | claudeAgent/claude-sonnet-5-5 (attested) | completed, accepted |
| bpqa-04-impl-r1 | 04 | claudeAgent/claude-sonnet-5-5 (attested) | completed, accepted |
| bpqa-05-impl-r1 | 05 (may run next:build + focused import Playwright, serialized) | claudeAgent/claude-sonnet-5-5 (attested) | completed, accepted |
| bpqa-polish-r1 | polish (5 repairs from primary browser pass) | claudeAgent/claude-sonnet-5-5 (attested) | completed, accepted |
| bpqa-final-review-r1 | final ship review (read-only) | codex/gpt-6.1-sol, reasoningEffort high (attested) | completed, triaged |
| bpqa-review-repair-r1 | repair review A (duplicate flown), B (partial upload fence), C (other-year max) | claudeAgent/claude-sonnet-5-5 (attested) | completed, accepted |

## Events

- 2026-10-12: artifacts verified (5/5 SHA-256). Live code reconciled. OQ2/OQ3 resolved in spec. Tickets 01,02,04,06 written.

- 2026-10-12: R1 accepted (zxing-wasm 3.1.5 / pdfjs-dist 6.4.299; npm facts re-checked). Ticket 03 written; spec → ready-for-agent. 02+03 share one owner (coupled reader→parser), dispatched after 01 accepts.

- 2026-10-12: 01 reported done (test:api 731 pass, typecheck:api + worker tsc 0; 31 new tests fail on baseline). Primary diff inspection OK. Worktree `pnpm install --frozen-lockfile` (exit 0) by primary. Dispatched 01 review + 02/03 writer.

- 2026-10-12: 01 review done; repair (date edit clears flown_confirmed; text+false accepted) queued after 02+03 writer.

- 2026-10-12: 02+03 accepted after primary inspection (vitest 24 pass incl. mutation check; typecheck/lint/format 0). Deps pinned zxing-wasm 3.1.5, pdfjs-dist 6.4.299. Contract notes for 05: readBoardingPass rejects on abort; NoneReason no-barcode|not-boarding-pass|unsupported|failed. Dispatched 01 repair.

- 2026-10-12: 01 repair accepted (test:api 731 pass; fail-before shown). 01 accepted. Dispatched 04.

- 2026-10-12: 04 accepted (vitest import 212 + welcome 48 pass; typecheck/lint/format 0). Accepted scope note: Finish later also shows on general imports (only with nothing unsaved). Dispatched 05.

- 2026-10-12: 05 accepted after inspection (import Playwright 8/8, vitest 216, build exit 0, wasm+pdf worker emitted). Primary agent-browser pass on real local preview (session bpqa-*, PID-owned preview stopped): real decode→admission→D1→year→flown→confirm saved JFK→BOS as logged/save; 2-leg Aztec → 2 rows in order; same-day row blocked until flown; flown requirement survived reload; "Not yet" left row in queue (header showed 1 awaiting). RU/light/320 no overflow; 200% zoom reflow no overflow; dark+reduced-motion OK; keyboard order/focus/44px OK. Findings → polish: upload-note 30-day claim, silent fallback outcome (QA-13), ACCEPT dup, no mobile date cue, single-flight plural phrasing. Fixture limitation: YUL not in fixture D1 airports (UNKNOWN_AIRPORT stays correctable). Screenshots: $TMPDIR/bpqa-shots.

- 2026-10-12: polish accepted after inspection (upload note states 30-day draft retention; fallback reason announced via existing role=status; ACCEPT shared from source-step; mobile "Year to confirm ·" cue; yearForAll only for >1 draft). Worker checks: typecheck/lint 0, vitest import 212, build 0, import Playwright 8/8.

- 2026-10-12: primary final gates passed (Checks). Final review (Sol high) triage: ACCEPT duplicate Quick Add rows lose flown question → Save anyway blocked (verified questions.ts open filter); ACCEPT partial-pass upload not fenced against reset/unmount after await (verified); ACCEPT other-year max = years[0]+1 rejects valid current/next year for ordinal 366 (verified). DECLINE replay with a different source reusing a processing local batch's operation id: client never reuses ids across admission kinds (readOperation/uploadOperation/passUploadOperation are distinct UUIDs), requires the authenticated member's hand-crafted request against own account in a ms window, and the flown guard protects member intent, not an authorization boundary → residual risk. Dispatched bpqa-review-repair-r1.

- 2026-10-12: review repair accepted after inspection (duplicates get the flown question and are never auto-selected; partial upload fenced by a ref token cleared on reset/unmount; other-year max = today's year + 1). Fail-before shown by worker for A. Primary re-ran: next typecheck/lint 0, vitest 1164 pass + same 4 baseline recovery failures, format 0, next:build 0, full navigation 44 passed. API untouched since API gates. No lifecycle test for B (no import-client seam for partial-pass); covered by inspection.

- 2026-10-12: committed e5cdea51; merged main twice (44ce74b9: 6 conflicts resolved keeping both sides, lucide → Keyline in quick-add-source; c872982c: clean). Merged-tree gates: test:api 787, typecheck api/import/next 0, lint 0, vitest 1318 + 4 baseline, format 0, next:build 0, navigation 44. main moved c872982c → e0393ba9 by update-ref compare-and-swap; root checkout working tree untouched.

## Checkpoint

Landed on local main (not pushed). Only 06 (OQ4 phone pilot) remains, blocked on hardware/corpus.
