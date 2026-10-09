# Journal redesign handoff

Status: complete and locally verified, 2026-10-09.
Owning branch: `feat/journal-redesign`
Owning checkout: `/Users/indi256/.t3/worktrees/kuuki/feat-journal-redesign`
Verified production source: `82ac6ab1`; later commits record browser acceptance and documentation.
Spec and tickets: [Journal redesign](../../.scratch/journal-redesign/spec.md), [ticket 17](../../.scratch/journal-redesign/issues/17-retire-old-journal.md), [ticket 18](../../.scratch/journal-redesign/issues/18-perf-and-docs.md).

## Current scope

The Journal now receives the owner's full payload from the server, filters and sorts locally, mirrors state with `replaceState`, and renders a continuous ledger. Summary, Next up, review pill, filter toolbar/drawer, firsts, detail sheet with field edits, bulk actions, CSV export, deferred deletion, mobile menus/swipes and keyboard navigation are implemented under `apps/next/src/client/journal/`.

Legacy `reads/journal*` components and their obsolete tests/styles are retired. Historical transit reconciliation remains in `reads/historical-review.tsx`; the new page mounts it. Browser journeys now cover filter reload/Back, sheet URLs/Escape, full matching selection, deletion Undo/cancellation, confirmation receipt retry, bulk confirmation and Passport pending-flight links.

## Accepted decisions

- **D1:** “Did not fly” removes a flight through the six-second deferred DELETE and Undo. It does not create a stored lifecycle state or need a migration.
- **D2:** Firsts are computed on the server over the entire journal, using Passport country evidence and transit rules. Awaiting firsts are pending; upcoming flights receive none.
- **D3:** The measured full-mount version exceeded the 1.5-second interaction target. The fallback renders 60 ledger items first and progressively mounts the remaining real DOM rows. Three new 4× CPU-throttled runs measured a median hydration-plus-sort-feedback proxy of 1.240 s, with a first-run outlier of 2.284 s. All 993 matching rows were verified by 2.236–3.932 s. Payload: 41,366 bytes gzip. Full method and credential-free artifacts live under `.scratch/performance-audit/journal-1k/` and in spec D3.

Inline Undo now uses a signed owner-bound server snapshot and rejects changes made after the edit. It restores lifecycle, confirmation provenance, transit and derived metrics atomically. Missing-only aircraft assignment is enforced at the write boundary; import replacement remains explicit. Unknown DELETE outcomes require an authoritative owner-bound read before restoring rows; failed reconciliation preserves the uncertain hidden state and offers Refresh list.

## Acceptance evidence

- `pnpm test`: 57 API files, 631 tests passed (`/tmp/journal-final-all-tests.log`). After the last client fixes, `pnpm --filter @kuuki/next test`: 111 files, 898 tests passed (`/tmp/journal-complete-client-tests.log`).
- `pnpm typecheck`, `pnpm typecheck:api`, `pnpm lint`, `pnpm next:build`, and `pnpm --filter @kuuki/next typecheck:worker` passed. Logs: `/tmp/journal-complete-types.log`, `/tmp/journal-final-api-types.log`, `/tmp/journal-complete-lint.log`, `/tmp/journal-complete-build.log`, `/tmp/journal-complete-worker-types.log`.
- `KUUKI_NEXT_PORT=8815 pnpm next:smoke` passed the composed Worker and share-card checks (`/tmp/journal-complete-smoke.log`).
- `KUUKI_NEXT_PORT=8815 pnpm test:next:navigation`: all 38 browser tests passed (`/tmp/journal-accepted-navigation.log`). An unrelated Settings test now selects the accessible form rather than its hidden outgoing route copy; no timeout was increased.
- Three independent Sol 6.1 high review rounds identified and closed mutation safety findings. The final review confirmed authoritative reconciliation and stale-cache Undo handling; no residual finding remained in that review scope.

All 19 tickets are done. DESIGN.md records the Journal exceptions. The measurement met the median 1.5 s interaction target, with the first-run outlier retained explicitly. No further implementation work is pending. Physical-phone performance and production deployment are not verified by local checks; no push, PR or deployment was performed.

Builds and runtime fixtures share `.wrangler/next-build`; run them serially. Port 8800 belongs to a prior fixture outside this session's ownership. Use free configured ports and stop only processes/sessions this work starts. Current work is not deployed.
