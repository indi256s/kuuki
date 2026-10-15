# Leaderboard redesign: handoff

Plan: [2026-10-15-leaderboard-redesign.md](2026-10-15-leaderboard-redesign.md). Spec: [.scratch/leaderboard-redesign/spec.md](../../.scratch/leaderboard-redesign/spec.md).

## Owner and checkout

- Branch `feat/leaderboard-redesign`, worktree `/Users/indi256/.t3/worktrees/kuuki/feat-leaderboard-redesign`, based on local `main` at `79d37815`.
- Authority: local edits and local commits on this branch only. Push, PR, merge into `main`, remote D1 migration `0014`, deploy and production checks are not authorized.

## Accepted waves

| Wave                 | Commit     | Acceptance evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| -------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Inputs               | `e04ac67d` | Spec and plan copied from the root checkout.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| W2 shared primitives | `b9b3d0d1` | `pnpm --filter @kuuki/next test`, typecheck, lint exit 0 (worker run, rechecked by lint/format before commit); browser before/after on the fixture at 1280 and 390: computed styles of the Next up flap cell, digit, seam and the profile gate tile/label/value identical to the base build except the keyframes name; one 390 label-width difference traced to tile order (the base build listed year rows).                                                                                                                                                                                                                                                                                                      |
| W1 data              | `fbc097bf` | `pnpm test:api` 935/935, `pnpm typecheck:api`, `pnpm typecheck:maintenance` exit 0; preview on the new build applied migration 0014 and rendered the old page with the new fixture (tie at #3 then #5, private member absent, 26 rows); passport gates show five all-time sky tiles (the base build showed ten, the year rows leaking).                                                                                                                                                                                                                                                                                                                                                                            |
| W3 page              | `238551f8` | Next tests 477/477 in the touched folders, full Next suite green apart from two load flakes that pass alone (`dev/stamps/page.test.tsx`, `overview/sections/rhythm/section.test.tsx`), typecheck, lint, format exit 0. Browser on the fixture (1280, 390): guest narrator and leader values; `a@example.test` #15 with the 2-flight gap to @fixture-hana, ground tiles locked; board 5–10, gap row, 13–17 with lead-in; category and period switches show no skeleton and mirror the URL; Show all focuses #11; no page or console errors; 390 has no horizontal overflow; podium rises once per session and not under reduced motion. Fixed during review: Free sign on a skipped rank, tied step taller than #1. |

## Decisions

- **Owner reads gain `is_public = 1`** (`/api/me/rankings`, `server/profile.ts` `readOwnRankings`). No test pinned the private-owner case; the rebuild no longer keeps a place for private members; the owner copy already says rankings need a public profile. Without the filter a private owner would see a stale place for up to one maintenance pass. Pinned in `functions/test/public-reads.test.ts`.
- **Zero values are not ranked**, except all-time sky boards (parity: every eligible member ranks there).
- **Viewer states** add `off` (private or opted out) and `unranked` (eligible, no place here) to the plan's `ranked / progress / blocked / pending`; the narrator has lines for both, plus `slipped` (rank down since the last publication, from `recordRank`) and `empty`.
- **Year sky countries** come from airport countries of that year's flights (no legacy evidence or transit rules), recorded in the rebuild header.
- **Podium medal tokens** `--gate-gold/silver/bronze`: light uses the dark-theme medal values (the light `--rank-*` measure about 2:1 on the ink sign), dark aliases `--rank-*`; `tokens.test.ts` holds them at 4.5:1 on `--gate-surface` in every mode and accent.
- **W3 additions beyond the brief:** podium `aria-label` "Top three", visually hidden Free-sign hints, guest tile name "no leader yet" on an empty board, strip centring by `scrollLeft` instead of `scrollIntoView`, `SplitFlap` `delay` prop for the podium.
- **Existing `--gate-rank`** measures 4.16:1 on the dark sign with the Shu accent; it is 36px display text (3:1 applies) and predates this work, so it is left alone.

- **Migration `0014` gives `period` a default of `'all'`**, so a pre-period maintenance worker that runs between the migration and the deploy still writes valid all-time rows.

## Final gate

- `3a33eb5f`: the fixture keeps `ranked@example.test` for the ranked member (the Playwright auth entry depends on it).
- `KUUKI_NEXT_PORT=8812 pnpm verify:cloudflare` exit 0 on `238551f8` (Next 1792/1792, API 935/935, runtime smoke passed).
- Browser lane on the final build (agent-browser, port 8811, 1280 and 390): see the W3 row; evidence screenshots in `.scratch/leaderboard-redesign/evidence/` (local, untracked).
- `pnpm test:next:navigation`, run once: the leaderboard and auth-entry specs pass after `3a33eb5f`. The remaining failures (avatars look-around, read-route settle, read-journeys, an account draft test) are flaky and not caused by this branch: the base `79d37815` fails avatar, read-route, read-journeys and a map spec (50 passed, 4 failed), and the account test passes alone 5/5.

### Final review (GPT-6.1 Sol, high)

Verdict: request changes for live eligibility and tie handling; privacy otherwise correct. All findings accepted and fixed in the review-fix commit:

1. Ground read gate lacked the three-completed-journeys threshold, so a member who cancelled a journey stayed listed until the next rebuild. `READ_GATE` now counts completed journeys live; pinned in `leaderboard-refresh.test.ts`.
2. Show all disappeared when every loaded row stood on the podium (ten tied at #1). The board renders whenever more rows can load; pinned in `leaderboard-page.test.tsx`.
3. A tied viewer lost the gap when the member to beat sat outside the list. The gap line moves to the viewer's own row, keeping the target's name; pinned in `leaderboard-page.test.tsx` (both tests fail on the old board list).
4. `/api/leaderboard/total-users` lacked `p.is_public = 1`. Added; pinned in `leaderboard-refresh.test.ts`.
5. Nit: the winner's digits flipped on every hard load. They now stay settled when the session script removes `data-rise`.

After the fixes: `pnpm test:api` 936/936 exit 0 (an earlier run in parallel with other lanes exited 1 after 292s with the failure uncaptured; the isolated rerun and the gate below both passed), `pnpm typecheck:api`, Next typecheck, lint and `pnpm format:check` exit 0, and `KUUKI_NEXT_PORT=8812 pnpm verify:cloudflare` exit 0 (Next 1794/1794, API 936/936, Next workerd and share-card smoke passed). No browser rerun: the UI fixes touch edge cases the fixture does not reach, and the unit tests cover them.

Reviewer notes, not code changes: the rebuild writes about 1,335 statements per pass at 1,000 members (fine now, worth watching); migration `0014` needs a coordinated release.

## Next action

Owner: release. Remote migration `0014` follows `docs/runbooks/audit-remediation-release.md` (target, writer hold, backup and restore proof, schema admission), then deploy the app and the maintenance worker together. None of this is authorized on this branch.

## Inputs needed to resume

- Committed: `.scratch/leaderboard-redesign/spec.md` and the plan (`e04ac67d`).
- Reproducible: `pnpm install --frozen-lockfile`, `pnpm next:build`; preview with `KUUKI_NEXT_PORT=<free port> pnpm next:preview` (a stale preview from the root checkout holds 8800).
