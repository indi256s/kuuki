# 06 Arc primitives A: tooltip, slot-text, checkbox, alert, empty-state, kbd

Status: open
Type: task
Owner: Sonnet
Blocked by: —
Spec: D7, D8; Firsts (tooltip); Motion (summary morph)

## What

Adapt free Arc items into `apps/next/src/client/ui/` following `docs/research/2026-10-08-arc-source-inventory.md` (fetch `https://uiarc.dev/r/<id>.json`, no `motion`, no `foundation.css`, Kuuki tokens, MIT header comment, one CSS file per component, never edit `ui.css`): `tooltip` (150ms, keyboard focus opens, never the only carrier of essential info), `slot-text` (number roll for changing figures, instant under reduced motion and on first render), `checkbox`, `alert`, `empty-state`, plus a tiny `kbd.tsx`. Add each to the dev gallery.

## Done

- One focused test per component where behaviour matters (tooltip opens on focus; slot-text renders final text immediately and under reduced motion).
- `pnpm --filter @kuuki/next typecheck`, `lint`, `test` green.
