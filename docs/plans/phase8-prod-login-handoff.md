# Handoff — Production login fails ("invalid password") → root cause: prod DB empty, Phase 8 not run

Historical investigation. The account counts and missing activation flow below
describe that investigation, not the current deployment. See the current
[remediation status](../runbooks/audit-remediation-status.md) before acting.

Generated 2026-06-23. Triggered by a user report: *"trying to log in with old creds, getting
invalid password errors"* on **production**. Investigated with systematic-debugging. **No code or
data was changed. Production `kuuki-db` was read-only inspected, never written.**

## 1. Diagnosis — CONFIRMED, and it is by-design (not a bug)

The "invalid password" 401 on production is **anti-enumeration masking "account does not exist."**
The production database has **never been seeded** — that is Phase 8 work, which is explicitly
**NOT authorized** (see `phase5-to-phase7-handoff.md` §6).

Evidence (live query of remote `kuuki-db`, id `2a8e3895-6a98-4473-8d7b-a43ca0c0026f`, the only
`kuuki-db` in the account; it's the id `wrangler.toml` binds `DB` to):
- Full 18-table schema **exists**, but **every table is empty**: users 0, profiles 0, flights 0,
  airports_reference 0, badge_definitions 0, `d1_migrations` 0.
- Local D1 (`.wrangler/state/v3/d1`) by contrast holds all 26 users + reference data — the
  Phase 5 import only ever ran LOCAL, exactly as the prior handoff states.

Why the symptom looks like a password problem (mechanism, verified in code):
- `signin` calls `getUserByEmail` → returns `null` (no row) → runs `dummyVerify` to equalize
  timing → throws the **same** `401 "Invalid email or password"` it uses for a real wrong
  password. See `functions/api/auth/signin.ts:28-36` and `dummyVerify` in
  `functions/api/_lib/crypto.ts`. So **no** password (old Supabase or otherwise) can ever succeed
  against prod right now — there are no user rows to match.

The earlier-suspected angles are real but **moot** given the empty table:
- PBKDF2 210k→100k Workers cap (already fixed, `git e261cf5`) — irrelevant with 0 rows.
- "Supabase bcrypt hashes weren't migratable" → users import as `RESET_REQUIRED` sentinel
  (unloginnable by design) — also irrelevant until rows exist.

## 2. What "fixing" it actually means = run Phase 8 (DEPLOY-GATED, needs explicit user OK)

Do **not** start without explicit authorization — this is a production data write. The full Phase 8
checklist already lives in `phase5-to-phase7-handoff.md` §6; do not duplicate it. The login-relevant
slice, in order:

1. Final re-export + promote the migrated dataset to **remote** `kuuki-db` (the Phase 5 pipeline,
   build order in `phase5-to-phase7-handoff.md` §2, but targeting `--remote` not `--local`).
2. **Landmine — `d1_migrations` is empty while tables already exist.** A naive
   `wrangler d1 migrations apply --remote` will try to re-create existing tables and fail with
   "table already exists." The remote schema was loaded outside the migration tracker. Decide:
   seed data only (tables already present), or rebuild the remote DB cleanly first. Cross-check the
   `migrations_dir` gotcha already captured in memory/handoff before running anything.
3. Re-hash production at the **100k** PBKDF2 cap (the `e261cf5` fix is mandatory for prod signin too).
4. Set production `AUTH_SECRET` (the pepper). Hashes are coupled to it — if it differs from whatever
   secret a hash was made with, every verify silently fails. Confirm one canonical prod secret.

## 3. Second, SEPARATE gap — no password-reset flow exists at all

Even after users are seeded, prod rows land as `RESET_REQUIRED` (unloginnable by design), and there
is **no reset/forgot-password endpoint anywhere** — `functions/api/auth/` has only signin, signup,
signout, refresh, me, account, verify-password (grep for `reset.?password|forgot|recover` = no hits).
So production logins need **either** a real password-reset flow built **or** hashes set out-of-band
(e.g. a prod-equivalent of `scripts/reset-passwords.ts` issuing per-user temp passwords + forced
rotation). This is design work, not a one-liner. Fold it into the Phase 8 decision or scope it
separately.

## 4. Interim answer for the user (no prod change)
- **Local dev** works today: `wrangler pages dev --persist-to .wrangler/state`, sign in with any
  migrated email + temp password `kuuki-local-dev-2026` (see `scripts/reset-passwords.ts`).
- **Production** cannot accept any login until Phase 8 seeds it — expected, not broken.

## 5. Memory correction needed
The `kuuki-phase5-migration-done` memory implies the migration is "DONE." It is done **for LOCAL +
preview only**; **production `kuuki-db` is empty and unseeded.** Consider amending that memory so a
future session doesn't assume prod is live.

## Suggested skills for the next session
- `superpowers:writing-plans` — turn the Phase 8 slice above into a reviewable step plan before any execution.
- `llm-council` — pressure-test the Phase 8 prod-seed + reset-flow plan before touching remote `kuuki-db` (per user workflow: review plans with the council first).
- `cloudflare` / `wrangler` (project skills under `kuuki/.claude/skills`) — correct `--remote` D1 + migrations syntax; mind the `d1_migrations`/already-exists landmine.
- `superpowers:systematic-debugging` — already applied; root cause section above is its output.

## Guardrails (still in force, from prior handoff §7)
Commit don't deploy; never write to remote `kuuki-db` or push/PR without explicit user request;
`db/_snapshot/` + `.dev.vars` stay gitignored (emails / secrets). No secrets or user emails are
reproduced in this doc.
