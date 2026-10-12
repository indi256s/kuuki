# Stable comparison slots, brand series cues, interaction states

Status: resolved
Type: task
Node: D (spec stories 8, 11, 12; execution map T6)
Blocked by: 01, 03

Acceptance:
- `comparison-slots.ts` implements T6 (stored assignments immutable; free-slot first; seed = whole-journal order; `localStorage` `kuuki:cmp:v1:<ownerId>:<analysis>`; slot → `--cmp-N` + stable dash + marker). Rankings airport/route bump uses it instead of cohort position; fifth series uses `--cmp-5`, never `--mark-ghost`.
- Test scenario: initial → reorder → filter/year → new entity → reload (fresh module, same storage) → exhaustion; earlier keys keep slot/pattern; accent change keeps slot index.
- Airline bump/slope: dash + marker keyed by airline key (≥5 distinct dash/marker pairs); donut: visible sector separators that do not alter geometry, legend with name, count and share; unknown brand → neutral + label.
- `KuukiChart` states: hover = stronger contour; keyboard focus = focus ring; pinned tooltip keeps highlight; filter = check + selected chip; none of them recolors data or applies a filter; no global .22 dimming; isolation only via legend with an accessible "show all".
- Baseline (ghost) series keep a label and dash; baseline never adds to scoped totals.
- Existing `kuuki-chart.test.tsx`, `chart-fidelity.test.tsx`, `chart-ssr.test.tsx` and section tests pass; new tests only for slots and state separation.

## Comments
