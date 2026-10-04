# T02 report: tokens, appearance, formatters

## Changes
1. **Tokens** (`apps/next/src/app/styles.css`): every token from token-contract.md added to `:root` and `:root[data-theme=dark]` (status, ranks, radius xs/full, space, elevation, scrim, outline-media, surface-floating, motion, fonts, map). `--map-bucket-1..4` = `color-mix(in oklch, var(--accent) 24/43/65/90%, var(--map-land))`, so they follow `data-accent` and theme. Dark `--shadow-*` and light `--ring-floating` are `0 0 0 0 transparent` (not `none`) so they can be comma-combined. Accent blocks only set accent/accent-text/accent-foreground/focus (asserted in test).
   MapLibre needs resolved colors: new `client/maps/resolve-color.ts` paints the computed token on a 1px canvas and returns `rgba()`; `renderer.tsx` `token()` uses it (the hex-only JS `mix()` is gone).
2. **Literals**: `#0008/#0003/#0002` replaced in styles.css, reads.css, capture.css (scrim/shadow-modal/shadow-floating/ring); `.button` transition uses `--dur-*`/`--ease-out`; fonts via `--font-sans/--font-mono`; preview fallback hex removed; mapcn `rgba(0,0,0,0)` -> `transparent`; `src/lib/theme-colors.ts` holds THEME_COLOR (layout.tsx, appearance.tsx), SURFACE_COLOR, NEUTRAL_INK, ACCENTS; tokens.test.ts asserts they mirror styles.css. Vendored `public/maps/maplibre-*/maplibre-gl.css` literals untouched (third-party).
3. **Accent API**: `setAccent(accent)` in `client/appearance.tsx` (validates against the six names, writes `kuuki_accent` cookie, sets `dataset.accent`, dispatches `kuuki:appearance`).
4. **Formatters**: `src/lib/format.ts`. Swapped in overview/page.tsx, reads/journal.tsx (plural, date, km), reads/passport.tsx (month-year, numbers). Journal EN count now correctly singular ("1 flight"; was "1 flights"). Distance/duration units use a no-break space. Left alone: leaderboard datetime (not date-only), `Intl.DisplayNames`, journal hour rounding and "min" detail text (behavior kept), import-client `toLocale` datetime.
5. **Buckets/ink**: `lib/map-buckets.ts` (`visitBucket`, `BUCKET_TOKENS`, `BUCKET_LABELS`), used by renderer (fill + titled "Visits/Визиты" legend with token swatches) and preview.tsx (new optional `visits` prop, panel passes it; dots use bucket token plus accent-text stroke). `lib/stamp-ink.ts` + `lib/color.ts` (OKLCH/sRGB/contrast/mix). No Next consumer of country colors exists yet (`getCountryColor` in packages/data is unused by apps/next); T03 Stamp consumes `stampInk`. Samples: #ffcc00 -> #a38200 light / #fbcd3c dark; #0033a0 -> #0b3895 / #5082e5.
6. **Runner**: vitest ^4.1.11, jsdom ^27.4.0, @testing-library/{react ^16.3.2, user-event ^14.6.1, jest-dom ^6.9.1} (same ranges as apps/web), `vitest.config.ts` (node default, jsdom via docblock, excludes `tests/**`), script `test`.
7. **Tests**: format (19), map-buckets (9), stamp-ink (7), tokens (40) = 75.

## Token values and contrast (on background / surface)
Light bg #fbfaf8, surface #fff; dark bg #292827, surface #353331.
- success-text #146d34 6.16/6.43 | dark #76c788 7.21/6.17
- warning-text #824c00 6.75/7.04 | dark #e1a263 6.69/5.72
- danger-text #a43535 6.41/6.69 (kept) | dark #ffaaa5 8.09/6.92 (kept)
- info-text #175d9b 6.55/6.83 | dark #73b6fa 6.87/5.87
- rank-gold #775800 6.33/6.60 | #d5b36a 7.35/6.28; silver #595e64 6.27/6.54 | #b2b8bf 7.36/6.29; bronze #8a4b24 6.47/6.75 | #eca57d 7.18/6.14
- fills: success #2a904b/#4eb068, warning #ae6700/#cf8634, danger #c74b47/#ea6a64, info #2b7ec9/#4c9deb (3.9-5.4:1, not tested; icon grade)
- Existing text/accent/control/focus values already passed in all 12 theme x accent combos (control-border 3.99/4.16 light, 4.41/3.77 dark; accent-foreground on accent >= 5.29). No loosened thresholds.
- surface-floating dark #3c3a37.

## TZ runs (format.test.ts, 19 tests)
- `TZ=Pacific/Kiritimati` (UTC+14): 19 passed
- `TZ=Pacific/Pago_Pago` (UTC-11): 19 passed

## Verification
`pnpm --filter @kuuki/next test`: 4 files / 75 tests passed; typecheck exit 0; lint exit 0 (0 warnings); `pnpm exec tsx scripts/map-geometry.test.ts`: "map geometry cases passed". Token test mutation-checked (bad rank-gold / focus fails as expected).

## Not done / ideas
- No browser check of the canvas color resolver or legend rendering (no `next build`/Playwright run); logic is typechecked only.
- `typecheck:worker` and navigation Playwright not run (need `next:build`).
- Idea: swap remaining ad-hoc radii/gaps in CSS to the new space/radius tokens in T03.
