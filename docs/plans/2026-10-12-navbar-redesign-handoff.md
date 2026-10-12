# Navbar redesign: handoff

Plan: [2026-10-12-navbar-redesign.md](2026-10-12-navbar-redesign.md). Owning checkout: worktree `~/.t3/worktrees/kuuki/feat-navbar-redesign`, branch `feat/navbar-redesign` from local `main` 89a6fb2b.

## Inputs needed to resume

- Checkout-local: root checkout `.scratch/navbar-redesign/spec.md` and `paper-design.md` (untracked).
- External: Paper file `01M48F4SHK61AZS2FH5P5JPRY7`, page "Sheet anatomy", boards "Navbar A — …" (read-only).

## Progress

- Waves 1-4 built and committed: f0a99400, b8521a2b, ee9d11fe, 8441ef07, 7804ea3f.
- Wave 5 (docs): DESIGN.md, `docs/README.md` and this handoff, in the commit that adds this line.
- Latest checks: unit tests (about 1344) green; typecheck, lint and format green; `pnpm next:build` green. Live preview checked at 1440 light and at 390 and 320 in light and dark, EN and RU (Add card geometry, tab tap closes and navigates, keyboard tray).
- Final review: Thermos (both passes) on GPT-6.1-Sol high over `89a6fb2b..HEAD`. Fixed: accent rollback shared across pickers per sign-in; an account-menu accent pick on a public profile now saves; Menu keeps Radix's trigger name unless `labelledBy` is set; a rolled-back tray pick keeps focus; the ledger sticks below the measured header (`--header-block`); literal Add paths in the test; stale `--header-h` row. Kept by decision: Language reloads the page, as in Settings.
- Gates after the fixes: unit 1346, Playwright 44/44, typecheck, lint, format and `next:build` green.
- Pending: the 200% text check and a live look at the wrapped desktop header (narrow RU) with the measured offset.
- Known unrelated issue: Journal mobile swipe rows (`.journal-crossfade`, `.ui-swipe-row`) overflow to 672px at 390px; pre-existing, not from this branch.
- Next action: the pending live checks, then landing on main after the owner's go-ahead.
