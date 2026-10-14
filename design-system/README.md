# Kuuki — White Sheet design catalog

Standalone proposed design system, based on the direction selected on 14 October 2026. Open [index.html](index.html) locally; it embeds fonts, styles, scripts and source-rendered specimens and needs no server.

This catalog does not replace [DESIGN.md](../DESIGN.md), change application tokens, save preferences or write flight data. Its sample values are fictional. The application still owns its canonical tokens in `apps/next/src/app/styles.css`.

## Direction

- Light: white page `#ffffff`, near-white card `#fafafa`, inset `#f2f2f2`. Shu fill `#ec684d`; dark foreground `#202020`; link/focus `#ae4e3b`; tint `#fff0ec`.
- Dark: separately composed neutral White Sheet surfaces. Existing dark accent roles are retained. The card is darker than the page; the floating layer is lighter.
- Ai, Matcha, Asagi and Sakura retain current accent values. Their presence is a comparison of inherited choices, not approval of a new palette.
- Ordinary quantity marks are neutral; the picked reading is colored. `mark-peak` is the compatibility name for **selection**, not a permanent maximum. The initial reading may be the maximum; subsequent selections need not be.
- Categories keep fixed colors. Comparison series keep slots, dashes and markers. Heat levels encode quantity under their own numeric legend. Known zero has a fill; missing data has a dashed outline.

The proposed `mark-rest` is independent of `heat-3`. The current app and PNG exporter still share that older mapping; this catalog does not migrate either consumer.

## Files and commands

```sh
# Run from the repository root; existing pnpm dependencies must be installed.
npm --prefix design-system ci --ignore-scripts
npm --prefix design-system run check
npm --prefix design-system run build
```

`palette.json` is the reviewed proposal data: 70+ opaque roles for each of ten theme/accent combinations. Edit it deliberately and run check before build. HEX matches the application notation. Initial neutral surfaces and heat adjustments were computed in OKLCH using Culori 4.0.2, then mapped to sRGB.

`build.mjs` reruns validation against the current palette, then generates `tokens.css`, `tokens.json` and `index.html`. Components consume semantic roles; generated hue-named primitives contain the values. A consumer sets **both** `data-theme="light|dark"` and `data-accent="shu|ai|matcha|asagi|sakura"` on its root. The standalone catalog switches these attributes locally; there is no second media-query theme mechanism.

`catalog.html`, `catalog.css` and `catalog.js` own the gallery and visual state specimens. Buttons, four isometric figures, Ticket and three neutral Stamps are rendered from project components by `specimens.tsx` during build. Fields, feedback, charts and the page layout are visual contract examples, not a replacement React component library. The existing app primitives remain the implementation owners. Rebuilding picks up current component markup/styles but does not automatically import new application palette values.

One explicit figure adaptation replaces the source's mixed accent panel paint with `--figure-live-fill` (the accent fill). The lighter Shu needs its dark foreground to remain readable on that panel. Decorative side shading and glow remain source behavior. This is a proposed semantic role, not an application component edit.

Font snapshots and their OFL licenses are in `assets/`; all three fonts are embedded by build. Commissioner owns UI text; Paper Mono owns ticket data. Typography, geometry and surface conventions follow DESIGN.md; motion durations follow the current AGENTS.md.

## Verification and limits

`validate.mjs` writes [contrast-report.json](contrast-report.json), including every measured pair and threshold, and exits nonzero for a failure. It checks ten combinations, sRGB displayability, text/control/focus/status/data contrast, monotonic heat lightness and at least 15° between the accent and each status hue. Thresholds: 4.5:1 text, 3:1 controls/marks, and the existing project's 1.4:1 selected-versus-rest distinction. Selection also has a contour and readable label. Hairlines and known-zero fills are decorative/context roles and are not claimed to meet 3:1.

Status foregrounds are independent of accent foregrounds. Filled success/warning/info examples require black text in light mode; dark danger uses dark text. An accent swap cannot change them.

The report covers declared opaque token pairs. It does not prove composited SVG shading/glow, all stamp/airline inks, focus behavior of the production app, device persistence, import behavior, export fidelity or complete screen-reader support. The catalog uses native selects, buttons, inputs and dialog; prefers-reduced-motion and forced-colors fallbacks are included. Production component migration and application tests remain a separate task.

Before migration, reconcile the selected roles in DESIGN.md, canonical app CSS, the shared theme mirror, token tests and the PNG exporter together. Preserve the chart implementation's stable categories/slots and unknown/missing distinctions. The inherited accent picker and delivery protocol remain the starting point; this catalog introduces no new stored accent names.

The catalog outlines heat levels 1–3; this matters because inherited Matcha/Asagi level 3 fills are below 3:1 on the new surface. Level 4 is checked directly at 3:1. Selection and low-level boundaries use independently checked contour roles.
