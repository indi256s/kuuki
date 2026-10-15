# Unified Passport handoff

Plan: `docs/plans/2026-10-15-unified-passport.md`. ADR: `docs/adr/0007-unified-passport-publication-boundary.md`. Spec: `.scratch/passport-profile/spec.md` (the "Итог после DXE" section takes precedence).

## State

- Branch `feat/passport-unified`. The code candidate is `88846d4a`; this handoff is the only later commit. Local main `bb63c09d` is merged in.
- Not done: push, PR, deploy and remote D1. Migration `0013_unified_passport.sql` has been applied to local D1 only. Production needs the release runbook (`docs/runbooks/audit-remediation-release.md`) and separate authorization: the writer hold, backup/restore proof and schema admission come first. The migration is additive. It adds `passport_hidden_countries` and `profiles.passport_publication DEFAULT 'flights'`, so existing public profiles keep their flights-only set until the owner opts in.

## What shipped

- `/passport` is the single owner page; `/fly/<username>` is the visitor view of the same tree (`client/passport/passport-page.tsx`, `mode` = owner, visitor or preview). `/me` and the old profile links now lead to `/passport`.
- Visitor and preview pages receive only the public payload from `projectPublic` (`functions/api/_services/publicProfiles.ts`). "View as visitor" (`?as=visitor`) and the Settings preview call `readPublicProfilePreview`, which uses the same code path.
- `CountryStamp` collection with search, filters (region, source) and sort (recent, name, records). The pending block shows "Awaiting · N". The country sheet has Hide, the toast has Undo, and the "Hidden" sheet restores hidden countries.
- Flat MapLibre atlas (`client/passport/atlas/`). It shares the filter model and country sheet, uses cooperative gestures, has 72 small-state points, renders client-only and draws the world once.
- Settings has an opt-in to publish all confirmed countries, with a preview and a confirmation; opting out restores the flights-only set.
- Legacy query params (`layer`, `year`, `period`, `view=stamps`, `sort=visits`) redirect to the canonical URL.
- Docs: GLOSSARY (Passport, Hidden country, Profile, Passport publication), ADR 0007 «Реализация», DESIGN.md "## Passport", docs/README entry.

## Evidence

- The final gate on `88846d4a` was `KUUKI_NEXT_PORT=8801 pnpm verify:cloudflare`. It exited 0 with Next at 200 files / 1758 tests and the API at 73 files / 929 tests; the share-card and Next workerd smoke tests passed.
- Navigation suite: 54/54 on `71ceb052`. The later atlas commit changes only one map call and was not re-run there.
- Browser lane: scenarios 1–10 passed on the local preview, covering EN/RU, light/dark, 1440 and 390 widths, empty, one-country, 150-country, filtered-empty, hide toast, hidden list, sheet, atlas (including Monaco), private, both preview scopes and the Settings opt-in. Screenshots are in `.scratch/passport-unified/evidence/` (untracked). Two defects from the lane were fixed in `71ceb052`: MapLibre rendered during SSR (#419), and the zero-flight remark contradicted the page.
- The final review ran on codex gpt-6.1-sol at high effort against `b7b4a74d`. It found 1 P1 (a publication change during a public read could return the wider set) and 5 P2. All six were fixed in `fb1d4065`, and each has a regression test that fails on the old code. Commits `fb1d4065`, `71ceb052` and `88846d4a` were reviewed by the primary only, not by Sol.

## Decisions ([choice], reversible)

- D1. The hidden-country API is `PUT` / `DELETE /api/passport/hidden/:cc`, idempotent like `claims/:cc`, instead of `POST` with a body. A country that is not pressed gets 409 `NOT_PRESSED`, and a malformed code gets 400.
- D2. Hiding does not dirty derived state. Hidden rows are applied at read time; Overview reads with `applyHidden: false` because hiding is Passport-only.
- D3. The PATCH field is snake_case `passport_publication`, following the existing body convention.
- D4. The `flights` scope keeps the existing composition, including countries reached only by an awaiting flight. The `all` scope never includes pending countries.
- D5. Rail and road source filters use per-country `journeyModes` read from `ground_journeys`.
- D6. A hidden preference counts only while its country is pressed. The public projection still excludes every stored hidden row, which is the stricter rule.
- A private owner who opens `/fly/<self>` is redirected to `/passport?as=visitor`. The H1 is the holder's name.
- Mobile has no stamp hero; the sheet uses its own framer motion. The hero runs only on pointer opens.

## Open for the owner

- The visitor's "On flights" block still counts a hidden flight country in `countries_count`. This is the pre-existing public flight statistic, and the ADR says hiding is not global. Change it if hiding should also reduce flight stats.
- The pending block was not browser-tested because the local fixture cannot produce awaiting flights. Unit tests cover it.
- In Playwright, the client-side `/me` redirect could briefly show two `passport-data` sections. The test now waits for the route to settle and scopes to `#main`; a real browser always showed one.
- Neither the design nor the "draw the world once" atlas change has been visually accepted.
- The spec's Status line was not edited, because the spec is read-only for this run.
