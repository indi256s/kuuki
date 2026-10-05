# Add-dialog width depends on CSS import order

Status: resolved
Owner task: T18
Source: design-md-code-vs-brief.md item 9; review-T12-findings.md Minor 7; verified at af92d26

## What is wrong
`apps/next/src/client/ui/ui.css:53` `.ui-dialog{width:min(520px,...)}` and `apps/next/src/client/ui/flight-controls.css:23` `.flight-add-dialog{width:min(560px,...)}` have equal specificity. The 560px width wins only because `ui.css` loads before `flight-controls.css` (Dialog imports `./ui.css`, Combobox and Calendar import `./flight-controls.css`). A different import order silently gives 520px.

## Expected behaviour
The 560px width applies regardless of stylesheet order, for example `.ui-dialog.flight-add-dialog` (the selector the T12 review suggested).

## Acceptance check
A source test that fails unless the `.flight-add-dialog` width rule has higher specificity than `.ui-dialog` (compound selector, or a layer). Red now: both are a single class.

## Continuation disposition — 2026-10-05

The accepted T12 implementation already uses .ui-dialog.flight-add-dialog specificity in flight-controls.css. Source verification confirms the 560px Add contract survives generic dialog styles; no redundant selector fix was added.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.
