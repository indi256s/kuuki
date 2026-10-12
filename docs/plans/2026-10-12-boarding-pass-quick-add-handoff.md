# Boarding-pass Quick Add implementation handoff

Status: landed on local `main` (feature commit `e5cdea51`, merged at `e0393ba9`; not pushed). Release acceptance blocked by the phone pilot (OQ4).
Updated: 2026-10-12 (Asia/Tbilisi).

## Owning thread and workspace

- [Implementation thread](t3-thread://v1/mcp:c886b908-21be-4846-b5a3-91d4e24dc1ab).
- Owning branch: `feature/boarding-pass-quick-add`.
- Owning checkout: `/Users/indi256/.t3/worktrees/kuuki/feature-boarding-pass-quick-add`.
- Baseline: local `main` at `776f3c12e47a44cf114a04003d59b212dd755cf2`; no origin fetch.
- Orchestrator: `claudeAgent / claude-opus-5-5`. Implementation workers: `claudeAgent / claude-sonnet-5-5`, attested from each `delegate_task` receipt.

## Where the state lives

- [Spec](../../.scratch/boarding-pass-quick-add/spec.md): accepted product decisions. Its "Engineering resolution" section records OQ1–OQ3 (resolved) and OQ4 (open).
- [Execution ledger](../../.scratch/boarding-pass-quick-add/ledger.md): execution map, requirements → evidence, agents, events, checks and checkpoint.
- Tickets: `.scratch/boarding-pass-quick-add/issues/01`–`05` are resolved. `06-phone-pilot-evidence.md` is `ready-for-human`.

## Inputs needed to resume

- **Committed:** the spec, execution ledger and issue files above are included in local `main` at merge `e0393ba9`. Use a checkout containing that commit; their `.scratch/` location does not make these inputs disposable.
- **Committed concept:** [visuals/kuuki-quick-add.html](../../.scratch/boarding-pass-quick-add/visuals/kuuki-quick-add.html) is a simulated UI reference, not decoder evidence.
- **Still required:** ticket 06 needs a representative pass corpus and target iPhone/Android hardware. No accepted phone-pilot results are recorded. Source commits and the simulated concept cannot supply that evidence.

Locate the current owning checkout with `git worktree list`; the feature checkout above records the implementation location and may have been removed after landing. Verify the committed input paths in the destination before starting ticket 06. Use the repository's [handoff input conventions](../agents/issue-tracker.md#inputs-needed-to-resume) for any private pilot corpus.

## Accepted progress

- Ticket 01: `POST /api/import/jobs` with `type: 'boarding_pass'`, strict-key validation, idempotent local-legs admission without a provider or the job. Adds the `flown_required` / `flownConfirmed` guard and the conversion refusal `FLIGHT_NOT_CONFIRMED`. Reviewed independently, then repaired.
- Tickets 02–03: BCBP parser and local reader (zxing-wasm 3.1.5 and pdfjs-dist 6.4.299, both self-hosted and pinned).
- Ticket 04: ordinal year question with leap-year checks, the flew question, the `flown` readiness blocker, and Finish later to `/journal?queue=awaiting`.
- Ticket 05: the "Add boarding pass" entry, `QuickAddSource` with equal Take photo / Choose screenshot or PDF actions, the disclosed upload fallback, and the partial-batch upload.
- Polish from the primary agent-browser pass (upload-note retention, announced fallback reason, mobile year cue, singular copy).

## Checks before landing (feature tree)

- `pnpm typecheck:api` passed (exit 0). `pnpm test:api`: 731/731 passed. `workers/import` tsc passed (exit 0).
- Next typecheck and lint passed (exit 0). `pnpm format:check` passed (exit 0).
- Full Next vitest after the review repair: 1164 passed, 4 failed. The 4 failures in `src/client/account/recovery.test.tsx` are pre-existing (`IntersectionObserver` in jsdom); they reproduce on the baseline.
- `pnpm next:build` passed (exit 0) with no tracked inventory diff; full `pnpm test:next:navigation`: 44 passed. Both re-run after the review repair.
- agent-browser on a local preview, real end to end: local decode → admission → D1 → year → flew → saved as logged.
  - Covered: two legs, same-day block, reload, Not yet.
  - Also covered: RU at 320px, 200% zoom, dark with reduced motion, keyboard/focus, 44px targets.
- Skipped: `pnpm next:smoke`, because the `apps/next/worker.ts` dispatch is unchanged.

## Next action

The final read-only review (codex `gpt-6.1-sol`, high) raised 3 major findings and 1 minor. Three were accepted and repaired:

- duplicate rows could not answer the flown question;
- an abandoned partial upload still went ahead;
- the "Another year" cap was too low.

One was declined: a replay that reuses a local batch's operation id with a different source. The UI never does this, so it would take a hand-crafted request against the member's own account; it is listed under residual risks.

Landed on local `main` with a compare-and-swap after merging the latest `main` (Keyline icons, Clef verification #55–#57, color system v1). Gates on the merged tree: `test:api` 787/787, Next vitest 1318 passed (the same 4 baseline recovery failures), `next:build` passed, full navigation 44/44. Not pushed, not deployed.

Next: run the phone pilot (ticket 06).

OQ4 is still open. There was no phone pilot or representative corpus (30 passes; iPhone and Android), so release acceptance is blocked. Do not report the pilot or release readiness as passing.

## Residual risks

- After a partial-pass upload, the old partial batch remains in the queue.
- A failed admission drops the chosen file, so the member has to choose it again.
- The page title switches between Quick Add and Import when the member opens the general import.
- pdf.js 6 has modern-browser minimums; older iOS Safari is unverified.
- The `.wasm` MIME type and caching on deployed Workers are unverified.
- "Today" on the client comes from the device clock; the server uses the profile timezone and stays authoritative.
- The midnight window between the request `now` and the fresh `Date` in `bulkCreate`.
- "Not yet" is component-local and comes back after a reload, as the spec says.
- A hand-crafted document request reusing a still-processing boarding-pass batch's operation id could start a job that writes drafts without `flown_required`. The UI never reuses ids across admission kinds.
