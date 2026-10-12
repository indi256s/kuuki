# Navbar redesign (direction A "Ledger"): implementation plan

Spec: root checkout `.scratch/navbar-redesign/spec.md` (binding: Accepted decisions, Q6–Q13, Q15–Q19, menus critique follow-ups) and `paper-design.md` Round 3. Paper boards "Navbar A — …" on page "Sheet anatomy" are the visual source; values are read with `get_jsx`/`get_computed_styles`. Q20 "Straight to the shutter" is out of scope.

Branch `feat/navbar-redesign`. Progress lives in the adjacent [handoff](2026-10-12-navbar-redesign-handoff.md).

## Decisions taken at implementation (2026-10-12)

- Queue label: "To review" / «На проверку», shared by the Add card and the account menu.
- On mobile the account menu also tints its shield as a scrim, with the rail above it.
- `/me` stays as a route; only its tab goes.
- Theme and Language become inset trays like Accent (Round 3), replacing the radio rows.
- UX refinements: menus opened from the keyboard skip the pop-in; a rail tab tap closes the Add card instantly; + → × is a CSS transition on the glyph, press scale on the key; chooser rows press with fill only (no scale); accent changes from the tray don't transition; the hidden rail clears its 12px inset; the scrim blocks touch scrolling; the account menu hides when its anchor scrolls away.

## Waves

1. **Primitives** (`client/ui/menu.tsx`, `ui.css`): `Menu` gains offsets, a content class, a tinted shield (`scrim`), keyboard-open instant mode, `hideWhenDetached`. New `MenuTray`: a radio group that is one Up/Down stop; Left/Right selects and applies live; text and swatch cells.
2. **Account menu + queue entry** (`avatar-menu.tsx`, `queue-summary.tsx`, tests): rows and groups per Round 3; queue row with count, zero hidden, unavailable state; accent tray saves like Settings.
3. **Desktop header** (`shell.tsx`, `nav.tsx` PrimaryNav, `shell.css`, `styles.css`, `animated-icons.css`; delete `split-add.tsx`): sticky solid header, three routes with the tint pill, one Add flight menu button.
4. **Mobile rail + Add card** (`nav.tsx` TabBar, `add-actions.tsx`, `shell.css`, `shell.tsx`): floating rail, + key, Add card on `Menu`, scroll-away header with avatar, clearance.
5. **Docs**: `DESIGN.md` Motion, Iconography, Shell and navigation, Primitives; `docs/README.md` entry points.
6. **Gates**: typecheck, lint, format, unit tests, `pnpm next:build`, full `pnpm test:next:navigation`; live check at 1440/390/320, light/dark, EN/RU, 200% text.
7. **Ship review**: one GPT-6.1-Sol high review, then fixes.
