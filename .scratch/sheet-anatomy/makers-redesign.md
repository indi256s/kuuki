# Makers — aircraft display model

Proposed Paper study only. Original Makers artboard O6L-0 remains untouched.

## Direction

A single generic twinjet model sits on a solid display stand. The readable AIRBUS engraving links the object to the selected maker. This is a physical aircraft object, rather than cargo, a repeated category block, or a chart disguised as a machine. Quiet neutral faces and 1px warm edges match the Clock and Routes figures. There is no live part to light, so no accent/glow is used in the drawing.

The maker name is the only data-bound part of the figure. When a maker is selected, update the stand engraving while leaving the generic silhouette fixed. Airbus 59% in the hero and chart remains the data authority. The drawing asserts no exact aircraft type, dimensions, count, or proportional maker share. Manufacturer-specific silhouette changes would require independently available type data; they must not be inferred from a maker total. The current caption's Boeing 31% and 96-of-100 coverage remain illustrative sheet values.

## Manifest

Paper file: 01M48F4SHK61AZS2FH5P5JPRY7, page p-3-0 (Sheet anatomy).

- Study artboard: Q1Q-0, 300×160; wrapper Q64-0; SVG QBC-0.
- Full sheet duplicate: Q1R-0, 390×844; slide content Q22-0; wrapper Q70-0; SVG QC8-0.
- Full-sheet wrapper: left 45px, top 16px inside slide content at y201; 300×160; figure stage ends at y377. SVG content moves 11px left for optical alignment, without scaling.
- SVG: `.scratch/sheet-anatomy/figures/makers-fresh-display-dark.svg`.
- Live screenshot: `.scratch/sheet-anatomy/screenshots/makers-fresh.png`.
- Native-size live study screenshot: `.scratch/sheet-anatomy/screenshots/makers-fresh-study.png`.

The duplicate retains the header, filter, pager, 59% headline, caption, Makers/Fleet control, chart, details heading, and footer. Only the figure differs.

## Review — full mode

Scope: Paper illustration and unchanged 390×844 sheet context. Existing Commissioner / JetBrains Mono and journal dark tokens; no application implementation or runtime states.

| Category | Evidence | Result |
| --- | --- | --- |
| Typography | Font availability; final native 300×160 and full-sheet screenshots | 13px Commissioner 600 engraving is readable; existing headline hierarchy retained. |
| Surfaces | SVG geometry and token fills; screenshots | Clear stand support, painter-order occlusion, neutral front/side separation; no shadow or gradient. |
| Animations | Static source SVG | None proposed; runtime/reduced-motion behavior not tested. |
| Icons | Generic aircraft silhouette at native size | Whole plane reads clearly with twin nacelles, wings, tail and cockpit; no icon set changes. |
| Performance | SVG source | 30 small SVG elements, no filter, bitmap, dependency, or loop; runtime profiling not performed. |

Corrected the first checkpoint's clipped fin, thin fuselage and low base. Final geometry has at least 6px vertical clearance (fin/wingtip y8–9, base bottom y152 in a 160px frame). Fuselage became fuller and its nose rounder. The final optical shift centers the object rather than its asymmetric empty SVG box.

Spacing, type hierarchy, contrast, alignment, artboard fit and repetition pass the final live review. Single-object scale avoids the old five-block repetition. The nameplate sits on its face and does not intersect the silhouette. The parent independently reviewed and accepted corrected geometry before the final optical shift.

Considered and rejected: manufacturer percentages represented by multiple models (would imply aircraft counts); a detailed assembly jig (less immediate at mobile size); category-colored body/glow (no active physical part and no need to copy chart color).

Verification: Paper guide/basic info/font lookup; live screenshots after geometry revisions; exact wrapper styles; XML parse and 300×160 viewBox assert; native PNG dimensions checked. Final source matches both Paper SVG nodes. Verdict: approve this study for integration review; implementation, interactions and motion remain unverified.

Skipped extra variants, an exact aircraft model, app changes and browser checks. Risk: the generic plane is contextual; the engraving identifies the selected maker but does not prove a manufacturer-specific airframe.
