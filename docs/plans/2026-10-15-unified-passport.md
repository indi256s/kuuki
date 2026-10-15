Plan contract: wave-plan/v1

# Unified Passport / Profile Implementation Plan

Goal: one Passport page replaces the separate Passport and Profile pages. `/passport` is the owner view and `/fly/[username]` the public view of the same structure. It covers every accepted decision in the spec: stamp cards, filters, pending block, country sheet, hidden countries, opt-in all-sources publication, the flat atlas, achievements and rankings.
Architecture: one server-assembled `PassportPageData` per viewer: owner, visitor, or owner previewing as a visitor. All three render through a shared client tree in `apps/next/src/client/passport/`. The public boundary stays server-side in `functions/api/_services/publicProfiles.ts`, and "View as visitor" reads that projection rather than hiding owner fields with CSS (ADR 0007). Two additive D1 tables and columns carry the new owner state: hidden countries and publication scope. Stamps come from the finished `CountryStamp` pipeline (`apps/next/src/client/stamps`). The atlas is a new flat MapLibre view that shares the collection's filter model and opens the same country sheet.
Success: the owner sees the visited total once, plus a hidden-country count when one exists. The page shows the collection as `CountryStamp` cards, the toolbar (search, Cards/Map, Filters with an active-condition count, compact sort, an owner menu with Edit and View as visitor), a pending block with an "Awaiting · N" entry, achievements with the nearest rung, rankings, and a labelled flight block. A visitor sees only the permitted projection, sorted by name, with no dates or sources. Hide works with Undo and can be restored from "Hidden". A public profile keeps its flights-only set until the owner opts in, and opting out restores it. The atlas filters and opens sheets identically. Every state (loading, empty, filtered-empty, pending, error with retry, ready) is distinct. RU/EN, light/dark, reduced motion, 320px and 200% text all work. `KUUKI_NEXT_PORT=8801 pnpm verify:cloudflare` exits 0.
Out of scope: remote D1 migrations and deployment, which need their own authorization through `deploy-kuuki` and the release runbook. Also out: push or PR, new stamp art (owner notes go through `/dev/stamps`), and Compare/Share records (record-sharing feature). Changes to flight metrics, transit rules or leaderboard consent are out too. Ground-travel input stays in its own journal.
Constraints: AGENTS.md, CODING_STANDARDS.md, DESIGN.md (tokens only, no literals in components), GLOSSARY.md (Passport, Stamp, Hidden country, Profile, Profile visibility). Follow the shared-checkout procedure in `docs/agents/shared-checkout.md`. Owner preferences from memory apply: no divider hairlines between rows inside cards or sheets, and copy leans sarcastic with facts kept correct (`glados-copy` skill). Motion durations follow the user's global table and the stamp motion grammar in the spec ("Принято: движение штампа"). Work happens in the worktree `feat/passport-unified`. Executor preferences: Opus primary orchestrates; Sonnet 5.5 workers handle self-contained tasks; there is one final review only, on codex `gpt-6.1-sol` with `reasoningEffort: high` through T3 `delegate_task`, and no per-wave reviews. UI or design audits, if wanted, go to Opus `effort: high`.
Planning basis: spec `.scratch/passport-profile/spec.md`. The "Итог после DXE" section takes precedence over rounds 1–6; Q25/Q28 remove-means-hide. ADR `docs/adr/0007-unified-passport-publication-boundary.md`. Stamp handoff `docs/plans/2026-10-13-passport-stamp-pipeline-handoff.md`. Prior profile plan `.scratch/profile-redesign/plan.md` (21.1b shipped). Repository evidence (2026-10-15, main `5385108a`) follows.

- `/passport` renders `client/reads/passport.tsx`, which uses `client/passport/{collection,country-sheet,add-country-sheet,model}` and `RouteMapPanel`. Query state lives in `lib/url-state.ts:74-118`: `view`, `sort`, `layer`, `country`, `year`.
- `/fly/[username]` renders `client/profile/profile-content.tsx` and `sections.tsx`.
- `/me` currently redirects to `/fly/<username>` (`app/me/page.tsx`).
- `readPassport` (`functions/api/_services/passport.ts:74-140`) already returns every source with first and last dates from `country_visit_evidence`.
- The public `countries` set is flights-only and undated (`publicProfiles.ts:56-66`), and `getOwnStamps` (`server/profile.ts:37-52`) is flights-only.
- No hidden-country or publication-scope storage exists.
- `CountryStamp` is used only under `/dev/stamps`.
- `maplibre-gl` 6.13 is installed; `react-map-gl` is not.
- The latest migration is `db/migrations/0012_*`.
  Assumptions (design choices, reversible) are marked **[choice]** in the waves.
  Execution profile: primary=runtime-selected; workers=runtime-selected; reviewers=independent-runtime-selected; exact-profile-attestation=not-requested
  Authority evidence: owner, 2026-10-15 thread. They asked to continue implementing the unified passport/profile page in one release, with only this plan written here and execution in a separate T3 thread. Landing on local main, pushing, deploying and running remote D1 migrations are not authorized by this plan.

## Execution map

| Wave | Outcome                                                                                                          | Depends on                      | Writes (active owner)                                                                                                                                                                                                                                                                                                                   | Reads / validates                                 | Parallel-safe with                                          | Material risk → primary proof                                                  | Acceptance owner |
| ---- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------- |
| W1   | Storage + server contracts: hidden countries, publication scope, unified page data for owner / visitor / preview | —                               | `db/migrations/0013_*.sql`, `functions/api/_services/{passport,publicProfiles}.ts`, `functions/api/passport/hidden/**`, `functions/api/profiles/me*` (publication field), `functions/test/passport-*.test.ts`, `packages/shared/**` passport types, `apps/next/src/server/{passport,profile}.ts` (W1)                                   | `country_visit_evidence`, ADR 0007, GLOSSARY      | —                                                           | private data leaks into public projection → API tests over projection matrix   | primary          |
| W2   | Shared page, collection, filters, sheet, hide/undo, pending, achievements, routes                                | W1                              | `apps/next/src/client/passport/**` (except `atlas/`), `apps/next/src/client/reads/passport.tsx`, `apps/next/src/client/profile/**`, `apps/next/src/app/(member)/passport/**`, `apps/next/src/app/(public)/fly/**`, `apps/next/src/app/me/**`, `apps/next/src/lib/url-state.ts`, nav/avatar-menu/route-transition links, copy files (W2) | W1 contracts, `client/stamps`                     | W3 after the W2 filter-model + sheet API commit is accepted | owner/visitor divergence, broken old links → unit + navigation tests           | primary          |
| W3   | Flat atlas view                                                                                                  | W1; W2 filter model + sheet API | `apps/next/src/client/passport/atlas/**`, `apps/next/package.json` / lockfile if a dep is added (W3)                                                                                                                                                                                                                                    | `client/maps/**` (read; overview globe untouched) | W2 remainder                                                | map captures scroll / small states unreachable → component test + browser lane | primary          |
| W4   | Settings opt-in with preview, owner menu wiring, docs, full evidence                                             | W2, W3                          | `apps/next/src/client/account/settings-form.tsx` (publication section), `GLOSSARY.md`, `docs/adr/0007-*` status note, `docs/README.md`, `.scratch/passport-profile/spec.md` Status line, this plan's handoff (W4)                                                                                                                       | everything                                        | —                                                           | silent publication widening → settings test + API test                         | primary          |

`apps/next/src/client/passport/model.ts` belongs to W2. W3 consumes its exported filter API read-only, and changes go through W2's owner.

## W1: Storage and server contracts

Objective: the server can answer three questions exactly. What does the owner see (all sources, dates, hidden list)? What does a visitor see (the permitted projection)? What would a visitor see if the owner published everything (preview)?
Owned writes: see map row W1.
Implementation:

- Migration `0013_unified_passport.sql`, additive only:
  - `passport_hidden_countries(user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE, country_code TEXT NOT NULL CHECK(length(country_code)=2), hidden_at TEXT NOT NULL, PRIMARY KEY(user_id, country_code))`.
  - `profiles.passport_publication TEXT NOT NULL DEFAULT 'flights' CHECK (passport_publication IN ('flights','all'))`. Existing profiles keep `'flights'`, so the old composition is preserved (Q25).
  - Match the FK target and column names to `0001_init.sql`.
- Hide is presentation only (Q28). `readPassport` returns `hidden: string[]` and excludes those countries from the collection and the visible count. It keeps `pressedCountryCount` as the factual total, so the owner UI can show "N visited · K hidden". Source records, `country_visit_evidence` and flight statistics are untouched.
- API: `POST /api/passport/hidden {countryCode}` hides a country and `DELETE /api/passport/hidden/:code` restores it. Both are idempotent, owner-auth, catalog-validated, and bump the revision the way existing passport writes do. Hiding a pending-only country is rejected **[choice]**, because pending has its own confirm action.
- Public projection (`readPublicProfile`):
  - `flights` keeps the current behaviour.
  - `all` returns every pressed country from any source, never pending.
  - Hidden countries are removed in both modes.
  - The output is `countries: string[]` only: no dates, counts, sources or routes, sorted by code. The client sorts by localized name.
  - Add `publication` to the payload so the owner bar can describe it.
  - A private profile still returns the private shell.
- Preview: `readPublicProfilePreview(db, ownerId, scope)` runs the same projection for the owner, ignoring `is_public`, with an explicit scope. It feeds "View as visitor" and the Settings preview. It must share the code path with `readPublicProfile`, not duplicate it.
- `PATCH /api/profiles/me` accepts `passportPublication: 'flights'|'all'`.
- Next server: `getOwnPassport` gains identity (display name, username, avatar, visibility, publication), achievements and rankings inputs, taken from what `getOwnProfileStats` and the profile page read today, so `/passport` needs one server call. Add `getPublicPassport(username)` and `getOwnPublicPreview()`. Retire `getOwnStamps` once W2 stops using it.
  Dependencies: existing evidence pipeline; ground-travel evidence already feeds `country_visit_evidence`.
  Focused proof:
- The projection matrix is the leak risk. API tests cover `{public, private} × {flights, all} × {flight, ground, claim, pending, hidden}` evidence. They assert the exact `countries` set and the absence of date, count and source keys (assert on serialized JSON keys).
- Hide/restore tests check idempotency and auth, and that `pressedCountryCount` does not change.
- `pnpm test:api`, `pnpm typecheck:api`.
- Apply the migration to local D1 only, with the same local migration command existing API tests use.
  Accept when: the tests above pass, the migration applies cleanly to a fresh local DB, and the primary has read the projection diff line by line.

## W2: Shared page and collection

Objective: `/passport` and `/fly/[username]` render the same structure from `PassportPageData`, with owner-only controls present only in owner mode.
Owned writes: see map row W2.
Implementation:

- **Routes (Q9).**
  - `/passport` is the owner page.
  - `/passport?as=visitor` renders the server preview with a "Preview as visitor" bar and a way back. A private owner sees what would be published.
  - `/fly/[username]` renders the public projection. If the viewer is the owner, show a slim bar linking to `/passport` **[choice]**.
  - `/me` and the "My profile" entries in the nav and avatar menu point to `/passport`.
  - Keep `?country=`, `?view=map`, `?sort=`, `/passport/manage?countryCode=` and the closed/not-found covers. `?layer=` and `?year=` are tied to the old route map; normalize them away with a redirect to the canonical URL **[choice]**. Update `route-transition-pairs` and `route-focus` for the new modes.
- **Order (Q7).**
  1. Compact identity: avatar, name, owner menu.
  2. Totals: "Visited N countries"; owner with hidden also gets "· K hidden"; "Found N of M" under filters, where M is the visible collection or, for visitors, the public set.
  3. Toolbar.
  4. Collection.
  5. Pending block (owner only).
  6. Achievements: owner sees the nearest rung with remaining progress, visitor sees only earned ones (Q22); reuse the existing ladders and cabinet unboxing.
  7. Rankings.
  8. Small labelled flight block. The achievement label becomes "Countries on flights".
  - Owner remarks narrator line, founding-crew badge and share stay owner-side as in 21.1b.
- **Toolbar (DXE).**
  - Always visible: search, Cards/Map, and Filters with a badge for the active count.
  - Compact sort. Owner: Recent (default), Name, Records; undated countries go after dated ones. Visitor: name only, so no sort control appears.
  - Reset appears only when filters are active.
  - Owner menu: Edit profile (goes to Settings), View as visitor, Hidden (K), Add country.
- **Filter model.** This is a pure module in `model.ts`, unit-tested and exported for W3.
  - Search, region, and multi-source (Flights / Trains / Road trips / Manual).
  - OR within sources, AND across groups (Q24). A mixed-source country matches each applicable source.
  - Visitors get no sources filter.
  - The source filter never changes what "last visit" means.
  - Filter state lives in the URL, survives the Cards/Map switch and is restored on back.
  - Search filters only. If no match exists and the query names an unvisited catalog country, show a separate "Add {country}" suggestion (owner) or just the name (visitor) (Q27).
- **Card (Q19 refined by DXE).**
  - `CountryStamp` (size per DESIGN tokens; mobile 2-up, 1-up when narrow or at 200% text), the name, last known date, and compact source marks. The first date belongs in the sheet.
  - The whole card is one button reachable by keyboard.
  - Visitor card: stamp and name only.
  - Motion follows the spec grammar: rest tilt; hover straightens after a 60ms delay; keyboard focus straightens instantly; press does a mini impression; a new stamp gets one full impression through `impressionId` (newly pressed since the last seen revision); pending shows a dashed uninked outline.
  - Search and filters apply instantly.
  - Reduced motion uses opacity only.
- **Pending (DXE).** A separate block after the collection. Add an "Awaiting confirmation · N" entry above the collection that scrolls and focuses the block. Confirming plays the impression. Ground plans never appear here.
- **Country sheet (Q12, Q26).**
  - Side panel on desktop, bottom sheet on mobile, focus handed in and returned on close, Escape closes it.
  - Opening with the pointer grows the stamp into the sheet illustration; opening from the keyboard skips the hero.
  - Owner sees the large stamp, visit history with first and last dates, sources, links to records, edit/remove for manual claims, and **Hide from passport**. Hiding shows a toast with Undo through the existing ToastSlot.
  - Visitor sees the stamp and name.
  - "Hidden" opens a list with Restore.
- **States.** loading / empty / filtered-empty / pending-only / error / ready, kept distinct.
  - A refresh error keeps the last content and offers retry (existing `ReadFreshness`).
  - A processing error is never shown as an empty passport.
- **Copy.** RU/EN with real plural forms (existing i18n helpers). Narrator-style lines use the `glados-copy` skill; trust, error and validation copy stays calm.
- Remove the dead profile pieces (stamp strip, standalone holder page) once nothing imports them. Keep `badge-notifications`, `founding-crew` and `remarks`.
  Dependencies: W1 contracts; `client/stamps` public API (`CountryStamp`, `stampNames`).
  Focused proof:
- Unit tests for the filter model (OR/AND, mixed source, visitor without sources), sort (undated last, visitor by name), and the totals text (hidden count, Found N of M).
- Page tests for the owner/visitor/preview matrix (owner-only controls absent in visitor and preview DOM) and state rendering.
- Update the existing `passport`, `country-sheet` and `profile-page` tests rather than duplicating them.
- Update `tests/navigation.test.ts` / `tests/passport.test.ts` for `/me`, `?country=`, `?view=map` and `/passport/manage?countryCode=`.
- Run `pnpm --filter @kuuki/next test` and `pnpm typecheck`.
  Accept when: the tests pass. The primary has also checked `/passport` and `/fly/<user>` with agent-browser at 390 and 1440, light and dark, using fixtures with 0, 1, 16 and 150 countries. This is a functional and layout check, not a pixel review.

## W3: Flat atlas

Objective: Cards/Map switches to an interactive flat atlas showing the same filtered countries and the same total.
Owned writes: see map row W3.
Implementation:

- Flat projection (not the Overview globe) with zoom, country labels, and visited countries filled with the theme accent token. Unvisited countries are neutral. Pending countries are shown distinctly, owner only.
- Tapping a country opens the W2 sheet. Selecting an unvisited country gives the owner Add country and the visitor just the name.
- Small states (for example MC, SM, VA, LI, Caribbean islands) get enlarged hit targets or point markers, and the toolbar search can reach them.
- Ordinary page scroll is never captured. Wheel zoom needs a modifier or happens after focus, and touch uses two-finger pan.
- Every map action has a keyboard alternative, the list remains the accessible path, and the map region has an accessible name.
- **[choice]** Build on the existing `maplibre-gl` wrapper (`client/maps/mapcn.tsx`) with country polygons the repo already ships, if available; check `client/maps` and the overview `country-evidence`. Add `react-map-gl` only if the wrapper cannot handle interaction, and record why in the handoff (Q20 left the stack check to implementation). Context7 is the current source for MapLibre docs.
- Remove the old `RouteMapPanel` layers (`routes`, `frequency`) from the Passport; routes belong to journals and Overview (Q17). `client/maps` stays in use by others.
  Dependencies: W1 data, W2 filter model and sheet open API.
  Focused proof:
- A component test asserts the filtered country set drives the fill expression and that a feature click calls the sheet opener.
- Browser lane: wheel over the map at default state scrolls the page, and MC is reachable from search and by click at the default zoom.
  Accept when: the tests pass, and the browser lane passes at 390 and 1440.

## W4: Publication opt-in, docs, evidence

Objective: the owner can widen publication explicitly after a preview and narrow it again; docs match the shipped behaviour.
Owned writes: see map row W4.
Implementation:

- Settings gets a publication section (Q25): "Publish all confirmed countries", explaining that ground and manual countries are added, with an inline preview of the resulting public collection from `getOwnPublicPreview('all')`. Switching it off returns to flights-only.
- The owner menu's View as visitor reflects the current scope.
- A private profile shows the control but explains that nothing is public.
- Update GLOSSARY (Passport visibility/publication if missing, Hidden country), the ADR 0007 implementation note, the `docs/README.md` behavioural entry points for Passport, and the spec Status line.
- Write `docs/plans/2026-10-15-unified-passport-handoff.md` recording the candidate SHA, migrations needing remote application, the evidence, and open judgements.
  Dependencies: W1–W3.
  Focused proof: a settings test proves the default stays `flights` and that the PATCH is sent only after explicit confirmation. The W1 API tests already cover the projection.
  Accept when: the final evidence gate passes.

## Final evidence gate

Identity: every lane validates the same commit on `feat/passport-unified`, a clean tree except scratch evidence; record the SHA in the handoff.

| Lane       | Proves                                                                                                                                                                                     | Command or scenario                                                                                                                                   | Success signal                                                                                             | Parallel-safe   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------- |
| full gate  | format, lint, stamps, types, unit/API tests, build, worker smoke                                                                                                                           | `KUUKI_NEXT_PORT=8801 pnpm verify:cloudflare` (port may need to change if occupied; never kill foreign PIDs)                                          | exit 0                                                                                                     | no (owns port)  |
| navigation | old links, `/me`, `?country=`, `?view=map`, `/manage` redirect                                                                                                                             | `pnpm test:next:navigation`                                                                                                                           | exit 0                                                                                                     | after full gate |
| browser    | owner / visitor / preview / private / not-found at 390 and 1440, light and dark, RU and EN; fixtures with 0/1/16/150 countries plus hidden and pending; reduced motion; 200% text at 320px | agent-browser against the local dev server (`dev-kuuki` skill), screenshots downscaled with `sips -Z 1200` into `.scratch/passport-unified/evidence/` | no layout overflow, owner controls absent outside owner mode, sheet focus returns, map doesn't trap scroll | yes             |
| review     | independent code review of the whole diff vs merge-base                                                                                                                                    | T3 `delegate_task` → codex `gpt-6.1-sol`, `reasoningEffort: high`; confirmed findings fixed, then the full gate re-run once                           | no open P0/P1                                                                                              | —               |

Final acceptance (primary, serial): every Success criterion is met. No public payload carries dates, counts or sources, and hidden countries are absent from both public modes. Flight metrics and leaderboard outputs are unchanged, as shown by existing tests passing unmodified. The handoff lists `0013_unified_passport.sql` as needing separate remote authorization. Landing on local main waits for owner approval.
