# Ticket perforation notch uses --background, wrong on non-background surfaces

Status: ready-for-agent
Owner task: T18
Source: progress.md:81 (T03 deferred minor); verified at af92d26

## What is wrong
`apps/next/src/client/signature/signature.css:23` paints the `.ticket-perforation::before/::after` notches with `var(--background)`. The notches are meant to look cut out of the ticket, so they show the page colour wherever the ticket sits. On `--surface` or `--surface-inset` containers (sheets, dialogs, cards) they render as visibly wrong discs.

## Expected behaviour
The notch colour follows the surface behind the ticket (for example a `--ticket-backdrop` custom property set by the container, defaulting to `--background`).

## Acceptance check
A test that fails while the rule hard-codes `var(--background)`: read `signature.css` (or render `Ticket` with a stub inside a container that sets the backdrop property) and assert the notch background resolves through the backdrop property. Do not add a screenshot check (visual checks are out of scope for this run).
