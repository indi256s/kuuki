Execution ledger: execution-ledger/v1
Plan: .scratch/onboarding-morph/spec.md (ready-for-agent, O1–O26, checks 1–13); decisions.md; design values .scratch/onboarding-morph/design-values.md (Paper extract, pending)
Workspace: /Users/indi256/.t3/worktrees/kuuki/feat-onboarding-morph; base ec7709e4 (clean except untracked .scratch/onboarding-morph)
Runtime: Claude Code Agent tool (Sonnet 5.5 workers, shared workspace, disjoint owned paths); reviews via T3 delegate_task codex/gpt-6.1-sol reasoningEffort=high
Authority: implement locally; local migrations/D1 and dry-runs OK. NOT authorized: commits, pushes, PRs, deploys (kuuki-import, kuuki-import-preview, kuuki-next), remote D1 writes. No Claude/Anthropic credit anywhere.
Profiles: primary Opus 5.5 (shell, identity transition, migration 0010, job-worker binding acceptance); workers Sonnet 5.5 (Agent model=sonnet, recorded); reviewer gpt-6.1-sol high (recorded via delegate_task target)

## Settled implementation decisions (primary)

- D-a Server body flag `username_derived: true` on PATCH /api/profiles/me: server resolves collisions with -2, -3… silently. Without it a taken username is 409.
- D-b Lazy address (O26): when an onboarded profile has no username and a PATCH doesn't set one, the server derives it from display_name (covers Settings save and is_public toggle).
- D-c `display_name: null` stays allowed in PATCH (clear); any string must normalize to 1–40 chars or 400 INVALID_NAME.
- D-d Onboarded endpoint: `POST /api/profiles/me/onboarded` (idempotent COALESCE).
- D-e Resume step adds `ready` when the member has saved flights and no open batch (closed tab at reveal). Spec O4 doesn't list it; otherwise they'd land on the prompt with flights already saved.
- D-f Sign-in: after a successful continue, read own profile with the identity token; onboarded → dissolve then `/overview`; not onboarded → document navigation to `/welcome/name` (server redirects to the resume step), no dissolve.
- D-g In-place identity transition only when the departing owner is a guest (null) and the card is mounted; otherwise document navigation to `/welcome/name`.
- D-h Dissolve ends with a document navigation (`location.assign('/overview')`), so no guest-era router cache survives.
- D-i Rate-limit 429 carries no retry time today; client shows "Try again in a while" (spec-compliant, countdown only if present). No server change.

## Nodes

| Node | Wave | Owner | Owned paths | Depends | State |
|---|---|---|---|---|---|
| M0 migration 0010 + backfill test (check 4) | 1 | primary | db/migrations/0010_onboarding_state.sql, functions/test/onboarding-state-migration.test.ts, functions/test/restore-export-local.test.ts | – | accepted (2 files 5 tests pass) |
| W1a address + profiles API | 1 | sonnet (accepted: diff read, 57 tests pass) | packages/shared/src/address.ts(+test), packages/shared/package.json exports, functions/api/profiles/**, functions/api/_lib/profiles.ts, profile types, functions/test/profiles-onboarding.test.ts, apps/next/api-routes.generated.ts | M0 | pending |
| W1b parser v2 + caps + prompt v2 | 1 | sonnet | functions/api/import/_text.ts, functions/api/_services/{importJob,importDrafts}.ts, workers/import/ImportJob.ts, functions/test/import-*.test.ts, apps/next/src/client/import/copy.ts (prompt keys), apps/next/src/client/import/prompt-contract.test.ts | – | pending |
| W1d job-worker config + CI + docs | 1 | sonnet (primary accepts) | workers/import/wrangler.toml, apps/next/wrangler.toml, package.json scripts, .github/workflows/ci.yml, scripts/check-preview-config.mjs (if needed), smoke fixture (if needed), docs/adr/0001 §9, docs/skills/deploy-kuuki/SKILL.md | – | pending |
| W1c welcome narrator | 1b | sonnet | apps/next/src/client/overview/narrator/{welcome.ts,welcome.test.ts,corpus.ts} | design-values | pending |
| S shell, routing, gates, identity transition, /onboarding redirect | 2 | primary | client/activity.tsx, client/auth-card/auth-card.tsx(+frame), client/welcome/** (shell + contracts), app/(card)/welcome/[step], app/(entry)/onboarding, server/gates.ts, server/welcome.ts, app/me/page.tsx, route-focus, url-state | W1a contract | pending |
| U1 passport preview | 3 | sonnet | client/welcome/passport/** | S, design | pending |
| U2 name step | 3 | sonnet | client/welcome/name-step* | S, W1a, design | pending |
| U3 flights step (ingest) | 3 | sonnet | client/welcome/flights/** | S, W1b, design | pending |
| U4 compact review | 3 | sonnet | client/welcome/review/** | S, design | pending |
| U5 reveal + dissolve | 3 | sonnet | client/welcome/ready/** | S, W1c, design | pending |
| U6 Settings name/address (O26) | 3 | sonnet | client/account/settings-form.tsx(+test) | W1a | pending |
| I integration, retire old onboarding, Playwright 1–3 | 4 | primary | apps/next/tests/**, retire client/public/onboarding-* | all | pending |

## Requirements → node → evidence

O1,O2 S + check 1 (Playwright) · O3,O4,O25 S + check 2 · O5 S (dissolve on sign-in) · O6 S/U3 + check 3 · O7 S/U1 CSS + visual · O8 U2 + check 11 · O9 U1/U2 · O10 W1a/U2 + check 5 · O11 U2 test · O12,O13 U3 · O14 U3 + check 8 · O15,O16 U3 + manual browser log · O17 W1b + check 6 · O18 U3 + check 12 · O19 U3 · O20 U3 (manual form) → U5 · O21,O22 U4 + check 9 · O23 W1c/U5 + check 10 · O24 W1b + check 7 · O26 W1a/U6 · config W1d + check 13

## Checks

| Check | Owner | Result |
|---|---|---|
| baseline pnpm test | primary | running (/tmp/kuuki-om-baseline-test.log) |
| 4 migration backfill | primary | pass (vitest 2 files, 5 tests) |

## Events

- 09:38 setup; spec copied; docs read; 3 researchers + 1 Paper extractor dispatched (sonnet)
- 09:41 M0 written and passing
- User directive: no swarms (one subagent at a time), no per-wave reviews, no visual review; one code+design review at the end. Waves become a serial queue: W1a → W1b → W1d → W1c → U* ; primary builds S in parallel with the single active worker.

- 09:55 W1a accepted (address.ts, PATCH validation + derived suffix + lazy address, onboarded endpoint, routes regenerated)
- primary: S built (server/welcome.ts resume, gates.ts on onboarded_at, /welcome/[step] page, /onboarding + /me redirects, in-place identity transition in activity.tsx, AuthCard welcome mode + dissolve, WelcomeFlow + step stubs/contracts, welcome.css frame); old onboarding page/components/tests retired; Next typecheck clean
- primary: W1d done (workers/import/wrangler.toml prod+preview, IMPORT_JOBS bindings, request-signal flags verified dateless per CF docs, build:import:release dry-runs pass, CI step, check-preview-config import alignment + negative test, ADR §9 + deploy skill + DESIGN route-focus note)
- primary: fixtures — seeded members onboarded; claimUsername also finishes onboarding; welcome.test.ts (check 2)
- W1b dispatched (parser v2, caps, prompt v2)
- 10:15 U1+U2 accepted (name-step + passport; 14 tests, typecheck clean, lint clean). Worker deviations: slug-only address editor, pencil icon, empty-name reason text, stamps show country only (no year), cover aria-hidden.
- U3 dispatched (flights step). Deviation decided: reading-state "Finish later" link omitted (undefined in spec, conflicts with final skip).
- 10:27 U3 accepted (flights step; 22 welcome tests, typecheck/lint clean). Primary added the named heading ("Where have you flown, Alex?") via a `name` prop. Worker deviations: truncated shows the cap block + Review N (no auto-nav); "took the first N" copy (no original count from server); rate limit keeps Copy again; drop overlay covers the viewport; touch gets "Add a boarding pass" picker; gone batches leave the URL; 17.13 goes straight to review.
- primary: auth-entry create test → /welcome/name; navigation gate test → /welcome/name; route-focus unit tests retargeted; Playwright checks 1 and 3 written in welcome.test.ts.
- U4 dispatched (compact review).
- 10:40 U4 accepted (compact review; 29 welcome tests, typecheck clean). Deviations: resolved rows leave the unsure group immediately; warning tint = color-mix of --warning-fill; open-airport rows treated as unsure; extra save-bar copy for K=0; RU "Which {city}?" → «Какой аэропорт?»; other problems reuse ReviewRow (+ import.css on welcome route).
- W1c+U5 dispatched (welcome narrator + reveal).
- primary: next:build exit 0 (/tmp/kuuki-om-build.log; duplicate-key warning is from bundled better-auth). Check 13: apps/next wrangler dry-run prod → IMPORT_JOBS→kuuki-import, DB kuuki-db; preview → kuuki-import-preview, DB kuuki-preview; both exit 0.
- 10:55 W1c+U5 accepted (88 tests). Primary reworded RU upcoming line 1. Deviations: RU city names mostly Latin (only 5 RU aliases in data); upcoming-only stats drop the left-out clause; mobile footer sticky instead of absolute. Big = ≥20 flown & ≥3 countries.
- 11:05 U6 accepted (Settings name/address; 47 account tests). Deviation: /fly/ prefix shown as field hint (no CSS ownership).
- Playwright: welcome checks 1–3 pass. Full suite: navigation gate test expectation fixed (named member → /welcome/flights). map.test.ts:4 globe fullscreen fails; baseline-on-HEAD check dispatched.
- 11:20 Gates: typecheck/api/scripts/import, lint, format:check pass; next vitest 1000/1000; api vitest 699/700 (import-runtime 503 flake, 34/34 isolated ×2); next:build, next:smoke pass; Playwright 39/40 (map.test.ts:4 also fails on clean HEAD ec7709e4, confirmed in a temp worktree).
- Final Sol review (gpt-6.1-sol high) dispatched, round 1.
- 11:40 Sol review r1: 0 blocker, 1 high, 12 medium, 3 low. All 16 fixed:
  primary — #4 sign-in reads /api/auth/me; #6 `jobs` from the server binding gates the resumed close-tab note; #3 lazy address uses COALESCE; #8 Settings omits an unchanged name (+test); #12 reveal passport counts flown only; #13 production import gate in deploy skill; #14 narrator falls through past 90 chars (+test); #15 big = flown ≥ 10, left-out leads when ≥ flown, upcoming keeps the clause (+tests); #16 stamp fixed English; #5 deterministic parse bypasses the scanner (+4,000-row test).
  sonnet — #1 refused rows stay unsure, no silent exclusion; #2 ready-on-mount shows "Review N" instead of bouncing; #7 desktop paste button hides after denial; #9 focus recovery; #10 44px chip grid with airport names; #11 capped scroll region; K=0 "All look right.", Upcoming tag, first codeshare number.
- 11:55 Gates after fixes: next vitest 1010/1010; api vitest 701/701; typechecks, lint, format:check pass; next:build, next:smoke pass; Playwright 39/40 (map.test.ts:4 pre-existing).

## 2026-10-11 — Audit, polish and motion pass

- Morph: same-document view transitions (`client/welcome/morph.ts`) for create→name, step to step, Back/popstate. Card height grows (clipped, radius kept), passport cover↔spread crossfades with scale .96 + blur, step content cross-slides 12–16px + 2px blur by direction. Step group clipped so a taller outgoing step never leaks below the card.
- No entrance replay on reload (`direction` starts null; stamps animate only when fresh, product stamp press 1.06/blur, 60ms slot ripple, centered origin).
- Dissolve hands off to navigation at the halfway point; drop overlay fades out; reading rows enter via @starting-style.
- Reduced motion: 200ms/150ms fades everywhere, no movement.
- Polish: desktop duplicate reveal caption removed (single caption string), chip airport names shortened (Gatwick, Heathrow…), 3px side stripes → 1px full border.
- Checks: typecheck/lint/format clean; Next unit 1006/1010 with 4 load flakes outside welcome (pass alone); build ok; Playwright welcome 3/3. Slow-motion probe captured forward ×3 and back morphs.
- Open: codeshare "TK 383 / UA 9001" parses as UA 9001; reveal eyebrow conflicts with the craft floor but is pinned by boards; light theme not captured.
