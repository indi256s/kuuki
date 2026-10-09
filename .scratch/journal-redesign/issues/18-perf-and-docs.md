# 18 1k-flight measurement and DESIGN.md

Status: open
Type: task
Owner: Sonnet (measure), orchestrator (docs)
Blocked by: 17
Spec: Open risks; D3, D8; Rule precedence

## What

Seed 1,000 flights on the local preview (`scripts/performance-audit.mjs` pattern, bulk endpoint), measure payload gzip size, hydration and time to interactive at 4× CPU throttle with `agent-browser`. Apply the D3 fallback if over 1.5 s. Record the result in the spec. Record every DESIGN.md deviation (weights, eyebrow, slot-text, split pane, firsts glyph) in a Journal section of DESIGN.md.

## Done

- Numbers recorded with method. DESIGN.md updated.
