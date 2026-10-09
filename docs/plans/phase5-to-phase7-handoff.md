# Handoff — Kuuki Phase 5 COMPLETE, Phase 7 COMPLETE → Phase 8 next (NOT authorized)

Generated 2026-06-21. Phase 5 (migrate live Supabase data into **LOCAL** Cloudflare D1) is
**built, validated, and committed** — `git ae4312b` on branch `fix/33-image-removal`.
Phase 7 (Access-gated preview deploy + e2e) is **COMPLETE** — see "Phase 7 OUTCOME" below.
**Nothing pushed; production `kuuki` / remote `kuuki-db` never touched.** Phase 8 is
**NOT authorized** — stop at its boundary (see §6).

## Phase 7 OUTCOME — COMPLETE (2026-06-21)

- **Bug found & fixed:** deployed signin 500'd — Workers `crypto.subtle` rejects PBKDF2
  iterations >100k (`NotSupportedError`), app used 210k. Fix `git e261cf5`:
  `functions/api/_lib/crypto.ts` 210k→100k (+ `reset-passwords.ts` round-trip assertion).
  Invisible locally because pages-dev/Vitest use Node crypto (allows 210k). Committed, not pushed.
- **Re-hashed** all 26 local users at 100k → validate.ts **27/27** → re-exported the local dump
  → wiped & reloaded preview remote `kuuki-db-preview`. Verified counts: users 26, flights 343,
  visits 171, adv_stats 17, lb 25, aircraft 214, airports 557, a380 2, reset_required 0, 26×100k hashes.
- **Redeployed** `kuuki-staging` (swap-config method) and re-ran the gated e2e: **13/13 PASS** —
  token reaches origin, unauth→401, signin A/B→**200** (was 500), ownership 200/404/200/404,
  flight-id isolation (80 / 65 / 0 overlap), distinct per-user stats. e2e script `/tmp/kuuki-e2e.sh`.
- Gates re-confirmed: functions tsc 0, apps/web tsc -b 0, build OK, **175/175** tests.
- **Still open at close:** teardown vs keep (revoke service token `5c8cfde2…` + `rm /tmp/kuuki-access.env`
  at minimum); whether to commit `wrangler.staging.toml`. Both deferred to a user decision.

## 1. Status — DONE

LOCAL D1 (`.wrangler/state/v3/d1`) holds the full migrated dataset and passes all gates:

- **validate.ts: 27/27 hard exact-equality gates PASS** (counts, derived stats row×col vs oracle, passport, seed layer, leaderboard 5 cats, FK closure, canonical timestamps, no RESET_REQUIRED).
- Verify gates: `functions tsc` 0, `apps/web tsc -b` 0, `apps/web pnpm build` OK, **`apps/web pnpm test:run` 175/175**.
- Final D1 counts: users 26, profiles 26, flights 343 (max id 509), country_claims 37, ground_visits 15; aircraft 214, airports 557, badge_definitions 60, code words 50/50; visits 171 (max 1840), user_stats 17, user_advanced_stats 17, user_badges 26 (max 43, all founding-user), leaderboard_cache 25 (max 1545, 5 categories).

## 2. How it was built (rebuild = run in this order from repo root)

0. Clean: `rm -rf .wrangler/state/v3/d1` → `wrangler d1 execute kuuki-db --local --file=db/migrations/0001_init.sql`
1. Seed: `wrangler d1 execute kuuki-db --local --file=db/seed/<each>.sql` (aircraft, airports, badge_definitions, _code_adjectives, _code_nouns)
2. Raw import: `npx tsx scripts/sb-to-d1.ts`
3. Dual-path audit: `npx tsx scripts/derive.ts` (regen + diff report → docs/plans/phase5-derive-divergence-report.md)
4. Ship live oracle: `npx tsx scripts/ship-oracle.ts` (replaces regen for all 5 derived tables)
5. Passwords: `npx tsx scripts/reset-passwords.ts`
6. Validate: `npx tsx scripts/validate.ts`

> Snapshot regen (if `db/_snapshot/*.json` is gone, it's gitignored): re-run the read-only Supabase MCP export (see git history of this session) — every chunk is md5-gated vs Postgres.

## 3. Corrections to the prior build-handoff (verified this session — trust THESE)

- **flights has 20 live columns, NOT 21.** `aircraft_lookup_attempts` exists ONLY in the D1 target (DEFAULT 0); the import omits it. Always drive column lists from `db/_snapshot/_schema.json` (live information_schema).
- **airports_reference = 557** (packages/data), not 525. aircraft 214 after dropping the 2nd `E135`.
- **Council finding CONFIRMED by data:** regenerate-from-final-state diverges from live cumulative state — visits regen 156 vs live 171, user_badges regen 113 vs live 26, user_stats counts lower than live. So **all 5 derived tables ship the LIVE oracle** (ship-oracle.ts), not regenerated. derive.ts is the audit/diff only.
- **`getPlatformProxy()` persist path:** it does NOT append `/v3` (unlike the CLI's `--persist-to`). Use the full `.wrangler/state/v3` (or default). All scripts standardized to the canonical store; `wrangler --local` (default) and `--persist-to .wrangler/state` also resolve there.
- **`sqlite_sequence` has no UNIQUE/PK** → `INSERT … ON CONFLICT(name)` is rejected by D1. Use `UPDATE sqlite_sequence SET seq=… WHERE name=…` (the row already exists after an AUTOINCREMENT insert with explicit ids). Fixed in sb-to-d1.ts + ship-oracle.ts.
- Only **17 of 26 users have flights** → 17 user_stats/advanced rows; 3 users are upcoming-only (total_flights=0).

## 4. Local smoke — DONE (verified 2026-06-21)

Ran `wrangler pages dev` against the persisted LOCAL D1 and signed in as a migrated user
(temp password `kuuki-local-dev-2026`): GET /api/auth/me (unauth) → `{user:null}`; POST
/api/auth/signin → **200** with user+profile; GET /api/auth/me (auth) → user object; GET
/api/me/advanced-stats → **200** with computed stats. End-to-end **PASS**.
**Correct command is config-driven:** `npx wrangler pages dev --persist-to .wrangler/state --port 8788`
(bindings come from wrangler.toml). Do **NOT** pass `--d1=DB=kuuki-db --kv=IMPORT_JOBS` — those
override flags key an EMPTY local DB (different hash than the config UUID) and signin 500s with
`no such table: users`. The reset-passwords.ts smoke block was fixed accordingly.

## 5. Open / deferred (do NOT do without authorization)

- **Data-quality note (CORRECTED at close-out 2026-06-21):** 2 flights (ids **495, 496**; user `4fc167f2`) carry `aircraft_icao='A380'` instead of canonical `A388`. The earlier "no read path joins flights→aircraft_reference" claim is **WRONG** — advanced-stats _does_ join: `LEFT JOIN aircraft_reference ar ON f.aircraft_icao=ar.icao` in `advancedStatsBreakdowns.ts:90/119/148` + `advancedStatsInsights.ts:118/205/224`, so on recompute these 2 flights bucket as `Unknown`/`unknown` manufacturer+type (verified via repro query). **Decision: keep verbatim** — live Supabase's `aircraft_reference` also has only `A388` (never `A380`), so live degrades identically → D1==live parity; and the shipped `user_advanced_stats` oracle is live-derived (and stale, predates these flights) so A380 feeds no validation gate. Normalizing at import would make D1 the only divergence from live. **Real fix** = `UPDATE` live Supabase flights 495/496 → `A388` + re-snapshot + add aircraft-input validation; do it at/around Phase 8, NOT as an import transform. Documented in `scripts/sb-to-d1.ts` (buildFlightRows). (Supersedes background task task_8b963cad's "cosmetic" framing.)
- Stray untracked `docs/agents/` (domain.md, triage-labels.md, issue-tracker.md) appeared mid-session, unrelated to Phase 5 — left untracked, not committed. Review/remove separately.
- Deferred carry-forwards (Compare regression, admin-script rewrite, i18n/SUPABASE cleanup) per spec §7.5 — untouched.

## 6. Phase 7 DONE → Phase 8 next (DEPLOY-GATED — NOT authorized; get explicit user OK)

- **Phase 7:** ✅ DONE — preview deploy + gated e2e incl. cross-user isolation (see "Phase 7 OUTCOME" above).
- **Phase 8 (NOT authorized):** kuuki-cron for _/5 leaderboard refresh, prod AUTH_SECRET, final re-export, promote to remote `kuuki-db`, force password reset for all users, remove SUPABASE\__ vars, lock down Supabase (anon key is compromised in git history), and the A380→A388 live-data fix (flights 495/496, user `4fc167f2` — see §5 + `sb-to-d1.ts` buildFlightRows). When Phase 8 runs, also re-hash production at the same 100k cap (the PBKDF2 fix above is required for prod signin too).

## 7. Guardrails (still in force)

Commit don't deploy; LOCAL D1 only; never push/PR or run against remote D1 without explicit user request. `db/_snapshot/` + `.dev.vars` stay gitignored (contain emails / secret).
