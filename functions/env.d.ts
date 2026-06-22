// Generated Env interface for Cloudflare Pages Functions
// Single source of truth — replaces per-file Env declarations
// Regenerate with: npx wrangler types

interface Env {
  // Environment variables (wrangler.toml [vars] + Cloudflare dashboard secrets)
  GEMINI_API_KEY: string
  AUTH_SECRET: string // pepper/HMAC key for password hashing (set via `wrangler pages secret put`)
  PAGES_ORIGIN: string // canonical Pages origin for CORS (import/enrich); per-env override

  // KV Namespaces
  IMPORT_JOBS: KVNamespace

  // D1 Database (migration target)
  DB: D1Database
}
