# Overview chart composition

Status: implementation authorized 2026-10-14 (user: «отлично запускай агентов в работу»).

Outcome: Aircraft, Rhythm and Rankings tell different useful stories instead of repeating thin bars. Preserve Kuuki typography, semantic data colors, illustrations, honest coverage, filters, accessible tables, keyboard/touch selection and reduced motion.

- Aircraft Makers: adapted Arc waffle for the composition of all selected flights, including outlined Unknown. Exact counts and shares use the same total. Cells represent apportioned shares, never falsely claim one flight each. Preserve the Fleet view and existing duration ridgeline. Reuse the shared chart host and stage pick vs explicit filter contract. Never automatically hide categories. Large histories have bounded mark counts.
- Rhythm: promote existing year-by-month matrix to an explicitly named History view on desktop with multiple years; preserve Seasonality (calendar months) and Years views and existing mobile stage. Selection must have a meaningful accessible description and retain valid filtering. Preserve daily detail and cumulative history without fabricating missing observations.
- Rankings: preserve accurate rank bars, give the ranking a stronger purposeful presentation, and add a direct leader-to-runner comparison where evidence supports it. Remove the duplicate maker pattern from Travel patterns; compact remaining haul/daytime ratios with exact counts, unknown evidence and existing inspect/filter actions.
- Shared card: add opt-in content-sized desktop charts for these three chapters; default chapters and mobile sheet keep their stable bands. Allow natural caption height for opted-in desktop charts. Preserve chart table placement outside collapsed details. No generic layout rewrite.

Scope: local source, docs and checks only. No commit, push, deployment, production changes, or edits to unrelated dirty files. No extra chart library/runtime dependencies. Arc provenance and MIT notice retained. New tests only for distinct behavior risks; existing tests/checks first. Full build and navigation checks are serialized by the controller.

Evidence: reviewed attached desktop screenshots and live source at 8f8d5fd; chart baseline archived /tmp/kuuki-chart-composition-baseline.tar.gz. Existing dirty DESIGN.md/docs/README.md must be preserved when reconciling chart documentation.
