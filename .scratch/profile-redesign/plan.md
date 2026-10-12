# Profile redesign — implementation plan (2026-10-12)

Spec: [spec.md](spec.md). Boards: Paper "Profile" page, 21.1b (shipped first) is the visitor reference.

## Decisions taken at build time (owner answers, 2026-10-12)

- **Stamp dates.** The public profile payload has no visit dates, and adding them would publish travel timing. Owner view: `MM·YY` of the last visit, latest first. Visitor view: country codes only, ordered by localized country name (no recency or frequency signal), accessible name "Norway".
- **Records cabinet.** The five-card public projection and the Records consent PATCH belong to the unbuilt record-sharing feature. The cabinet is hidden for everyone (no owner opt-in line, since there is no toggle to link to) until that lands.

## Data

- `readPublicProfile` adds `countries: string[]`: countries with logged flight evidence (`country_visit_evidence.logged_visit_count > 0`) in the same visibility-gated batch, sorted by code, with no dates. Those countries are endpoints of logged flights, so they lie inside the public route/airport set; claims, ground visits and awaiting-only countries are excluded. Private shell: `[]`.
- `getOwnStamps(ownerId)` (server/profile.ts, identity-gated like `getOwnProfileStats`): `{code, lastVisit}` latest first, for both owner states.

## Pure modules (unit-tested)

- `client/profile/view.ts`: `profileViewState(data, viewerId)` → `not-found | closed | owner-private | owner-public | public`; the closed state carries `guest | member`.
- `client/profile/stamps.ts`: stamp list + overflow count; owner dates `MM·YY`, accessible names "Norway, September 2026" / "Norway".
- `client/profile/mrz.ts`: two 30-char MRZ lines, ICAO 9303 transliteration via `@kuuki/shared/address`.
- `client/profile/badge-notifications.ts`: `unseenBadges` takes a key scope; the cabinet uses `kuuki:badge-cabinet:{ownerId}` (separate from the toast key). First visit sets the baseline without replay.
- `client/profile/remarks.ts`: owner-only narrator bank (glados-copy triples, EN + RU «вы»), deterministic by owner id.

## UI

- Server layout in `client/profile/holder.tsx` (holder page, cover) and `client/profile/sections.tsx` (numbers, stamps, ranks, join); client islands: `ShareProfile` (native share on coarse pointers, copy link otherwise), `BadgeCabinet` (Sheet details, unboxing, mobile "Show all").
- Layout: ≤700 plain scroll, holder card on top; 701–1023 holder on top + 2-col blocks; ≥1024 open spread 1120, sticky 400px holder page with the spine crease (documented exception).
- Shipped first: no Compare, no record actions. Owner: Share profile + visibility chip (→ /settings). Owner-private: PRIVATE stamp (aria-hidden), Private chip, note + "Change in Settings".
- Motion: holder 240ms opacity + 8px rise, blocks stagger 60ms; press 0.96; unboxing scale 1.08→1 + ink settle 320ms, 80ms stagger; reduced motion = fade / static "New" tag.
- Tokens: gate-sign and holder-spine roles added to `styles.css` (no literals in components).

## Verification

`pnpm typecheck`, `pnpm lint`, `pnpm test` (API + Next unit), `pnpm next:build`, `pnpm test:next:navigation`; agent-browser at 390/1440, light/dark, against boards 21.x.
