# Kincha and Sakura accent foreground: brief says dark text, code uses white in light

Status: needs-triage
Owner task: T18
Source: design-md-code-vs-brief.md item 12; brief docs/plans/2026-10-04-redesign-2.0-ux-ui.md:94; DESIGN.md:18-22; verified at af92d26

## What differs
Brief: "Gold and Sakura use dark foreground text." Code (`apps/next/src/app/styles.css:8-9`): in light, Kincha `#795c1e` and Sakura `#8c4c65` use `--accent-foreground:#fff`. In dark, they use `#292827`, which matches the brief. DESIGN.md documents the code ("the built light fills are dark enough for white"). Computed contrast: white on the light fills is 6.25:1 (Kincha) and 6.29:1 (Sakura); `#292827` on them would be 2.36:1 and 2.34:1, below AA.

## Decision needed
Brief or code wins. The brief's rule probably described the original lighter fills; the shipped light fills are dark. Recommendation: keep the code, amend the brief line.

## Acceptance check
`apps/next/src/app/tokens.test.ts:106` already asserts 4.5:1 for `--accent-foreground` on `--accent` per theme and accent. If the code wins, close with a one-line brief edit (no test change). If the brief wins, that test goes red on the dark-text change and forces new, lighter fills.
