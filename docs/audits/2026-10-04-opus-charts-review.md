# Opus 5.5 chart review

Date: 4 October 2026. User-requested evaluation of [TanStack Charts' shadcn collection](https://tanstack.com/charts/catalog/collections/shadcn), following the independent architecture review. Scope: read-only; no dependencies installed in Kuuki and no charts changed.

## Parent assessment

Accepted recommendation: shortlist TanStack Charts for a prototype of Kuuki's comparison bars and continent radar, retain current production charts until parity and an app-specific benefit are demonstrated, then remove Recharts if choosing the replacement. React 19 compatibility and documented SVG/hydration support are promising; neither bundle savings nor workerd behavior has been tested in Kuuki.

Source correction: the review below says current Recharts charts have no keyboard accessibility. Installed Recharts 3.7 defaults `accessibilityLayer: true` in both CartesianChart and PolarChart, and its keyboard-events middleware is active unless disabled. The two Kuuki components do not disable it. An accessibility advantage must therefore be measured rather than assumed. Existing CSS visuals also need behavior checks before calling them fully accessible. For SSR, an explicit `use client` boundary still permits server rendering; client-only rendering, if chosen, needs a separate deliberate configuration. Direct D3 dependencies are required only when the app imports those APIs.

The Static Assets cache correction is accepted: OpenNext 1.20.8 rejects runtime composable entries, logs a read miss and does not persist writes. The main audit now makes runtime cache storage conditional and distinguishes it from prefetched/prerendered shells.

## Original returned review

The following is the original Opus response, retained without factual edits. Read its claims alongside the qualifications above.

**Verdict: prototype it, don't replace Recharts yet.** TanStack Charts is real, MIT-licensed and technically suitable for both of Kuuki's charts. But it went 1.0 yesterday, and the shadcn "collection" is a set of benchmark cases, not a shadcn component you can install. Keep Recharts in production. Run one small spike that ports both existing charts, and switch only if the spike passes the criteria below. If it passes, migrate both in one PR so Kuuki never carries two chart libraries.

## Package facts (checked against the npm registry and the 1.0.0 tarball)

- **Version:** `@tanstack/charts` `latest` is `1.0.0`, published 2026-10-03. The first version was 2026-07-29 and the last 0.x (0.18.0) was 2026-09-10, so there were about two months of 0.x before 1.0.
- **Repo:** [TanStack/charts](https://github.com/TanStack/charts), created 2026-07-28, MIT, 769 stars, 20 open issues, not archived.
- **Stability:** the shipped `docs/compatibility.md` says the stable contract "takes effect with TanStack Charts 1.0". Breaking changes need a major version; React Native is still labelled experimental. So "stable" here means one day of 1.0, not a track record. Kuuki should pin an exact version.
- **Peers:** `react`/`react-dom` `^18 || ^19`, all optional. Dependencies are about 14 pinned granular d3 modules plus `tslib`, with `"sideEffects": false`. It ships ~120 subpath exports, including `/react`, `/react/tooltip`, `/polar` and `/motion`.
- **Not a Recharts wrapper.** It's an independent grammar-of-graphics engine. It replaces Recharts; it doesn't sit on top of it.

### What the shadcn collection actually is
- There are 71 `benchmarks/conformance/cases/*-shadcn-*/case.json` files, each with `"referenceRenderer": "recharts"` and `"collections": ["shadcn"]`. Each one recreates an official shadcn example as a pixel/geometry conformance test.
- There's no `registry.json` or `components.json`, so there's no `npx shadcn add` path.
- The examples import `@tanstack/charts-data/shadcn`, which isn't published (npm returns 404). They also import `d3-scale`/`d3-shape` directly and hardcode `toLocaleString('en-US')` (see [145 example.tsx](https://github.com/TanStack/charts/blob/main/benchmarks/conformance/cases/145-shadcn-bar-horizontal/example.tsx)).
- Treat them as reference recipes to copy and adapt, not as drop-in components.

## How Kuuki's chart needs map onto it

| Need | Uses Recharts today? | TanStack primitive | Fit | Caveat |
|---|---|---|---|---|
| Compare bars (`CompareChart.tsx`, two-series horizontal bar) | Yes | `barX` + band scale; cases 145 and 128 | Good | Per-row units (distance vs counts) need a custom tooltip `content`. The current `formatFn`-in-payload trick doesn't carry over directly. |
| Continent radar (`AdvancedStatCards.tsx:911`) | Yes | `/polar`: `radialArea` + `radialGrid`/`angleGrid`; cases 130 and 172–184 | Good | The tiny 120px card needs label-collision checks. The radius domain must be fixed at 0–100. |
| Airline/aircraft rankings | No (CSS) | `barX`, `transform/rank` | Possible | Today's CSS bars are cheaper and fully accessible. No need to move them. |
| Activity / calendar heatmap | No (CSS) | `rect`/`cell` + `bin-time` + d3 time scale | Possible later | Speculative, not a current need. |
| Cabin share | No (CSS/waffle) | `/waffle`, `pie` | Possible | The existing waffle already has per-cell `aria-label`s, so there's no reason to move it. |

Only two components are actual Recharts consumers. The rest are future options; don't let them drive a redesign.

## Compatibility: documented vs proven

- **React 19:** within the peer range. Not tested in Kuuki.
- **SSR/hydration (docs only):** the SVG `Chart` renders a complete accessible SVG on the server at `initialWidth` (default 640), then a layout effect adopts and resizes it ([adapter.md](https://github.com/TanStack/charts/blob/main/docs/framework/react/adapter.md)).
  - Risk: on mobile, server geometry at 640px will reflow to the real width. Set `initialWidth` close to the mobile width or render client-only to avoid that.
  - `dist/react/*.js` has no `'use client'` directive, so in Next the chart must be imported from a client-component file.
  - Compiling and serializing on the server needs no browser globals according to `compatibility.md`, but that's unproven on workerd.
- **Theming:** the shadcn cases use CSS variables (`var(--border)`, `var(--muted-foreground)`), which match Kuuki's tokens.
- **Accessibility (docs only):** charts are focusable with `tabIndex=0`, keyboard focus is shared with pointer focus, and `respectReducedMotion: true` is the default.
  - Kuuki's current Recharts charts have none of this, which is the strongest functional argument for switching.
  - Touch inspection belongs to the app (`pointer: false` plus a hold gesture), so it isn't free.
  - The docs still tell you to provide a table or summary when exact values matter.
- **Locale:** the library doesn't localise for you. Pass i18n formatters, as Kuuki already does in its tooltips.

## Bundle size and migration cost
- TanStack's own comparison only measures itself against Recharts on its benchmark suite. Nothing has been measured for Kuuki, and I make no size or speed claim.
- Kuuki's real baseline is the current Recharts chunk: 317.34 KB raw / 95.69 KB gzip, lazy-loaded.
- Migration means:
  - adding `@tanstack/charts`, plus `d3-scale` and `d3-shape` as direct dependencies (pnpm won't let the app import transitive ones);
  - rewriting about 120 lines (CompareChart plus the radar block);
  - removing `recharts` only after both charts are ported.

## Criteria to switch (all must pass)
1. Both charts ported, matching current visuals in light and dark themes.
2. The chart code stays a deferred client chunk, measured with the same build against the Recharts baseline. TanStack must be no larger, or must buy accessibility that justifies the size.
3. Keyboard and screen-reader access to the exact values (wins summary or table kept), and reduced motion verified in a browser.
4. Mobile at 360px: no clipped radar labels and no hydration reflow jump.
5. Works in the Next/OpenNext workerd preview without hydration warnings.
6. Data stays server-aggregated; the charts only receive compact rows.
7. Recharts is removed in the same PR, and the pin is exact.

If any of these fail, keep Recharts and revisit after a few 1.x patch releases.

## Static-assets cache nuance (item 6)
The parent's reading is correct, with one detail to add. In `static-assets-incremental-cache.js:42-45`, `getAssetUrl` throws for `cacheType === "composable"`. `get` catches that, logs `"Failed to get from cache"` and returns `null`. So every runtime `'use cache'` lookup on this backend is a miss **and logs an error on every call**; `set` only logs. Prerendered route and fetch entries are unaffected. The audit should say that runtime composable caching needs a writable backend, and should mention the log noise.

`★ Insight ─────────────────────────────────────`
- The "71 shadcn examples" are conformance tests that render each shadcn chart with Recharts as the reference. That shows TanStack *can* reproduce those visuals; it's not something you can install as a shadcn component.
- Of the candidate charts, only CompareChart and the radar actually use Recharts. Most of Kuuki's "charts" are hand-built CSS with their own `aria-label`s, which is why porting just those two is cheap enough for a spike.
- The real gain from switching would be accessibility (keyboard focus, reduced motion). Bundle size is unknown until measured in Kuuki's own build.
`─────────────────────────────────────────────────`

Nothing in the repo was edited. I only read the npm tarball (extracted under `/tmp/tsc`), GitHub sources and the two Kuuki files.

