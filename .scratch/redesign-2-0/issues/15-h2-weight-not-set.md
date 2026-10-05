# h2 has no font-weight, so it renders at 400 instead of the brief's 600

Status: ready-for-agent
Owner task: T18
Source: design-md-code-vs-brief.md item 7; brief docs/plans/2026-10-04-redesign-2.0-ux-ui.md:117; verified at af92d26 by reading CSS, not in a browser

## What is wrong
`apps/next/src/app/styles.css:11` sets `h2{font-size:22px;line-height:28px}` (h1 has `font-weight:600` on the same line) and no rule gives `h2` a weight. `@import "tailwindcss"` (`styles.css:1`) brings Tailwind preflight, which sets `h1..h6{font-weight:inherit}` (`node_modules/tailwindcss/preflight.css:73-81`), and `body` is 400. So section headings inherit 400. The brief's H2 is 22/28 at 600.

## Expected behaviour
`h2` computes to font-weight 600 everywhere it is not deliberately overridden.

## Acceptance check
A CSS source test (or jsdom `getComputedStyle` with the stylesheet loaded) that asserts the global `h2` rule contains `font-weight:600`. Red now.
