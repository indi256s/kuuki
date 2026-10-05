# Add-dialog width depends on CSS import order

Status: ready-for-agent
Owner task: T18
Source: design-md-code-vs-brief.md item 9; review-T12-findings.md Minor 7; verified at af92d26

## What is wrong
`apps/next/src/client/ui/ui.css:53` `.ui-dialog{width:min(520px,...)}` and `apps/next/src/client/ui/flight-controls.css:23` `.flight-add-dialog{width:min(560px,...)}` have equal specificity. The 560px width wins only because `ui.css` loads before `flight-controls.css` (Dialog imports `./ui.css`, Combobox and Calendar import `./flight-controls.css`). A different import order silently gives 520px.

## Expected behaviour
The 560px width applies regardless of stylesheet order, for example `.ui-dialog.flight-add-dialog` (the selector the T12 review suggested).

## Acceptance check
A source test that fails unless the `.flight-add-dialog` width rule has higher specificity than `.ui-dialog` (compound selector, or a layer). Red now: both are a single class.
