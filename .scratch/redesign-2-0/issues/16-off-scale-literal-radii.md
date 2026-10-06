# Literal border radii outside the radius scale

Status: resolved
Owner task: T18
Source: design-md-code-vs-brief.md item 8; DESIGN.md radius scale (6/10/14/20/full); verified at af92d26

## What is wrong
- `apps/next/src/app/public.css:3` `.category-tabs a{border-radius:24px}` is off the scale (pill intent: `--radius-full`).
- `apps/next/src/app/reads.css:1` `.rank-track{border-radius:9px}` is off the scale (a 4px track: `--radius-full`).
- `apps/next/src/app/reads.css:1` `.read-sheet{border-radius:20px 20px 0 0}` equals `--radius-lg` but is a literal.

## Expected behaviour
All radii use `--radius-xs|sm|md|lg|full`.

## Acceptance check
A source test over `apps/next/src/**/*.css` that fails on any `border-radius` value containing a bare `px` literal other than `0`. Red now with the three rules above. Check that the pill and track still look right by reasoning from the tokens, not screenshots.

## Continuation disposition — 2026-10-05

39b4dc8 and 42e8284 replace remaining off-scale literal radii with existing tokens. Complete source-rule audit passed; visual proof is deferred.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.
