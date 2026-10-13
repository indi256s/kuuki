// Generated Env interface for Cloudflare Pages Functions
// Single source of truth — replaces per-file Env declarations
// Regenerate with: npx wrangler types

interface Env {
  // Environment variables (wrangler.toml [vars] + Cloudflare dashboard secrets)
  GEMINI_API_KEY: string
  GEMINI_IMPORT_MODEL?: string // non-secret override; defaults to gemini-3.5-flash-lite
  ENRICH_PROVIDER?: string // gemini (default) or anthropic; server-selected
  ANTHROPIC_API_KEY?: string
  ANTHROPIC_WORKSPACE_ID?: string
  ANTHROPIC_ENRICH_MODEL?: string // defaults to claude-haiku-5-5
  GEMINI_ENRICH_MODEL?: string // non-secret override; defaults to gemini-3.5-flash-lite
  BETTER_AUTH_SECRET: string // independent signing/encryption secret, at least 32 characters
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  AUTH_SECRET: string // pepper/HMAC key for password hashing (set via `wrangler pages secret put`)
  PAGES_ORIGIN: string // canonical Pages origin for CORS (import/enrich); per-env override
  MAINTENANCE_MODE?: string // 'true' blocks API access before any session/database work
  ACTIVATION_MAIL?: SendEmail // native Cloudflare Email Sending binding
  ACTIVATION_MAIL_ACCOUNT_ID?: string // Cloudflare account ID for Email Sending
  ACTIVATION_MAIL_AUTH_TOKEN?: string // Cloudflare API token with Email Sending permission
  ACTIVATION_MAIL_FROM?: string // verified Email Sending sender address
  ACTIVATION_ORIGIN?: string // dedicated HTTPS Pages alias for the token-only page

  // D1 Database (migration target)
  IMPORT_JOBS?: DurableObjectNamespace
  AI?: Ai
  DB: D1Database
}
