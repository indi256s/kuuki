# Add aircraft on a phone lands in the aircraft picker sheet

Status: wontfix
Owner task: T12/T13
Source: T13 fix round 1 concern; `apps/next/src/client/ui/combobox.tsx`, `apps/next/src/client/capture/flight-form.tsx` (`focusField`)

## What differs
"Add aircraft" opens the editor with Optional details expanded and focuses the aircraft combobox. The combobox opens on every focus, so on a phone the picker sheet opens immediately and the user must press Escape to see the form.

## Decision needed
Either keep it (the picker is the task the user asked for) or add a "focus without opening" path to the combobox for programmatic focus.

## Acceptance check
If changed: a unit test that programmatic focus leaves the picker closed while a user tap still opens it, and the Playwright `read-journeys` aircraft step no longer needs Escape.

## Continuation disposition — 2026-10-05

The accepted mobile combobox intentionally opens its searchable sheet on programmatic focus from Add aircraft. This gives the member the requested picker directly; it is not a duplicate save or lost-focus defect.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.
