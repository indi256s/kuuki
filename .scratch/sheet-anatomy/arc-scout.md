# Arc scout for the chapter cards (2026-10-12)

Three read-only scouts covered the installed Arc layer (`apps/next/src/client/ui/`), the upstream data/motion catalog and the upstream controls/structure catalog (https://uiarc.dev/llms.txt, catalog generated 2026-10-11). Raw downloads: `/tmp/arc-research`, `/tmp/arc-research-docs`. Paths below are relative to `apps/next/src/client/`.

## View toggle

- Neither upstream nor our port has a compact size. Upstream `segmented-control` has no size prop and computes to about 44px tall. Our port takes only `value, onChange, options, label` (`ui/segmented-control.tsx:20-26`), and its cells are fixed at 44px (`ui/ui.css:598`). The owner rejected that size for chart headers.
- Upstream says segmented, not Tabs, for this job: "Use tabs when each option swaps a panel of content", and Tabs says "Use segmented-control for a compact value toggle not tied to panels". Our toggles re-plot the same chart, so keep the segmented semantics (`role="group"`, `aria-pressed`).
- **Build:** add `dense` to `SegmentedControl`, copying `Button dense` (`ui/button.tsx:20,95`; `ui/ui.css:94-116`). Set `data-dense` on the root, make it 32px visual, and use an `::after` hit area of 44px on coarse pointers.
  - Paint it as drawn: 1px `--control-border` frame, radius 10, 2px padding; a 26px option with a radius-8 `--surface-inset` selected pill; 13/18 500 text.
  - That matches the 32px filter `Chip` in the same card.
  - Keep the built thumb timing (200ms `--ease-in-out`). Don't use upstream's `spring.morph`: bounce 0.16 breaks DESIGN.md:192, "no bounce on routine UI".

## Use (already installed)

| Element | Path | Where on the card | Rule it keeps |
|---|---|---|---|
| `SlotText` | `ui/slot-text.tsx` (journal only today) | Hero value on a pick | Static on first render; reduced motion swaps at once (`slot-text.css:64-72`). It rolls strings ("00:20", "3 of 7"), so `animated-counter` adds nothing. |
| KuukiChart tooltip `.kc-tooltip` | `overview/charts/kuuki-chart.tsx:196-214` | Desktop hover/focus preview on bars and rows (board 10c) | Shows on focus or non-touch pointer-enter; a tap pins it; it portals into the sheet. |
| `Button dense` (secondary) | `ui/button.tsx:20`, `ui.css:94-116` | The "Only …" offer on the hero line. It is an action (design.md §2.6), so it has no × | 32px visual, 40/44px hit area |
| `Chip` with `onRemove` | `ui/chip.tsx` | The applied filter in the filter row after "Only …" is tapped ("Departure hour · 21:00 ×"); the label format is `name · value` (`filters/filter-bar.tsx:138`) | Same component as "All flights" |
| `Skeleton` | `ui/skeleton.tsx` | Fixed-height per-band loading in the final layout | Static, no pulse (upstream pulses, which is a loop) |
| `EmptyState` | `ui/empty-state.tsx` | A chapter with no data (no aircraft known, no departure times) | No motion |
| `Disclosure` | `ui/disclosure.tsx` | Mobile Details | 44px trigger, 150ms fade |

## Skip

- **Upstream bar/waffle/donut/sparkline/gauge/progress/usage-meter, metric-card, stats-band:** each animates or counts up on first view. That breaks DESIGN.md:172 ("never animate on load") and DESIGN.md:192 ("no count-up from zero"). Our KuukiChart already covers these.
- **Upstream text-morph:** single line only, bouncy spring. Torph `FeedbackText` stays scoped to confirmations (DESIGN.md:200).
- **Upstream skeleton:** its pulse is a loop.
- **Tabs, stepper, pagination, carousel dots for the pager:** wrong semantics or wrong shape. The built 7-segment scroll-timeline pager stays.
- **Hover-card, badge, accordion, expandable-card:** they duplicate the tooltip, add noise to "4 of 7", are meant for FAQ lists, or have a 64px header.
- **Upstream `ease.exit` `[0.7,0,0.84,0]`:** an ease-in shape, banned.

## Correction (same day)

The first read put a × on "Only …". The spec makes it an offer to filter, so it is drawn as `Button dense`; the × belongs on the applied filter `Chip`. Facets exist for `depHours` ("Departure hour") and `regions` ("Region"), but there is no continent facet (`filters/chip-label.ts`). "Only Asia" needs either a continent facet or a mapping onto `regions`, because Continents counts per airport (RU, KZ, Turkish Thrace and Egypt are split).
