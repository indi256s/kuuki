# Quantitative scales, maker/region categories, neutral roles

Status: resolved
Type: task
Node: C (spec stories 3–7, 13; execution map T2)
Blocked by: 01

Acceptance:
- Daily heat (`arc-activity-heatmap.tsx`, Rhythm calendar): absolute levels 0 / 1 / 2 / 3 / 4+ independent of year and filter; visible numeric legend (EN/RU); tooltip/table keep the exact count; known zero (`--heat-0`) differs from missing/no-data days (`--missing` + non-color cue); weak cells carry `--heat-contour`.
- Monthly heat: base = whole-journal max per metric (existing `baseline.max[metric]`), buckets 0, (0;25], (25;50], (50;75], (75;100]; legend names metric and base; zero max → no NaN, known zeros stay 0; invalid/missing input is not coerced to 0 (`heatBucket` returns a distinct missing state).
- Visits (map, country list, globe legend): unchanged thresholds 0/1/2–3/4–9/10+ on the accent heat ramp; legend says "visits".
- Makers/Fleet: v1 maker colors; every family uses its maker color; Unknown renders as outline + «?» in legend/waffle; Other stays a filled neutral; Makers fade at opacity .22 removed (hover/focus highlight by contour per Q12/Q18).
- Regions: treemap/categorical region views use `--cat-region-*`; countries inherit their region color and are told apart by label/position. Map the data's region codes onto the six keys (both Americas → `americas`); unmapped → Unknown role, not Other.
- Tests at existing seams: bucket boundaries daily 0/1/2/3/4/5, monthly quarter edges + zero max, visits 0/1/2/3/4/9/10; region mapping; legend text. Shared computations/geometry unchanged.

## Comments
