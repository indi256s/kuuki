# Navbar redesign: handoff

Plan: [2026-10-12-navbar-redesign.md](2026-10-12-navbar-redesign.md). Owning checkout: worktree `~/.t3/worktrees/kuuki/feat-navbar-redesign`, branch `feat/navbar-redesign` from local `main` 89a6fb2b.

## Inputs needed to resume

- Checkout-local: root checkout `.scratch/navbar-redesign/spec.md` and `paper-design.md` (untracked).
- External: Paper file `01M48F4SHK61AZS2FH5P5JPRY7`, page "Sheet anatomy", boards "Navbar A — …" (read-only).

## Progress

- Waves 1-4 built and committed: f0a99400, b8521a2b, ee9d11fe, 8441ef07, 7804ea3f.
- Wave 5 (docs): DESIGN.md, `docs/README.md` and this handoff, in the commit that adds this line.
- Latest checks: unit tests (about 1344) green; typecheck, lint and format green; `pnpm next:build` green. Live preview checked at 1440 light and at 390 and 320 in light and dark, EN and RU (Add card geometry, tab tap closes and navigates, keyboard tray).
- Pending: the full `pnpm test:next:navigation` result, the 200% text check and the final Sol-high review.
- Known unrelated issue: Journal mobile swipe rows (`.journal-crossfade`, `.ui-swipe-row`) overflow to 672px at 390px; pre-existing, not from this branch.
- Next action: final review.
