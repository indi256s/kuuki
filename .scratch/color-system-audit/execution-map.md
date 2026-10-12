# Execution map — color system v1

Status: done
Source: [spec.md](spec.md) v1 (ready-for-agent). Values: [palette-proposal.json](palette-proposal.json) v1.
Ledger: [ledger.md](ledger.md). Issues: [issues/](issues/).
Workspace: root checkout `/Users/indi256/Documents/kuuki/kuuki`, `main` @ `28fdd165`, shared with pre-existing dirty work (baseline in ledger).

## Technical decisions (spec "Further Notes" 1–4 and gaps found in live code)

**T1. One shared value table, CSS stays canonical for the UI.** `packages/shared/src/theme/palette.ts` holds the v1 tables (modes, accents with fill/text/tint/foreground/focus, comparison ×5, heat ×4 + foreground, heat contour, makers, regions) as plain data. `apps/next/src/app/styles.css` keeps all UI tokens (CODING_STANDARDS). A data-driven `apps/next/src/app/tokens.test.ts` parses styles.css, resolves each of the 10 mode×accent token sets and asserts (a) equality with the shared table, so drift between CSS and PNG/favicon/meta consumers fails, and (b) the contrast pairs from palette-measurements (text ≥4.5, marks/contour/focus ≥3) on the resolved CSS values, using `lib/color.ts`. Non-CSS consumers (PNG renderer, favicon, `THEME_COLOR`) read the shared table. No Color.js, no runtime palette search.

**T2. Token roles.** New tokens per mode×accent: `--accent-text` and `--accent-on-tint` = v1 `text`; `--accent-tint` = v1 `tint`; `--focus` = accent fill; `--cmp-1..5` = v1 comparison; `--heat-1..4` + `--heat-N-text` = v1 heat; `--heat-contour` = v1 `border` (mode-level). `--mark-1..4` become aliases of `--cmp-1..4` (fixed literals removed; every local two-series chart is a comparison inside its analysis). `--mark-ghost` stays the neutral **baseline** role only. Makers: v1 airbus/boeing/embraer/atr/other; `--cat-maker-unknown` becomes an outline role (not a fill) paired with a «?» glyph. Regions: `--cat-region-{africa,americas,antarctica,asia,europe,oceania}`. Separate named tokens for `zero`, `missing`, `other`, `unknown`, `baseline`, `brand-neutral` even when hexes coincide. Map visit buckets reuse the accent heat ramp (`--map-bucket-N: var(--heat-N)`), keeping their own 0/1/2–3/4–9/10+ thresholds and legend. Status, alliance, rank, iso faces and base surfaces unchanged.

**T3. Brands.** Keep the existing CSS relative-color adaptation in `lib/airline.ts` (source hue kept, L/C bounded per mode via `--brand-l-*` and a chroma cap); retune bounds so every catalog brand passes ≥3:1 on background/surface/inset in both modes, proven by a test that evaluates the same formula over the full catalog with `lib/color.ts` (sRGB clip). The catalog source color and provenance are not rewritten. Missing brand → `--brand-neutral` + name, never a guessed hue.

**T4. Accent precedence and profile persistence (Further Note 2).** `resolveAccent(value)` in `lib/theme-colors.ts`: canonical names pass; legacy names map exactly as `public/bootstrap.js` does today (terracotta/kincha/sumi/yellow/red/orange→shu, blue→ai, cyan/teal→asagi, purple/coral→sakura); anything else → `shu`.
- Device: cookie `kuuki_accent` stays the synchronous bootstrap source (no flash). Bootstrap logic unchanged except honoring an owner scope (T5).
- Profile `theme_color` (existing column, no migration) is the owner's saved accent. Member shell reconciles once per mount: profile holds a recognized value (canonical or legacy) → device adopts it (legacy rewritten canonical in the profile); profile null/unrecognized → device accent is written to the profile (preserves the local preference).
- Picker: applies optimistically on device; when signed in, PATCHes `theme_color`. On failure it reverts device to the last saved accent and shows an explicit EN/RU error; it never claims a saved public setting.
- API: `PATCH /api/profiles/me` accepts only canonical accent names (or the field omitted); others → 400 `BAD_REQUEST` `Invalid theme_color`. Public DTO unchanged (field already public; private shell keeps `null`).

**T5. Public owner context (Q8/Q24/Q21).** `/fly/[username]` with a public profile renders `<OwnerAccent accent={resolveAccent(profile.theme_color)} />`: an inline script sets `html[data-accent]` + `data-accent-scope="owner"` during parse (hard load), a layout effect does the same on soft navigation, and cleanup restores the personal cookie accent. It never writes the cookie or the profile. Private profile shells, not-found and leaderboard pages have no owner scope. Mode stays the visitor's. The page is dynamic SSR; reopening the link after a successful save shows the new accent (verify no HTML cache). The public Overview API payload is unchanged: no first-party consumer renders it, and the profile DTO already carries the accent.

**T6. Comparison slots (Further Note 1).** Used by Rankings airport/route bump (airlines keep brand colors). `assignSlots(analysis, visibleKeys, seedOrder, stored)`: existing assignments never change; a new key takes the first slot unused by all stored keys, else the first slot unused by currently visible keys, else the least-used visible slot (lowest index on ties). Seed order = the whole-journal (unfiltered) ranking order, so SSR and first client render agree without storage. Persistence: `localStorage` key `kuuki:cmp:v1:<ownerId>:<analysis>` (palette version in the key; a new palette version starts a new namespace). Device-local only (cross-device not agreed). Slot index also selects a stable dash + marker pair; accent change re-reads `--cmp-N` for the same index. HTML hash-mod-5 is not used.

**T7. PNG (Further Note 3).** `GET /api/me/overview/share.png?mode=light|dark`: renderer receives `{ accent: resolveAccent(own profile.theme_color), mode }` from the trusted profile; no request color. Missing `mode` → `light` (compatible with the old light fixture background `#fbfaf8`); invalid → 400. Background, text, bars and SVG come from one snapshot of the shared table. Auth, filter parsing, derived-readiness 503, signature, dimensions, `no-store`, no external fetch, and the pre-existing lazy renderer import stay. No new share UI.

**T8. Favicon (Further Note 4).** A client `FaviconSync` in the root layout observes `html[data-accent|data-theme]` and replaces the SVG `<link rel="icon">` href with a data-URI rendering of the existing `app/icon.svg` geometry using the shared table colors. File-based `icon.svg` stays the no-JS/initial default (Shu); `favicon.ico` and `apple-icon.png` stay static — the installed OS/PWA icon is a documented limitation, not claimed as updated.

## Nodes, ownership, dependencies

One writer per path. Executor: T3 `delegate_task`, `claudeAgent` / `claude-sonnet-5-5` / `effort=high`, one active writer at a time (serial nodes). Primary (Opus) owns acceptance, broad gates, browser QA and the final review dispatch.

| Node | Issue | Owned paths (writer) | Depends on |
| --- | --- | --- | --- |
| A Tokens | [01](issues/01-palette-tokens.md) | `apps/next/src/app/styles.css`, `packages/shared/src/theme/**` (new), `apps/next/src/app/tokens.test.ts` (new), `apps/next/src/lib/theme-colors.ts`, `apps/next/src/lib/color.ts`, `apps/next/src/lib/airline.ts` (+ test), `apps/next/src/client/overview/charts/palettes.ts` | — |
| B Accent delivery | [02](issues/02-accent-delivery.md) | `apps/next/src/client/appearance.tsx`, `apps/next/public/bootstrap.js`, `apps/next/src/client/ui/swatch-picker.tsx`, accent part of `client/account/settings-form.tsx`, new `client/owner-accent.tsx`, `client/favicon-sync.tsx`, `app/layout.tsx`, member shell accent sync, `app/(public)/fly/[username]/page.tsx` (preserve pre-existing FoundingCrew diff), `functions/api/profiles/me.ts` (+ tests), `apps/next/activation/activate.js` + `client/public/activation-static.test.ts` | A |
| C Scales & categories | [03](issues/03-scales-and-categories.md) | `client/overview/sections/rhythm/**`, `charts/arc-activity-heatmap.tsx`, `lib/map-buckets.ts`, `client/overview/globe/**`, `charts/arc-treemap.tsx`, `sections/manufacturers/**`, `sections/fleet/**`, `charts/arc-waffle.tsx`, `charts/arc-ridgeline.tsx`, `client/ui/category-mark.tsx`, `client/maps/**` legends only | A |
| D Comparison & states | [04](issues/04-comparison-and-states.md) | `sections/rankings/**`, `charts/kuuki-chart.tsx` (+ tests), `charts/arc-donut.tsx`, `charts/arc-line.tsx`, `charts/arc-bump*`, new `client/overview/charts/comparison-slots.ts` (+ test), two-series sections only where a token alias is insufficient (`sections/{routes,crossings,clock,records}/**` — records.css has a pre-existing diff to preserve) | A, C (shared chart files settle first) |
| E PNG | [05](issues/05-png-export.md) | `functions/api/_services/overviewShareCard.ts`, `functions/api/me/overview/share.png.ts` (preserve lazy import), `functions/test/share-card.test.ts` + harness | A |
| F Docs | [06](issues/06-design-docs.md) | `DESIGN.md` color sections | B–E accepted |
| G QA | [07](issues/07-browser-qa.md) | primary; artifacts in `.scratch/color-system-audit/qa/` | B–E accepted |

Forbidden for all writers: unrelated dirty files in the baseline (profile.*, achievements, flight-form, worker.ts, package manifests, lockfile, evaluate-import, GLOSSARY.md, CODING_STANDARDS.md, docs/README.md), audit artifacts in `.scratch/color-system-audit/*` except `issues/` comments, any reset/stash/clean/commit/push/deploy/remote D1.

## Gates

- Writers: focused vitest for touched seams + `pnpm --filter @kuuki/next typecheck` / `pnpm typecheck:api` as relevant + `pnpm lint` + `pnpm format:check` on touched files.
- Primary, once on the stable final identity: `pnpm lint`, `pnpm typecheck`, `pnpm typecheck:api`, `pnpm test`, `pnpm next:build`, `pnpm test:next:navigation`, `pnpm --filter @kuuki/next typecheck:worker`; browser QA (07) via `agent-browser` against the compiled preview.
- Independent review: GPT-6.1-Sol `high` via `delegate_task` on the final scoped diff (project routing); UI visuals reviewed by the primary from QA artifacts.
