# Avatar menu button shows an initial, not the reactive blob avatar

Status: ready-for-agent
Owner task: T18
Source: design-md-code-vs-brief.md item 3; brief docs/plans/2026-10-04-redesign-2.0-ux-ui.md:214, :362; verified at af92d26

## What is wrong
`apps/next/src/client/avatar-menu.tsx:36,45` renders the first letter of the display name or username inside `.avatar-button`. The brief says the avatar menu uses the same blob avatar as the profile, "not initials", and that the reactive blob avatar is kept. `apps/next` has no blob avatar component yet.

## Expected behaviour
The button shows the blob avatar (1px pure black/white 10% outline, no glow, per the brief's avatar rule) for the signed-in user, consistent with the profile page. Keep the `aria-label`.

## Acceptance check
An `avatar-menu.test.tsx` case that renders the menu for username `kuuki` and expects the blob avatar element (for example `data-avatar="blob"`) in the trigger and no text node "K". Red now.
