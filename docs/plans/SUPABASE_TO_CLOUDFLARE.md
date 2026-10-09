# Kuuki: Supabase → Cloudflare Migration Plan

> Authoritative, verified migration spec. Produced by a discovery + design pass and an
> adversarial review; the review's parity/security fixes are baked into this document.
> Status sections are updated as phases land.

## 0. Why this is a backend rewrite, not a swap

Kuuki's React SPA talks **directly** to Supabase from the browser via `@supabase/supabase-js`
(PostgREST `.from()`, GoTrue `.auth`, 2 `.rpc()` calls), secured by Postgres **RLS**. Cloudflare
has no PostgREST (no browser→DB) and no GoTrue. So the migration must:

1. Move all relational state to **D1** (SQLite).
2. Put a **REST API in Pages Functions** (`functions/api/*`) in front of D1; re-enforce every
   RLS rule in handler code.
3. Reimplement all **PL/pgSQL** (stats, badges, leaderboard, visits derivation, durations) as
   **TypeScript service functions** (D1 has no PL/pgSQL).
4. Replace **GoTrue** with **custom auth** in Workers (WebCrypto hashing, httpOnly cookie session).

Not used by Kuuki, so nothing to migrate: **Supabase Storage**, **Realtime**.

Untouched by this migration: the Gemini import worker (`functions/api/import/*`), AirLabs
enrichment (`functions/api/enrich/*`), flight search (`functions/api/search/*`) — all Gemini+KV,
no Supabase/auth. KV `IMPORT_JOBS` stays. Pages project `kuuki` stays.

## 1. Target architecture

```
Browser SPA  ──(same-origin, credentials:'include')──►  Cloudflare Pages "kuuki"
 src/lib/apiClient.ts (typed fetch; no token in JS)        functions/_middleware.ts  → resolves session cookie → context.data.userId
 httpOnly cookie kuuki_session                             functions/api/auth/*      → custom auth (WebCrypto)
                                                           functions/api/{flights,profiles,me,leaderboard,passport,badges,public,reference}/*
                                                           functions/api/{search,enrich,import}/*  (kept; +auth +CORS tighten)
                                                                 │            │              │
                                                                 ▼            ▼              ▼
                                                            D1 kuuki-db   KV IMPORT_JOBS   kuuki-cron Worker
                                                            (all state)   (jobs/cache)     (*/5 leaderboard refresh)
```

REMOVED: `@supabase/supabase-js`, `@supabase/ssr`, GoTrue, PostgREST, Postgres, RLS, all PL/pgSQL,
`SUPABASE_URL`/`SUPABASE_ANON_KEY` (note: anon key is in git history → treat as compromised, lock
down the Supabase project at cutover), `VITE_SUPABASE_*`, `src/lib/supabase.ts`, GoTrue middleware.

ADDED: D1 binding `DB`, `AUTH_SECRET` (peppered hashing, with version tag), `sessions`/`users`/
`invite_codes` tables, custom auth, `/api/*` CRUD layer, CSRF protection, one Cron Worker.

**Decision:** stay on **Pages Functions** (don't migrate to standalone Workers). Add a D1 binding +
new route files. A separate tiny `kuuki-cron` Worker (bound to the same `kuuki-db`) runs the
leaderboard refresh, because Pages Functions can't host Cron Triggers.

## 2. Cloudflare resources

| Resource                            | Action                  | Name / id                                              |
| ----------------------------------- | ----------------------- | ------------------------------------------------------ |
| D1 database                         | create                  | `kuuki-db` (binding `DB`), region hint `eeur`          |
| KV namespace                        | keep                    | `IMPORT_JOBS` id `15bad9e7dfa44f8382883513c8bff292`    |
| Secret `AUTH_SECRET`                | create (prod + preview) | `openssl rand -base64 32`, peppers password hashes     |
| Cron Worker                         | create (Phase 8)        | `kuuki-cron`, `crons=["*/5 * * * *"]`, same `kuuki-db` |
| `[vars]` SUPABASE_*                 | remove                  | —                                                      |
| `apps/web` VITE_SUPABASE_*          | remove                  | —                                                      |
| `GEMINI_API_KEY`, `AIRLABS_API_KEY` | keep                    | —                                                      |

`wrangler.toml` gains:

```toml
[[d1_databases]]
binding = "DB"
database_name = "kuuki-db"
database_id = "<from wrangler d1 create>"
```

## 3. D1 schema strategy

Author **one** SQLite migration `db/migrations/0001_init.sql` representing the _end-state_ schema
(not a replay of the 23 PG migrations), plus seed files. Apply with `wrangler d1 migrations apply`.

```
db/
  migrations/0001_init.sql
  seed/{aircraft_reference,airports_reference,badge_definitions,code_words}.sql
```

### Type translation rules

| Postgres                           | SQLite (D1)                         | Handling                                                                                |
| ---------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------- |
| `SERIAL`/`BIGSERIAL` PK            | `INTEGER PRIMARY KEY AUTOINCREMENT` | on import, INSERT **explicit** ids and bump `sqlite_sequence`                           |
| `UUID`                             | `TEXT` (36-char)                    | `crypto.randomUUID()` in TS before INSERT                                               |
| `TIMESTAMPTZ` + `NOW()`            | `TEXT` ISO-8601 UTC                 | **single canonical format** `YYYY-MM-DDTHH:MM:SS.sssZ` for new writes AND imported rows |
| `DECIMAL(5,2)`                     | `REAL`                              | round at **one** site (see percentile)                                                  |
| `BIGINT`                           | `INTEGER` (64-bit)                  | direct                                                                                  |
| `JSONB`                            | `TEXT`                              | `JSON.stringify`/`JSON.parse`; no `?`/`->>`                                             |
| `VARCHAR(n)`                       | `TEXT`                              | CHECK length only where critical                                                        |
| `BOOLEAN`                          | `INTEGER` 0/1                       | coerce in TS                                                                            |
| partial idx, functional unique idx | keep verbatim                       | SQLite supports both                                                                    |
| `char_length()`                    | `length()`                          | rename                                                                                  |
| `ON CONFLICT … DO UPDATE/NOTHING`  | identical                           | `EXCLUDED` works                                                                        |

### Critical correctness rules (from adversarial review — DO NOT deviate)

- **Timestamp format discipline:** every timestamp (new + imported) is normalized to
  `YYYY-MM-DDTHH:MM:SS.sssZ`. All expiry/ordering checks are TEXT comparisons and break if formats
  mix. Imported Postgres timestamps (`2026-… +00`) MUST be reformatted.
- **AUTOINCREMENT on import:** preserve existing `flights.id` etc. (frontend caches ids); INSERT
  explicit ids and set `sqlite_sequence` so new rows don't collide.
- **`visits` constraints:** declare `country_code NOT NULL` and `UNIQUE(user_id, airport_iata)` (the
  derivation upsert depends on it). _Confirm exact unique key against live DB._
- **One SQLite trigger only**, written as a `BEFORE UPDATE` that assigns `NEW.enrichment_status`
  directly — **never** a nested `UPDATE` on the same table (recursive/invalid). Easiest: just set it
  in the TS write path and skip the trigger.
- **PRAGMA foreign_keys:** do not trust cascade for account deletion — delete child rows explicitly
  in a `db.batch()` (D1 FK enforcement is not guaranteed every path).
- **`lower(username)` is ASCII-only in SQLite** (unlike PG `ilike`). Use `lower()`/`COLLATE NOCASE`
  consistently for the unique index _and_ availability/search reads; accept ASCII-fold for v1.

### New auth tables

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,                 -- lowercased, trimmed
  password_hash TEXT NOT NULL,               -- pbkdf2$v1$sha256$<iter>$<salt>$<hash>  (v1 = pepper version)
  created_at TEXT NOT NULL
);
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,           -- SHA-256 of cookie token
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,                  -- ISO; sliding
  last_seen_at TEXT, user_agent TEXT, ip TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
-- No invite_codes table: registration is open.
```

### PL/pgSQL → TypeScript services (`functions/api/_services/`)

| Service                                     | Replaces                                                | Called from                                     |
| ------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------- |
| `recomputeUserStats(db,userId)`             | recalculate_user_stats (+4 stats triggers)              | after every flights/visits/country_claims write |
| `syncVisitsFromFlight(db,userId,flight,op)` | flights→visits trigger (**unversioned — extract live**) | flights write handlers                          |
| `evaluateBadges(db,userId)`                 | evaluate_badges                                         | chained after recompute                         |
| `computeAdvancedStats(db,userId)`           | refresh_advanced_stats + compute_*                      | after flights write (see decision D4)           |
| `refreshLeaderboards(db)`                   | refresh_leaderboards                                    | **Cron**, not per-write                         |
| `createUserWithProfile(...)`                | handle_new_user (**unversioned — extract live**)        | signup                                          |
| `computeFlightDuration(...)`                | fix_timezone_aware_duration                             | flights create/update                           |

> **Registration is OPEN — no invite codes** (user decision). The `invite_codes`/`beta_invites`
> table, the `check_/use_invite_code` RPCs, and the invite-check endpoint are all dropped. Signup
> takes only email + password. Per-IP/email signup rate-limiting is therefore load-bearing.

**Verified parity rules for the services (review-confirmed against the _latest_ migration defs):**

- **Leaderboards = exactly 5 categories**: `flights | distance | countries | cities | airlines`.
  There is **no `airports` category**. (Note the pre-existing quirk: the `cities` category ranks
  `airports_count`, not a city count — **preserve** for v1.)
- **Percentile = latest formula**: `ROUND((1 - rank/total)*100, 1)` with an explicit `total > 0`
  guard (the live SQL lacks the guard → divide-by-zero on empty set). Tie-break on
  **`profiles.created_at ASC`** (not user_stats).
- **Countries AND continents are counted from `visits` ONLY** — NOT `visits ∪ country_claims`. (The
  first-draft plan said UNION; that is wrong and would inflate stats + the countries leaderboard.)
- **Timezone duration** must replicate the full algorithm, not a naive diff: (a) try same-day
  arrival; (b) if `<=0` or `>1440`, retry with arrival +1 day; (c) clamp to `0 < dur <= 1440`, else
  **keep the existing** `duration_minutes`; (d) set `departure_utc` **and** `arrival_utc` from the
  chosen branch. (Port exactly from `20260212120000_fix_timezone_aware_duration.sql` + live.)
- **Badges**: `evaluate_badges` checks only the **scalar** `continents_count >= criteria.continents`.
  There is **no** per-continent `{continent, min_countries}` logic — do not add it. `beta_invite`
  criterion is effectively **always true** — preserve, do not invent a real condition.
- Eligibility for leaderboards: `total_flights >= 5 AND show_on_leaderboards = TRUE` (confirm live).
- `ground_visits` does **not** feed `recomputeUserStats` (recalc reads visits + country_claims only)
  → don't trigger a full recompute on ground-visit writes.

Shared continent/country map (~250 ISO codes) lives **once** in `packages/data` and is imported by
all services (ends the 5-way duplication). Reference data (`aircraft_reference`, `airports_reference`)
→ **D1 seed tables** (services JOIN them in SQL).

## 4. Auth design

- **Hashing:** PBKDF2-HMAC-SHA256 (WebCrypto), 16-byte salt, 210k iters, 32-byte key; password is
  HMAC'd with `AUTH_SECRET` (pepper) first. Store `pbkdf2$v1$sha256$210000$<salt>$<hash>` — **`v1`
  encodes the pepper version** so the pepper can be rotated (rehash on next login). Constant-time
  compare. Dummy-hash unknown emails; generic "invalid credentials".
- **Sessions:** opaque 32-byte token → base64url cookie; store only its **SHA-256** in `sessions`
  (D1, not KV — KV is eventually consistent → breaks instant logout). Sliding renewal (extend if
  `last_seen_at` older than 1 day). Logout/account-delete revokes by deleting session rows.
- **Cookie:** `kuuki_session; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`.
- **CSRF:** cookies reintroduce CSRF risk (GoTrue used header bearer tokens). Mitigate with an
  **`Origin`/`Sec-Fetch-Site` check + double-submit CSRF token** on all state-changing
  POST/PATCH/DELETE. (New requirement vs first draft.)
- **`/api/auth/refresh` reality:** opaque sessions have no separate refresh token, so refresh can
  only _slide an already-valid_ session — it cannot revive an expired one. The client's "on 401,
  refresh once then retry" must treat a failed refresh as logout (no infinite loop). `verify-password`
  must **not** slide/rotate the session (it's a re-auth gate before account delete).
- **Open registration:** signup takes email + password only — no invite codes (user decision).
  Mitigate abuse with per-IP + per-email rate limiting (KV counter); Turnstile is a later option.
- **Account deletion:** explicit child-row deletes in a batch (flights, visits, country_claims,
  ground_visits, user_stats, user_advanced_stats, user_badges, user_aircraft, leaderboard_cache,
  sessions) then `users` row; also best-effort purge of that user's KV import jobs.
- **Brute-force:** per-IP + per-email rate limit on signin/signup (KV counter).
- **v1 ships without email verification / password reset** (no Cloudflare email yet). Add later via
  Resend/MailChannels.
- Existing `search`/`enrich`/`import` functions: gate behind `requireAuth`, tighten CORS from `*` to
  the Pages origin + `Allow-Credentials` (they burn paid Gemini/AirLabs quota; currently public).

## 5. API endpoint surface

Auth: **pub** | **own** (session) | **pubprofile** (only if `is_public`).

- **Auth:** `POST /api/auth/signup` pub · `POST /api/auth/signin` pub · `POST /api/auth/signout` own ·
  `GET /api/auth/me` own(null) · `POST /api/auth/refresh` own · `POST /api/auth/verify-password` own ·
  `DELETE /api/auth/account` own.
- **Profiles:** `GET /api/profiles/:id` own · `PATCH /api/profiles/me` own · `GET
  /api/profiles/check-username` own · `GET /api/profiles/search` pubprofile · `GET
  /api/public/profiles/:username` pubprofile.
- **Flights:** `GET /api/flights` (filters+paging) · `/ids` · `/:id` · `POST` · `PATCH /:id` ·
  `DELETE /:id` · `POST /bulk-delete` · `POST /delete-all` (server-side, avoids D1 IN() limit) ·
  `GET /check-duplicate` · `/stats` · `/routes` · `/recent` · `/upcoming` · `/years` · `/airlines` ·
  `/aircraft` · `/all` · `POST /sync-upcoming` · `GET /durations` — all **own**.
- **Me/stats:** `GET /api/me/stats|advanced-stats|badges|rankings|dashboard-stats` own.
- **Leaderboard:** `GET /api/leaderboard?category=&limit=&offset=` pub · `GET
  /api/leaderboard/total-users` pub.
- **Badges:** `GET /api/badges` pub.
- **Passport:** `GET /api/passport/countries` · `/claims` · `PUT /claims/:cc` · `DELETE /claims/:cc`
  · `GET /claims/:cc/exists` · `GET /ground-visits?countryCode=` · `POST /ground-visits` · `DELETE
  /ground-visits/:id` · `GET /countries/:cc/stats` — all **own**.
- **Import/Search/Enrich (existing):** add **own** + owner check on job status; tighten CORS.
- **Reference:** `GET /api/reference/aircraft|airports` pub (or serve from `packages/data`).

**Public-profile DTO allowlist (security):** `/api/public/profiles/:username` and
`/api/profiles/search` MUST return an explicit column allowlist — **never `SELECT *`**.
`profiles.gemini_api_key` (and any private fields) must never leave via public endpoints. Public
rankings must respect `show_on_leaderboards`; return profile+stats with `rankings: []` when the user
has <5 flights or opted out.

## 6. Frontend refactor

1. `src/lib/apiClient.ts` (new): typed `fetch`, `credentials:'include'`, throws `ApiError`,
   on-401-refresh-once-then-logout, CSRF header. Shared request/response types in `packages/shared`.
2. Delete `src/lib/supabase.ts`; remove `@supabase/supabase-js` + `@supabase/ssr`.
3. Rewrite `lib/*` 1:1 (same exported signatures so hooks/components don't change):
   `auth.ts`, `flights.ts` (largest; move `isUpcomingFlight`/enrichment defaulting server-side),
   `profiles.ts`, `passport.ts`, `leaderboard.ts`.
4. `stores/authStore.ts`: `initialize()` → `GET /api/auth/me` (cookie bootstrap); drop
   `onAuthStateChange` + localStorage; `signUp` consumes `{user,profile}` from signup response.
5. Hooks (`useDashboardStats`, `useAdvancedStats`, `useAircraftEnrichment`, `useFlightDurations`,
   `useErrorHandler`) + `components/stats/FlightPopover.tsx`, `routes/DevResetPage.tsx`
   (→ `/api/flights/delete-all`). TanStack keys unchanged.
6. Tests: replace `src/test/mocks/supabase.ts` with MSW `/api/*` handlers; update auth/passport/
   advanced-stats/SignUpForm tests.
7. Scripts `backfill-flight-times.ts`, `enrich-existing-flights.ts` → admin maintenance via wrangler
   D1 directly (need cross-user writes; no admin REST surface in v1).
8. `functions/_middleware.ts` → custom session resolver (drop `@supabase/ssr`).

## 7. Data migration

Source: Supabase `cwmotwkvpdkfrtjxmoce`. **Needs user-granted access** (Supabase MCP OAuth, or
service-role key / `pg_dump` connection string).

**Extract-first (BLOCKING, must precede service build) — the 2 unversioned, load-bearing objects:**

1. `flights → visits` trigger fn (incl. **DELETE/UPDATE decrement** behavior — only INSERT is
   versioned). 2. `handle_new_user` (username generation, column defaults). Also dump exact DDL of
   the base tables not in migrations. Get via `pg_dump --schema-only` or
   `SELECT prosrc FROM pg_proc WHERE proname IN (...)`. (Invite RPCs no longer relevant — open registration.)

**Then data export → D1 import:** export each table; transform per type rules (bool→0/1, JSONB→TEXT,
timestamps→canonical ISO); import in FK order (`users`→`profiles`→reference→`flights`→
`visits`/`country_claims`/`ground_visits`→`user_*`); **chunk INSERTs** (D1 ~100-var / ~1MB/statement
limit). **Regenerate derived tables in D1** (run `recomputeUserStats`/`computeAdvancedStats`/
`evaluateBadges`/`refreshLeaderboards` per user) rather than importing stale aggregates — this also
validates the TS ports against real data.

**Passwords (hard blocker):** GoTrue bcrypt hashes cannot be carried into PBKDF2. **Force a password
reset for all users.** Pre-create `users` from `profiles` emails; set passwords via a one-time admin
script (no email sender in v1). Scale (owner + few invite-gated testers) makes manual reset fine.

## 7.5 Status (updated as phases land)

**Landed (branch `fix/33-image-removal`):** Phases 2, 3, 4, 6 complete. Backend `/api/*` data
layer + auth (incl. `refresh`/`verify-password`/`account`-delete) built; frontend fully migrated
off `@supabase/*` to `lib/apiClient` (same-origin cookie+CSRF). Gate green: `functions` tsc 0,
`apps/web` tsc -b 0, `vite build` OK, `vitest` 175/175. `@supabase/*` removed from code + lockfile.

**Blocked / not started:** Phase 5 (data migration — needs decisions D1/D2/D3/D5 + Supabase+CF
access; remote/deploy-like), Phase 7 (preview deploy), Phase 8 (cron + cutover).

**Carry-forwards / known gaps for the next session:**

- **Phase 1′ live extraction NOT performed** — services were ported from the migration SQL +
  generated types, not from the 2 live unversioned objects (`flights→visits` trigger incl.
  DELETE/UPDATE decrement, `handle_new_user`). Verify against live defs before/at Phase 5.
- **Compare feature regression** — `useCompareStats(otherUserId)` (`useCompare.ts`/`CompareModal.tsx`)
  now returns the _current_ user's stats: there is no per-arbitrary-user stats-by-id endpoint in §5
  (only `/api/me/stats` + `/api/public/profiles/:username`). Needs a product/endpoint decision.
- **Orphaned admin scripts** — `scripts/backfill-flight-times.ts` + `enrich-existing-flights.ts`
  still import `@supabase` (root dep removed) → `pnpm backfill:times` now errors. Rewrite as
  wrangler-D1 admin tools in Phase 5 (per §6.7; they need live D1 data anyway).
- **Cosmetic** — unused invite-code i18n keys remain in `en.json`/`ru.json`; legacy
  `SUPABASE_URL`/`SUPABASE_ANON_KEY` still in `wrangler.toml` `[vars]` + `env.d.ts` (remove at Phase 8).
- **FE adapter notes** — leaderboard/rankings consume flat snake_case (remapped in `lib/leaderboard`);
  flight DTO omits `user_id`/`aircraft_lookup_attempts` (re-attached in a mapper; no consumer reads them).

## 8. Phased execution order (corrected)

- **Phase 0 — Prep (no creds):** add `db/`, shared continent/country map + types in `packages/*`.
  Pure additions; app still builds on Supabase.
- **Phase 1 — Provision D1 (Cloudflare access):** `wrangler d1 create kuuki-db`, binding, generate
  `AUTH_SECRET`. ✅ (done early; empty + reversible)
- **Phase 1′ — LIVE EXTRACTION (Supabase access) [MOVED EARLIER]:** dump the 2 unversioned objects +
  base-table DDL. Finalize `0001_init.sql` (esp. `visits` shape) and the service specs from _real_
  definitions. Everything downstream depends on this.
- ✅ **Phase 2 — Auth backend:** `_lib/` (crypto, session, requireAuth, CSRF) + `api/auth/*` + rewrite
  `_middleware.ts` + `env.d.ts`. (refresh/verify-password/account-delete added 2026-06-20.)
- ✅ **Phase 3 — Stats services:** implement the table in §3 from the extracted defs; unit-test on local
  D1 fixtures.
- ✅ **Phase 4 — Data API:** all `/api/*` data handlers (`requireOwner`); add auth+CORS to existing
  functions.
- ⏸ **Phase 5 — Data export + import (BLOCKED — decisions D1/D2/D3/D5 + access):** `scripts/sb-to-d1.ts`;
  import local→validate→remote; backfill derived tables.
- ✅ **Phase 6 — Frontend refactor:** `apiClient`, rewrote `lib/*`/`authStore`/hooks; removed
  `@supabase/*`; tests use an apiClient vi.fn mock (MSW not needed); build + 175 tests green w/o Supabase.
- ⏸ **Phase 7 — Preview integration (deploy):** deploy preview with D1 + preview `AUTH_SECRET`; e2e (signup,
  signin, CRUD, stats recompute, leaderboard, passport, account delete, cross-user isolation, 401-refresh).
- ⏸ **Phase 8 — Cron + cutover (deploy):** create `kuuki-cron`; set prod `AUTH_SECRET`; final re-export; promote;
  force password reset; remove SUPABASE_* vars; **lock down/pause Supabase** (anon key compromised);
  decommission after soak.

## 9. Open decisions (need the user)

- **D1. Data scope:** migrate existing Supabase data, or start fresh on D1? (Determines whether
  Phase 1′/5 run.)
- **D2. Supabase access** (if migrating): MCP OAuth · service-role key · `pg_dump`/CLI.
- **D3. Passwords:** force-reset all (recommended); how many real users exist?
- **D4. Advanced stats:** wire `computeAdvancedStats` live (fresh — _changes_ current stale-prod
  behavior) vs preserve stale parity. Recommend **wire live** (data is regenerated anyway).
- **D5. Cutover/downtime:** brief read-only freeze during final export+import — acceptable window?

### Decided defaults (not asking; baked into spec above)

5 leaderboard categories · preserve `cities`=airports_count quirk · countries/continents =
visits-only · latest 1-decimal percentile + total>0 guard · no per-continent badge logic ·
`beta_invite` criterion always-true · reference data as D1 seed tables · CSRF double-submit +
Origin check · explicit cascade deletes · pepper-versioned hash format · canonical ISO timestamps.
