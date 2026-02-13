// Generated Env interface for Cloudflare Pages Functions
// Single source of truth — replaces per-file Env declarations
// Regenerate with: npx wrangler types

interface Env {
  // Environment variables (wrangler.toml [vars] + Cloudflare dashboard secrets)
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  GEMINI_API_KEY: string
  AIRLABS_API_KEY: string

  // KV Namespaces
  IMPORT_JOBS: KVNamespace
}
