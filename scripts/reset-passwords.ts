#!/usr/bin/env npx tsx
/**
 * Phase 5 — one-time LOCAL password (re)hash.
 *
 * The Supabase → D1 import creates the 26 `users` rows with
 *   password_hash = 'RESET_REQUIRED'
 * because Supabase's auth.users password hashes (bcrypt, internal) are NOT in
 * the snapshot and cannot be exported. 'RESET_REQUIRED' is a *structurally*
 * invalid hash: verifyPassword() (functions/api/_lib/crypto.ts) splits on '$'
 * and bails unless there are exactly 6 parts with parts[0]==='pbkdf2'. So
 * 'RESET_REQUIRED' (zero '$') can never authenticate — by design those accounts
 * are unloginnable until this script runs.
 *
 * What this does (LOCAL D1 ONLY): for every user whose password_hash is still
 * the 'RESET_REQUIRED' sentinel, replace it with a real PBKDF2 hash of a single
 * shared, known LOCAL-dev temp password so the migrated accounts can be exercised
 * against `wrangler pages dev` during Phase 5 verification.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * LOCAL TEMP PASSWORD (LOCAL DEV ONLY — never production):
 *
 *     kuuki-local-dev-2026
 *
 * Every migrated user shares this password locally. It exists purely so the
 * local pages-dev smoke test can sign in. It is NEVER used remotely — remote
 * accounts retain their real (un-migratable) Supabase credentials and would do
 * a proper password reset out of band.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Hashing uses the SAME AUTH_SECRET as pages dev (read from .dev.vars below),
 * because the pepper step HMAC-SHA256(AUTH_SECRET, password) couples every hash
 * to that secret. A hash made with a different secret would silently fail
 * verifyPassword() at sign-in time.
 *
 * IDEMPOTENT: only rows with password_hash='RESET_REQUIRED' are touched. Running
 * twice is a no-op on the second pass (already-hashed rows are skipped).
 *
 * Usage (do NOT run as part of typecheck/author step):
 *   npx tsx scripts/reset-passwords.ts
 *
 * After running, smoke-test against local pages dev (see SMOKE command printed
 * at the end, and documented in the trailing block comment).
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { getPlatformProxy } from 'wrangler'

// NEVER re-implement hashing — import the exact functions pages dev uses.
import { hashPassword, verifyPassword } from '../functions/api/_lib/crypto'

const SENTINEL = 'RESET_REQUIRED'

/** Shared LOCAL-dev temp password applied to every migrated account. */
const TEMP_PASSWORD = 'kuuki-local-dev-2026'

// Repo root = parent of this scripts/ directory. All paths are derived from
// the script location so cwd doesn't matter.
const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPTS_DIR, '..')
const DEV_VARS_PATH = resolve(REPO_ROOT, '.dev.vars')
const WRANGLER_CONFIG = resolve(REPO_ROOT, 'wrangler.toml')

/**
 * Read AUTH_SECRET from .dev.vars (dotenv-style KEY=VALUE). We parse it
 * ourselves rather than rely on getPlatformProxy's default env discovery,
 * because .dev.vars is not one of its default `.env*` files — and we must use
 * the SAME secret pages dev uses, not a freshly generated one.
 */
function readAuthSecretFromDevVars(): string {
  let raw: string
  try {
    raw = readFileSync(DEV_VARS_PATH, 'utf8')
  } catch (err) {
    throw new Error(`FATAL: could not read ${DEV_VARS_PATH}: ${(err as Error).message}`)
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (key !== 'AUTH_SECRET') continue
    // Strip optional surrounding quotes; AUTH_SECRET is base64 so no spaces.
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!value) throw new Error('FATAL: AUTH_SECRET in .dev.vars is empty')
    return value
  }
  throw new Error(`FATAL: AUTH_SECRET not found in ${DEV_VARS_PATH}`)
}

interface UserRow {
  id: string
  email: string
  password_hash: string
}

async function main(): Promise<void> {
  const authSecret = readAuthSecretFromDevVars()
  console.log(`AUTH_SECRET loaded from .dev.vars (${authSecret.length} chars).`)

  // Point at the SAME persisted LOCAL D1 the import/derive/validate scripts use.
  // getPlatformProxy does NOT append /v3 to persist.path (unlike the CLI's
  // --persist-to), so the path must be the full `.wrangler/state/v3`.
  const proxy = await getPlatformProxy<{ DB: D1Database }>({
    configPath: WRANGLER_CONFIG,
    persist: { path: resolve(REPO_ROOT, '.wrangler/state/v3') },
  })
  const db = proxy.env.DB

  try {
    // 1. Find every account still on the sentinel.
    const { results } = await db
      .prepare('SELECT id, email, password_hash FROM users WHERE password_hash = ?')
      .bind(SENTINEL)
      .all<UserRow>()
    const pending = results ?? []

    const totalUsers =
      (await db.prepare('SELECT COUNT(*) AS n FROM users').first<{ n: number }>())?.n ?? 0
    console.log(`users total=${totalUsers}; with ${SENTINEL} sentinel=${pending.length}`)

    if (pending.length === 0) {
      console.log('Nothing to do — no RESET_REQUIRED rows (already hashed or empty DB).')
      return
    }

    // 2. Hash the shared temp password once PER USER (fresh random salt each
    //    time, so identical plaintext → distinct stored hashes). UPDATE only
    //    rows still on the sentinel (idempotent guard in the WHERE clause).
    let updated = 0
    let sampleStored: string | null = null
    for (const u of pending) {
      const stored = await hashPassword(TEMP_PASSWORD, authSecret)
      const res = await db
        .prepare('UPDATE users SET password_hash = ? WHERE id = ? AND password_hash = ?')
        .bind(stored, u.id, SENTINEL)
        .run()
      const changed = res.meta?.changes ?? 0
      if (changed !== 1) {
        throw new Error(
          `FATAL: UPDATE for user ${u.id} (${u.email}) changed ${changed} rows, expected 1`,
        )
      }
      updated += 1
      if (sampleStored === null) sampleStored = stored
    }
    console.log(`Updated ${updated}/${pending.length} password hashes.`)

    // 3. Round-trip assertion (FAIL LOUD): the stored hash must verify with the
    //    same AUTH_SECRET and have exactly 6 '$'-delimited parts.
    if (sampleStored === null) throw new Error('FATAL: no sample hash captured')
    const parts = sampleStored.split('$')
    if (parts.length !== 6) {
      throw new Error(`FATAL: stored hash has ${parts.length} parts, expected 6: ${sampleStored}`)
    }
    if (parts[0] !== 'pbkdf2' || parts[1] !== 'v1' || parts[2] !== 'sha256' || parts[3] !== '100000') {
      throw new Error(`FATAL: stored hash header malformed: ${parts.slice(0, 4).join('$')}`)
    }
    const ok = await verifyPassword(TEMP_PASSWORD, sampleStored, authSecret)
    if (!ok) throw new Error('FATAL: verifyPassword(TEMP_PASSWORD, stored, AUTH_SECRET) returned false')
    // Negative control: the sentinel itself must still be structurally unhashable.
    const sentinelVerifies = await verifyPassword(TEMP_PASSWORD, SENTINEL, authSecret)
    if (sentinelVerifies) throw new Error('FATAL: sentinel RESET_REQUIRED unexpectedly verified')
    console.log('Round-trip OK: 6 parts, verifyPassword=true, sentinel verify=false.')

    // 4. Confirm no sentinel rows remain.
    const remaining =
      (await db
        .prepare('SELECT COUNT(*) AS n FROM users WHERE password_hash = ?')
        .bind(SENTINEL)
        .first<{ n: number }>())?.n ?? 0
    if (remaining !== 0) throw new Error(`FATAL: ${remaining} RESET_REQUIRED rows still remain`)
    console.log('All RESET_REQUIRED sentinels replaced.')

    // 5. Print the smoke-test command (does NOT run anything).
    const sampleEmail = pending[0].email
    console.log('\n── LOCAL pages-dev smoke test (run manually) ──')
    console.log('# Terminal 1 — start local pages dev against the SAME persisted D1:')
    console.log('npx wrangler pages dev --persist-to .wrangler/state --port 8788')
    console.log(
      '#   ^ binds D1/KV/vars from wrangler.toml (binding DB -> database_id UUID).',
    )
    console.log(
      '#     Do NOT add --d1=DB=kuuki-db/--kv=IMPORT_JOBS: those override flags key the',
    )
    console.log(
      '#     local store by the literal name (a DIFFERENT hash than the config UUID), so',
    )
    console.log(
      '#     pages dev opens an EMPTY db and signin 500s with "no such table: users".',
    )
    console.log('\n# Terminal 2 — bootstrap (expect {"user":null,...} before sign-in):')
    console.log('curl -s -c cookies.txt http://localhost:8788/api/auth/me')
    console.log('\n# Sign in (Origin header satisfies requireSameOrigin):')
    console.log(
      `curl -s -c cookies.txt -H 'Content-Type: application/json' -H 'Origin: http://localhost:8788' \\\n` +
        `  -d '{"email":"${sampleEmail}","password":"${TEMP_PASSWORD}"}' \\\n` +
        `  http://localhost:8788/api/auth/signin`,
    )
    console.log('\n# Authenticated bootstrap (expect the user object now):')
    console.log('curl -s -b cookies.txt http://localhost:8788/api/auth/me')
  } finally {
    await proxy.dispose()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

/*
 * ── LOCAL pages-dev smoke command (reference, verified 2026-06-21) ──────────
 * Start local pages dev bound to the SAME persisted LOCAL D1 (.wrangler/state):
 *
 *   npx wrangler pages dev --persist-to .wrangler/state --port 8788
 *
 *   # Bindings come from wrangler.toml (binding DB -> database_id UUID). Do NOT
 *   # pass --d1=DB=kuuki-db or --kv=IMPORT_JOBS: those override flags key the local
 *   # store by the literal name (a DIFFERENT hash than the config UUID), so pages
 *   # dev opens an EMPTY db and signin 500s with "no such table: users".
 *
 * Then, with AUTH_SECRET coming from .dev.vars (pages dev loads it automatically):
 *
 *   # GET /api/auth/me (unauthenticated) → { "user": null, "profile": null }
 *   curl -s -c cookies.txt http://localhost:8788/api/auth/me
 *
 *   # POST /api/auth/signin (Origin required by requireSameOrigin)
 *   curl -s -c cookies.txt \
 *     -H 'Content-Type: application/json' -H 'Origin: http://localhost:8788' \
 *     -d '{"email":"<any migrated email>","password":"kuuki-local-dev-2026"}' \
 *     http://localhost:8788/api/auth/signin
 *
 *   # GET /api/auth/me (authenticated) → { "user": { id, email }, "profile": {...} }
 *   curl -s -b cookies.txt http://localhost:8788/api/auth/me
 */
