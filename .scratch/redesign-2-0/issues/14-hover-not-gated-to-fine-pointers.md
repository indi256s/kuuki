# Some hover styles are not gated to fine pointers

Status: ready-for-agent
Owner task: T18
Source: design-md-code-vs-brief.md item 6; verified at af92d26 (one extra occurrence found)

## What is wrong
The brief and `client/ui/ui.css` require `@media (hover:hover) and (pointer:fine)` around hover styles, so touch taps do not leave a stuck hover. These rules sit outside any such media query:
- `apps/next/src/app/reads.css:1` `.flight-row:hover`
- `apps/next/src/app/styles.css:12` `.main-nav a:hover`
- `apps/next/src/app/public.css:3` `.guest-actions nav a:hover`
- `apps/next/src/client/capture/capture.css:1` `.capture-combo button:hover` (not in the brief note; found while checking)

## Expected behaviour
Every `:hover` rule in `apps/next/src` is inside `@media(hover:hover) and (pointer:fine)`.

## Acceptance check
A small source test (like the existing token tests) that reads every `apps/next/src/**/*.css` file and fails for any `:hover` selector not nested in that media query. Red now with the four rules above. The ESLint rule from `chore/agent-guardrails` covers colours and transitions, not this.
