# Palette v1 tokens and data-driven contrast seam

Status: resolved
Type: task
Node: A (see [execution map](../execution-map.md) T1–T3)

Move the accepted v1 values from [palette-proposal.json](../palette-proposal.json) into the existing token source and one shared table for non-CSS consumers.

Acceptance:
- `packages/shared/src/theme/palette.ts` exports the v1 tables as typed data (modes, 5 accents × 2 modes: fill, foreground, tint, text, comparison[5], heat[4] {color, foreground}, contour; makers incl. other; regions ×6). Values equal the JSON exactly.
- `styles.css` defines per mode×accent: `--accent`, `--accent-foreground`, `--accent-text` and `--accent-on-tint` (= v1 text), `--accent-tint` (= v1 tint), `--focus` (= fill), `--cmp-1..5`, `--heat-1..4`, `--heat-1..4-text`, plus mode-level `--heat-contour`, `--cat-maker-*` (v1), `--cat-region-*`, and distinct `--zero`, `--missing`, `--cat-other`/`--cat-maker-other`, `--cat-maker-unknown` (outline role), `--mark-ghost` (baseline), `--brand-neutral`. `--mark-1..4` alias `--cmp-1..4`; `--map-bucket-N` alias `--heat-N`. `--heat-0` stays the neutral zero cell. Base surfaces, status, rank, alliance and iso face tokens unchanged; `--swatch-*` unchanged.
- `palettes.ts`: `DEFAULT_PALETTE` → `--cmp-1..5` (verify no consumer relied on slot 5 meaning baseline; if one does, give it `--mark-ghost` explicitly); `MAKER_PALETTE` keeps maker order.
- `lib/theme-colors.ts`: add `resolveAccent()` (T4 mapping) and derive `THEME_COLOR`, `SURFACE_COLOR`, `NEUTRAL_INK` from the shared table or keep them checked by the new test; existing lint suppressions must point at a test that now exists.
- `lib/airline.ts`: retune `--brand-l-*` / chroma cap so every catalog brand with a color passes ≥3:1 on background/surface/inset in both modes; unknown → `var(--brand-neutral)`.
- New `apps/next/src/app/tokens.test.ts`: parses styles.css, resolves `var()` per mode×accent (10 sets), asserts equality with the shared table and the palette-measurements thresholds (text/accent-text/muted ≥4.5 on background/surface/inset/tint; action foreground on fill ≥4.5; focus, comparison, maker, region, contour ≥3 on background/surface/inset; heat label ≥4.5 on its cell; heat lightness monotonic). Plus an airline-catalog contrast assertion. Must fail if a CSS token drifts from the table.
- `pnpm --filter @kuuki/next exec vitest run src/app/tokens.test.ts` and existing chart suites (`chart-ssr`, `kuuki-chart`, `chart-fidelity`) pass; `pnpm --filter @kuuki/next typecheck`, `pnpm lint`.

Out of scope: consumer component changes beyond palettes.ts/airline.ts (nodes C/D).

## Comments
