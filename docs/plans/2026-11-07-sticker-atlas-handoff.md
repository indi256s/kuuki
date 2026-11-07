# Sticker atlas: handoff

Plan: [2026-11-07-sticker-atlas.md](2026-11-07-sticker-atlas.md). Spec: `.scratch/sticker-atlas/spec.md` (committed on this branch).

## Owning checkout

- Worktree `/Users/indi256/.t3/worktrees/kuuki/feat-sticker-atlas`, branch `feat/sticker-atlas`, based on local `main` `cc4f9844`.
- Landing: per [shared-checkout Git](../agents/shared-checkout.md). The root `main` holds other owners' unstaged hunks in `DESIGN.md`, `GLOSSARY.md` and `docs/README.md`, and untracked copies of the spec and plan, so `land` (fast-forward) refuses those paths. Land the code commits first, then commit the overlapping paths through `prepare --patch` + `commit`.

## Progress

| Wave                                                                                  | State     | Commit     |
| ------------------------------------------------------------------------------------- | --------- | ---------- |
| Inputs (spec, plan)                                                                   | committed | `5a8b2ec9` |
| W1 data: migration `0018`, POST `mode`, PATCH, source model, CSV                      | accepted  | `b022f721` |
| W3 atlas sticker: `peel.ts`, `sticker.tsx`, `quick-visit.ts`, `markSeen`, eligibility | accepted  | `9afce86a` |
| W2 country sheet: four ways, Edit (Sonnet worker, diff reviewed)                      | accepted  | `14a69722` |
| W4 docs: DESIGN Passport + Motion rule, GLOSSARY, docs/README                         | accepted  | `142d92b9` |
| Sol review fixes: schema `IS 'land'`, PATCH compare-and-set, page-held quick writes   | accepted  | `f35c3d83` |

Deviations from the plan, all deliberate:

- `apps/next/api-capture.ts` (not in W1's list) dispatches the new PATCH; without it the Worker sent every method on `/ground-visits/:id` to DELETE.
- Validation shared by POST and PATCH lives in `functions/api/_lib/groundVisits.ts` instead of the route module.
- The new POST/PATCH API tests live in `functions/test/passport.test.ts`, next to the existing ground-visit POST tests.
- The atlas stamp's `impressionId` is per tear (`passport-atlas:<owner>:<cc>:<n>`), not `passport-new:<owner>:<cc>`: `markSeen` already keeps the cards from replaying it, and a per-tear id lets a re-add after Undo press again.
- The toast has no close callback, so the landed stamp leaves on the toast's own 8 s timer rather than on its exit.
- `DESIGN.md` bans ease-in; the spec's tear uses it. DESIGN now names the tear as the one exception.

## Final evidence gate

Candidate: `f35c3d83` (code); this handoff commit sits on top.

| Lane              | Result                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| types             | pass (`pnpm typecheck`, `pnpm typecheck:api`)                                                                                                                                                                                                                                                                                                                               |
| lint/format       | pass: 0 errors (14 pre-existing warnings); oxfmt clean on changed files                                                                                                                                                                                                                                                                                                     |
| unit + API        | pass: API 84 files / 1015 tests, Next 221 files / 1885 tests                                                                                                                                                                                                                                                                                                                |
| build             | pass (`pnpm next:build`, 85 API routes)                                                                                                                                                                                                                                                                                                                                     |
| journeys          | pass: 61 passed, 1 skipped; the known `welcome.test.ts:132` flake failed once and passed 3/3 in isolation; dock journey passed. The first run (on `9121dff4`) caught the CSV journey still pinned to the old header; fixed in `f35c3d83`                                                                                                                                    |
| browser (Sonnet)  | pass at 1440×900 and 390×844: lift with four tabs, Train → toast + fill, Cards train mark, Trains includes / Manual excludes, Undo removes (also after reload), a filtered tap opens the sheet; console clean                                                                                                                                                               |
| review (Sol high) | five should-fix findings, all fixed in `f35c3d83`: (1) duplicate quick-adds across a map remount and stale Retry, (2) PATCH lost update, (3) `0018` CHECK let a mode through on a NULL entry, (4) optimistic ink ignored filters, (5) unmount mid-tear dropped Undo. Each has a regression test except (2), a compare-and-set returning 409 with no deterministic race seam |
| remote D1 `0018`  | applied 2026-11-07 19:09Z under writer hold (≈4.5 min); see below                                                                                                                                                                                                                                                                                                           |

Remote `0018` evidence (private, `~/.local/state/kuuki/backups/2026-11-07-0018`, see `RECOVER.txt` there):

- Target `kuuki-db` `2a8e3895-6a98-4473-8d7b-a43ca0c0026f`. Ledger before (read-only `SELECT`): 18 rows, `0001`–`0017` (two `0011`), exactly the local files minus `0018`.
- Writers: `kuuki-next`, `kuuki-activation` (settings edit to `MAINTENANCE_MODE=true`), `kuuki-maintenance` (its existing held version `86ea8999`, same code etag); `kuuki-import` has no hold binding and is reachable only through `kuuki-next`. All 14 D1 entrypoints blocked under hold.
- Backup: Time Travel bookmark `000003d2-00000000-0000511c-404454a9a8081f93eda79a83eaf6dc78`, unchanged across the held export and typed capture; SQL export plus a typed row supplement (571,912 rows). Restore proof: the supplemented backup restores every row exactly (the export alone loses REAL precision on 495 `airports_reference` rows); `0018` rehearsed on that copy.
- Schema admission under hold: seven dimensions match a fresh `0001`–`0017` fixture; hashes equal the 29 October admission.
- After: ledger 19 rows ending `0018_ground_visit_mode.sql`; `PRAGMA table_info(ground_visits)` shows `mode TEXT`; 43 tables byte-identical, all 15 ground visits preserved with `mode` NULL, live CHECK uses `IS 'land'`.
- Released to the exact pre-hold versions (`aa9c2782`, `a7ed84e4`, `48254948`); read-only smoke 200.

Owner-run motion feel check (spec "Feel check"): pending, on a preview. Deploy: not authorized.

## Carried issues

- [01 legacy land edit thumb](../../.scratch/sticker-atlas/issues/01-legacy-land-edit-thumb.md)

## Inputs needed to resume

- Committed: `.scratch/sticker-atlas/spec.md` and `docs/plans/2026-11-07-sticker-atlas.md` (commit `5a8b2ec9`).
