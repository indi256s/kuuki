Plan contract: wave-plan/v1

# Sticker Atlas Implementation Plan

Goal: On the owner's Passport map, an unrecorded country is a sticker. A tap lifts it with pull tabs (Train · Car · Sea · Other). Tearing it off by a tab records a land or sea visit with that way, presses the country's stamp on the map and offers Undo. Nothing else appears in the moment: no form, no sheet, no year.
Architecture: Four bounded changes. (1) Data contract: `ground_visits.mode` (`rail` | `road`, land only), `mode` on the POST, a new `PATCH /api/passport/ground-visits/:id`, and the Passport source model reading modes from visits. (2) Country sheet parity: the same four ways in "How you entered", and Edit on visit rows. (3) Atlas sticker: an SVG overlay over the MapLibre canvas that projects the country outline with `map.project()`, fold geometry in a pure module, the lift/tab/tear interaction, and an optimistic write with Undo. (4) Docs.
Success: As the owner on `/passport` in the Map view with no search or filter: tapping an unrecorded country lifts it within 200 ms with four tabs. Tapping "Train" writes one `ground_visits` row (`entry_method='land'`, `mode='rail'`), the country's fill turns `--accent`, its stamp lands, and a toast offers Undo. Undo deletes exactly that row. The country then appears under the Trains filter and the "По земле" map scope, not under Manual. A drag released before the threshold writes nothing. Visitors, the visitor preview, filtered or searched views, microstate markers, and pressed, pending or hidden countries keep today's tap-to-sheet. Reduced motion has no scale, camera flight or peel.
Out of scope: Auto-peel for countries pressed elsewhere (a later idea). Microstate stickers. A plane tab. Any follow-up after the stamp (year chips, a "how?" question). The Add country sheet redesign. Stickers in visitor views. Overview, leaderboard and publication semantics (mode never leaves the owner projection). Motion recordings by agents (the owner runs the feel check in the spec). Deploys (not authorized). Remote D1 migration `0018` is authorized (see Authority evidence) and runs only through the final-gate lane below.
Constraints: Run commands from the workspace root. Execute in a dedicated worktree on branch `feat/sticker-atlas`. The root `main` is shared and dirty (others own `GLOSSARY.md`, `DESIGN.md`, `docs/README.md` and `apps/next/src/client/journal/**` hunks). Land per `docs/agents/shared-checkout.md`. Read `DESIGN.md` (Passport, Motion), `CODING_STANDARDS.md` and `~/.claude/docs/motion-durations.md` before UI edits. EN and RU copy through the `glados-copy` skill, with «вы» and no gendered first-person verbs. Migrations are additive (`CODING_STANDARDS.md` §5). After changing exported HTTP methods, run `node scripts/build-next.mjs --inventory-only` and commit `apps/next/api-routes.generated.ts`. Owner execution preferences: one implementation subagent at a time (Sonnet), the main thread judges and inspects each diff, browser checks on Sonnet, one Playwright run only at the end, and one final code review on GPT-6.1 Sol at `high` through T3 `delegate_task` (omit `runtimeMode`). No visual inspection beyond the functional browser lane, because the owner did not request one.
Planning basis: Spec `.scratch/sticker-atlas/spec.md` (Flow, Eligibility, What each tab writes, Data, Interaction contract, Motion, Acceptance; its Rejected table lists the ideas not to revive). Repository evidence:

- The atlas is MapLibre on WebGL. Tap → `onSelect` (`apps/next/src/client/passport/atlas/map.tsx:211`). Paints come from `--accent` / `--accent-tint` / `--map-land` (`map.tsx:131`). Microstates are 44 px points (`atlas/small-states.ts`). Cooperative gestures (`client/maps/options.ts:28`).
- The country sheet's visit form offers land/sea + year + note and calls `addGroundVisit` (`passport/country-sheet.tsx:548–613`).
- The `ground_visits` CHECK allows only `land` or `sea` (`db/migrations/0001_init.sql:180`). The POST validates `entryMethod` (`functions/api/passport/ground-visits/index.ts:59`). DELETE exists (`ground-visits/[id].ts`); there is no PATCH.
- The client API lives in `packages/client/src/passport.ts:67`. Types: `EntryMethod`, `GroundVisit` (`packages/shared/src/types.ts:249,270`).
- Sources: Trains/Road come only from journeys (`functions/api/_services/passport.ts:128`, `apps/next/src/client/passport/model.ts:174–179`). Any ground visit marks Manual (`model.ts:179`). The service already returns `groundVisits` with `entry_method` (`passport.ts:104,178`).
- The "По земле" map scope is `src=trains,road` (`model.ts:51`).
- New-stamp baseline: `unseenCountries` (`passport/new-stamps.ts`), consumed once in `useFreshStamps` (`passport-page.tsx:106`). Impression ids are `passport-new:<owner>:<cc>`. `CountryStamp` plays `cs-press-in` once per id (`stamps/country-stamp.tsx:152`).
- The toast has a single action (`client/ui/toast.tsx:31`). Hide uses Undo with bilingual copy (`passport-page.tsx:293`).
- The pattern for a column CHECK on `ADD COLUMN` is in `db/migrations/0015_avatar_face.sql`. API tests replay migrations in Miniflare (`functions/vitest.config.ts:13`).
- The atlas tests mock `mapcn` (`atlas/map.test.tsx:17`).

Assumptions: SQLite accepts a column-level CHECK that references `entry_method` on `ADD COLUMN` (SQLite treats column and table CHECKs alike, and since 3.37 it tests them against existing rows). W1's migration replay proves this, and the fallback is service-level validation only. The 110m geometry is fine for sticker outlines.
Execution profile: primary=runtime-selected; workers=runtime-selected; reviewers=independent-runtime-selected; exact-profile-attestation=not-requested
Authority evidence: Owner messages in this thread on 2026-11-07: the sticker idea; the final two-tap flow («Отлично, пиши спецификацию»); «Запускай новый тред на реализацию с opus 5.5 high» (implementation in a new thread on Opus 5.5 at `high`); «Миграцию одобряю» (apply `0018` to the remote D1 through the runbook gates). This plan grants no deploy authority.

## Execution map

| Wave | Outcome                                                               | Depends on | Writes (active owner)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Reads / validates                                                      | Parallel-safe with                                         | Material risk → primary proof                                                                                                              | Acceptance owner |
| ---- | --------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| W1   | Visits carry a mode; the PATCH exists; filters read modes from visits | —          | `db/migrations/0018_ground_visit_mode.sql`, `functions/api/passport/ground-visits/**`, `functions/api/_lib/passportDtos.ts`, `functions/api/_services/passport.ts`, `packages/shared/src/types.ts` (ground visit types only), `packages/client/src/passport.ts`, `apps/next/src/client/passport/model.ts` (+ test), `apps/next/src/client/account/ground-export.ts`, `apps/next/api-routes.generated.ts`, `functions/test/passport-country-visits.test.ts`, `functions/test/ground-passport.test.ts` (W1) | `countryEvidence.ts` (counts unchanged), `publicProfiles.ts` (no mode) | —                                                          | CHECK rejected by D1, or a mode leaking into the public projection → migration replay in `pnpm test:api` and a publication assertion       | primary          |
| W2   | The sheet speaks the four ways; visit rows are editable               | W1         | `apps/next/src/client/passport/country-sheet.tsx` (+ test), new `apps/next/src/client/passport/visit-ways.ts` (W2)                                                                                                                                                                                                                                                                                                                                                                                        | W1 client API                                                          | W3 (separate files), but run serially per owner preference | The legacy `land` row mislabelled, or an edit writing the wrong row → sheet tests                                                          | primary          |
| W3   | Lift, tabs, tear, optimistic write, Undo on the atlas                 | W1         | `apps/next/src/client/passport/atlas/**` (new `peel.ts`, `sticker.tsx`, `sticker.css`, `quick-visit.ts` + tests; edits to `map.tsx`, `index.tsx`, `atlas.css`), `passport/passport-layout.tsx`, `passport/passport-page.tsx`, `passport/new-stamps.ts` (W3)                                                                                                                                                                                                                                               | `stamps/country-stamp.tsx`, `ui/toast.tsx`, W1 API                     | —                                                          | Tears that fight map gestures, or Undo racing the POST, or a tear replayed as a cards impression → interaction tests with mocked map + API | primary          |
| W4   | Docs reconciled                                                       | W3         | `DESIGN.md` (Passport → Atlas), `GLOSSARY.md` (Ground visit), `docs/README.md` (Passport entry) (W4)                                                                                                                                                                                                                                                                                                                                                                                                      | the shipped W1–W3 code                                                 | —                                                          | Docs claiming behaviour the code lacks → claims checked against code, links resolved                                                       | primary          |

## W1: Ground visits carry a mode

Objective: A land visit can say rail or road. The owner can fix a visit's year, note or way. The Passport filters count a visit by its way.
Owned writes: see the execution map.
Implementation:

- **Migration `0018_ground_visit_mode.sql`:**
  `ALTER TABLE ground_visits ADD COLUMN mode TEXT CHECK (mode IS NULL OR (mode IN ('rail','road') AND entry_method = 'land'));`
  Add a one-line comment in the 0015 style. Existing rows stay `NULL`.
- **POST** accepts `mode` (`'rail' | 'road' | null`). A non-null `mode` requires `entryMethod === 'land'`; otherwise return 400 `INVALID`. Insert and echo `mode`.
- **PATCH `/api/passport/ground-visits/:id`** accepts `{ visitYear?, note?, entryMethod?, mode? }`.
  - Validation is the same as the POST, with the merged row checked for `mode` ⇒ `land`.
  - CSRF and owner scope: `UPDATE … WHERE id = ? AND user_id = ?`. Return 404 when nothing changed.
  - Batch it with `dirtyUserStatement`, then `repairUserDerivedState`, like the POST.
  - Return the updated visit with the derived ack.
  - Regenerate `apps/next/api-routes.generated.ts`.
- **DTOs and types.** `GroundVisitRow` / `toGroundVisit` gain `mode`. Shared `GroundVisit.mode: GroundVisitMode`, where `type GroundVisitMode = 'rail' | 'road' | null`. `addGroundVisit` takes `mode`. Add `updateGroundVisit(userId, id, patch)`.
- **Passport read.** Add `mode` to the owner `ground_visits` select (`passport.ts:104`) and to the country detail select (`passport.ts:320`).
- **Source model** (`model.ts`):
  - A country's rail/road modes are the union of journey modes and its visits' modes.
  - Manual is `claimed || some visit with mode null`.
  - A country whose only visit is `land` + `rail` therefore reads Trains, not Manual.
- **CSV export** adds a `mode` column.
- **Untouched:** country evidence counts, Overview and publication (`publicProfiles.ts` has no mode).

Dependencies: none.
Focused proof:

- CHECK validity → `pnpm test:api` replays migrations.
- New API tests:
  - POST `rail` + `land` is 201; `rail` without `land` is 400.
  - PATCH on another owner's id is 404; PATCH on your own row changes the year and the mode.
  - The public projection carries no `mode`.
- `model.test.ts`: a rail visit gives `trains` and no `manual`; a legacy `land` visit gives `manual`.

Accept when: `pnpm typecheck`, `pnpm typecheck:api`, the affected `pnpm test:api` files and `model.test.ts` pass, and the generated routes file is current.

## W2: The country sheet speaks the four ways

Objective: Adding or editing a visit in the sheet uses the same vocabulary as the tabs, and a visit's year or way can be fixed in place.
Owned writes: `apps/next/src/client/passport/country-sheet.tsx`, `country-sheet.test.tsx`, new `apps/next/src/client/passport/visit-ways.ts`.
Implementation:

- "How you entered" becomes Train · Car · Sea · Other, mapping to `land+rail`, `land+road`, `sea` and no method. Default to Other. The labels and payload mapping live in `visit-ways.ts`, which W3's tabs import.
- Row labels show the mode. A legacy `land` row with no mode reads «По суше» / "By land".
- The visit row menu gains Edit. It opens the same form prefilled and saves through `updateGroundVisit`, with the existing `write()` feedback path.
- Delete is unchanged.

Dependencies: the W1 client API and types.
Focused proof: `country-sheet.test.tsx`:

- Each way sends its payload.
- Editing sends a PATCH for that row's id.
- The legacy label renders.

Accept when: the sheet tests, `pnpm lint` and `pnpm typecheck` pass.

## W3: Lift, tabs and tear on the atlas

Objective: The spec's Flow, Eligibility, Interaction contract and Motion work on desktop and touch.
Owned writes: see the execution map.
Implementation:

- **Peelable set** (`index.tsx` / `passport-layout.tsx`): `owner && !visitorPreview && noSearchOrFilter && isCatalogCountry(cc) && isPolygon(cc) && cc ∉ pressed ∪ pending ∪ hidden`. Microstate point markers (`ATLAS_LAYERS.hit`) always go to `onSelect`. Use the full collection, not the filtered entries. `map.tsx`'s click handler sends a peelable code to `onLift` and everything else to the existing `onSelect`.
- **Geometry** (`peel.ts`, pure, no DOM):
  - `projectOutline(rings, project)` → screen rings.
  - `fold(grab, pointer)` → the fold line (the perpendicular bisector of grab → pointer), the stuck half-plane, the reflection matrix and `progress ∈ [0,1]` along the sticker's extent in the pull direction.
  - The threshold is `progress ≥ 0.4`.
- **Sticker overlay** (`sticker.tsx`, inline SVG over the canvas, `pointer-events` only on the sticker and tabs):
  - Drawing: the face path is clipped to the stuck half-plane. The flap is the same path in a group with the reflection transform, clipped in pre-transform space to the grab side, filled with the paper back and a shadow.
  - It re-projects on the map's `move` events (rAF-coalesced, like `Labels`).
  - The lift is a non-modal group named by the country. Focus goes to the first tab. Esc and outside taps close it and return focus to the map container.
  - The country name is printed on the sticker face (text on the SVG, not a control). Nothing in the lift opens the sheet.
  - After the stamp lands, nothing else appears: no year chips, no follow-up question.
  - Tabs are buttons with `touch-action: none`. On pointerdown, a move over 6 px is a drag and the peel follows the finger; otherwise it is a tap and the peel plays itself.
  - Camera `fitBounds` runs only when the projected outline's longest side is under 96 px. Its duration is scaled by distance, clamped 0–300 ms, and 0 under reduced motion.
- **Tear** (timeline B):
  - At the tear's start, the country's fill is overridden to `--accent` under the sticker. The override is a local paint branch in `map.tsx`, dropped when the refreshed data contains the country or on failure/Undo.
  - Progress is one driven value (rAF or Motion `animate`) with ease-in: 320 ms, or `clamp(120, remaining × 320, 320)` after a drag.
  - At 240 ms, `CountryStamp` (96 px desktop, 72 px phone, at the outline's `centre()`) mounts with `impressionId = passport-new:<owner>:<cc>`, and the toast shows.
  - Interruption: a new tap jumps an in-flight tear to its end. Never stack two stickers.
- **Write** (`quick-visit.ts`):
  - At the tear's start, call `addGroundVisit` with the tab's payload. Wrap it in `trackPrivateOperation`, the auth-generation guard and the existing derived-ack feedback.
  - Mark the code seen in the new-stamp baseline (new `markSeen(ownerId, code)` in `new-stamps.ts`) so the Cards view never replays the tear as an impression.
  - On ack, refresh the passport the way the sheet's `onChanged` does.
  - The toast copy is bilingual (it outlives a locale switch), with Undo. Undo chains after the pending POST, calls `deleteGroundVisit(id)`, and runs the timeline's Undo path.
  - On failure: the Undo path's visuals, plus an error toast with Retry. Retry re-runs the write without the peel and then lands the stamp.
- **Reduced motion:** per the spec, opacity only, with no camera flight.

Dependencies: the W1 API and W2's `visit-ways.ts` (read-only for W3).
Focused proof:

- `peel.test.ts`: zero progress at the grab point; the reflection maps the fold line onto itself; the threshold boundary.
- `map.test.tsx`: a peelable tap → `onLift`; a visited, pending, hidden, filtered or microstate-marker tap → `onSelect`.
- `sticker.test.tsx` (mocked map, API and timers):
  - Tapping Train sends `{entryMethod:'land', mode:'rail'}`.
  - A drag below the threshold sends nothing.
  - Esc closes and sends nothing.
  - Undo before the POST resolves deletes the returned id after it resolves.
  - A failure restores and shows an error.
  - Visitor props render no sticker.

Accept when: those tests, `pnpm lint` and `pnpm typecheck` pass. The primary has read the full W3 diff.

## W4: Docs

Objective: The docs describe the shipped behaviour.
Owned writes: `DESIGN.md` (Passport → Atlas bullet), `GLOSSARY.md` (Ground visit: "land visits may name the way, rail or road"), `docs/README.md` (Passport entry: atlas sticker files and tests).
Implementation: Follow `update-docs-after-feature`. Edit only these hunks in the shared files.
Dependencies: W3 accepted.
Focused proof: the docs' claims are checked against the code, and their links resolve.
Accept when: the claims match the code and the links resolve.

## Final evidence gate

Identity: final lanes validate the same immutable candidate, the `feat/sticker-atlas` head SHA with a clean `git status --short` in that worktree. Record the SHA in `docs/plans/2026-11-07-sticker-atlas-handoff.md`.

| Lane                                   | Proves                                       | Command or scenario                                                                                                                                                                                                                                                                                                                                                            | Success signal                                                                                                                | Parallel-safe                      |
| -------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| types                                  | Contracts compile                            | `pnpm typecheck && pnpm typecheck:api`                                                                                                                                                                                                                                                                                                                                         | exit 0                                                                                                                        | yes                                |
| lint/format                            | Tokens, effects, a11y rules                  | `pnpm lint && pnpm exec oxfmt --check <owned paths>`                                                                                                                                                                                                                                                                                                                           | exit 0                                                                                                                        | yes                                |
| unit + API                             | W1–W3 tests, migration replay                | `pnpm test`                                                                                                                                                                                                                                                                                                                                                                    | exit 0                                                                                                                        | yes                                |
| build                                  | The Next build carries the new route         | `pnpm next:build`                                                                                                                                                                                                                                                                                                                                                              | exit 0                                                                                                                        | no (shares `.wrangler/next-build`) |
| journeys                               | No regression in shared controls or Passport | `pnpm test:next:navigation` (full suite, once)                                                                                                                                                                                                                                                                                                                                 | exit 0                                                                                                                        | no (after build)                   |
| browser (Sonnet, `agent-browser`)      | The integrated owner flow works              | Local preview via the `dev-kuuki` skill, owner fixture with at least one unrecorded country, `/passport` Map view at 1440×900 and 390×844. Tap an unrecorded country → four tabs. Tap Train → toast, accent fill. Cards view shows the country with a train mark. Trains filter includes it, Manual excludes it. Undo removes it. With a filter active, a tap opens the sheet. | All steps pass; console clean; artifact: step log + one downscaled screenshot per viewport (`sips -Z 1200`)                   | no                                 |
| remote D1 (after all lanes above pass) | `0018` is live in production D1              | Follow `docs/runbooks/audit-remediation-release.md`: explicit target `kuuki-db`, writer hold, backup with restore proof, schema admission, then apply only `0018`; read-only ledger check `wrangler d1 execute kuuki-db --remote --json --command "SELECT name FROM d1_migrations ORDER BY id"` before and after                                                               | Ledger lists `0018_ground_visit_mode.sql`; `PRAGMA table_info(ground_visits)` shows `mode`; backup id recorded in the handoff | no                                 |
| review                                 | An independent read of the integrated diff   | T3 `delegate_task`, `providerInstanceId: "codex"`, `model: "gpt-6.1-sol"`, `target.options: {"reasoningEffort":"high"}`, no `runtimeMode`; brief: this plan, the spec and the diff from the merge base                                                                                                                                                                         | Findings resolved or recorded                                                                                                 | yes                                |

Final acceptance (primary, serial):

- Every item in the spec's Acceptance section maps to accepted code or a recorded owner waiver.
- The Success criteria hold in the browser lane.
- The handoff records the candidate SHA, the checks, the owner-run feel check as pending, and the remote `0018` evidence (backup id, ledger before/after) or the blocker that stopped it. Deploy stays a separate request.
