# Sticker atlas: handoff

Plan: [2026-11-07-sticker-atlas.md](2026-11-07-sticker-atlas.md). Spec: `.scratch/sticker-atlas/spec.md` (committed on this branch).

## Owning checkout

- Worktree `/Users/indi256/.t3/worktrees/kuuki/feat-sticker-atlas`, branch `feat/sticker-atlas`, based on local `main` `cc4f9844`.
- Landing: per [shared-checkout Git](../agents/shared-checkout.md). The root `main` holds other owners' unstaged hunks in `DESIGN.md`, `GLOSSARY.md` and `docs/README.md`, and untracked copies of the spec and plan, so `land` (fast-forward) refuses those paths. Land the code commits first, then commit the overlapping paths through `prepare --patch` + `commit`.

## Progress

| Wave                                                                                  | State     | Commit        |
| ------------------------------------------------------------------------------------- | --------- | ------------- |
| Inputs (spec, plan)                                                                   | committed | `5a8b2ec9`    |
| W1 data: migration `0018`, POST `mode`, PATCH, source model, CSV                      | accepted  | `b022f721`    |
| W3 atlas sticker: `peel.ts`, `sticker.tsx`, `quick-visit.ts`, `markSeen`, eligibility | accepted  | `9afce86a`    |
| W2 country sheet: four ways, Edit (Sonnet worker, diff reviewed)                      | accepted  | `14a69722`    |
| W4 docs: DESIGN Passport + Motion rule, GLOSSARY, docs/README                         | accepted  | see `git log` |

Deviations from the plan, all deliberate:

- `apps/next/api-capture.ts` (not in W1's list) dispatches the new PATCH; without it the Worker sent every method on `/ground-visits/:id` to DELETE.
- Validation shared by POST and PATCH lives in `functions/api/_lib/groundVisits.ts` instead of the route module.
- The new POST/PATCH API tests live in `functions/test/passport.test.ts`, next to the existing ground-visit POST tests.
- The atlas stamp's `impressionId` is per tear (`passport-atlas:<owner>:<cc>:<n>`), not `passport-new:<owner>:<cc>`: `markSeen` already keeps the cards from replaying it, and a per-tear id lets a re-add after Undo press again.
- The toast has no close callback, so the landed stamp leaves on the toast's own 8 s timer rather than on its exit.
- `DESIGN.md` bans ease-in; the spec's tear uses it. DESIGN now names the tear as the one exception.

## Final evidence gate

Candidate: _pending_

| Lane              | Result    |
| ----------------- | --------- |
| types             | _pending_ |
| lint/format       | _pending_ |
| unit + API        | _pending_ |
| build             | _pending_ |
| journeys          | _pending_ |
| browser (Sonnet)  | _pending_ |
| review (Sol high) | _pending_ |
| remote D1 `0018`  | _pending_ |

Owner-run motion feel check (spec "Feel check"): pending, on a preview. Deploy: not authorized.

## Carried issues

- [01 legacy land edit thumb](../../.scratch/sticker-atlas/issues/01-legacy-land-edit-thumb.md)

## Inputs needed to resume

- Committed: `.scratch/sticker-atlas/spec.md` and `docs/plans/2026-11-07-sticker-atlas.md` (commit `5a8b2ec9`).
