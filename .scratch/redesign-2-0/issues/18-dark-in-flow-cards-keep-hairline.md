# Dark-theme in-flow cards keep the hairline instead of the inner top highlight

Status: ready-for-agent
Owner task: T18
Source: design-md-code-vs-brief.md item 11; brief docs/plans/2026-10-04-redesign-2.0-ux-ui.md:150; DESIGN.md:133 (marked Planned W4/T18); verified at af92d26

## What is wrong
Brief level 1 (in-flow): dark theme has no border and a 1px inner top highlight (white 4-6%). Only `Ticket` follows it (`signature.css`: `[data-theme=dark] .ticket{border-color:transparent}`). These keep `1px solid var(--hairline)` in dark: `.read-panel` and `.flight-ticket` (`app/reads.css:1`), `.capture-card` (`client/capture/capture.css:1`), `.auth-card` (`app/public.css`). The highlight does not exist anywhere yet.

## Expected behaviour
In dark, the four cards have a transparent border and `box-shadow: inset 0 1px 0 rgb(255 255 255 / 5%)`. Light is unchanged.

## Acceptance check
A source test that, for each of the four selectors, finds a `[data-theme=dark]` override with a transparent border and an inset top highlight. Red now (no override exists). Ideally use one shared class or token so the next card cannot miss it.
