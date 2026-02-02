# Kuuki DNA: Infrastructure

> Deployment, CI/CD, and operational concerns.
> For architecture decisions, see architecture.md.

---

## Environments

| Environment | URL | Branch | Purpose |
|-------------|-----|--------|---------|
| Production | kuuki.indi256.com | `main` | Live users |
| Staging | kuuki-staging.pages.dev | PR branches | Preview deployments |
| Local | localhost:5173 | any | Development |

**Note:** Single Supabase project for both staging and production. Acceptable for personal project scale. Future: Separate staging DB if needed.

---

## Hosting: Cloudflare Pages

### Why Cloudflare Pages

- Edge-deployed globally
- Free tier generous for hobby projects
- Git integration for auto-deploys
- Preview deployments for PRs
- Same platform as Workers (Gemini proxy)

### Build Configuration

```toml
# wrangler.toml (if using)
name = "kuuki"
compatibility_date = "2024-01-01"

[site]
bucket = "./apps/web/dist"
```

### Build Command

```bash
pnpm build
```

### Output Directory

```
apps/web/dist
```

### Environment Variables

Set in Cloudflare Pages dashboard:

| Variable | Environment | Notes |
|----------|-------------|-------|
| `VITE_SUPABASE_URL` | All | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | All | Supabase anon key (safe for client) |
| `VITE_MAPBOX_TOKEN` | All | Mapbox public token |

**Secrets (Workers only):**

| Variable | Notes |
|----------|-------|
| `GEMINI_API_KEY` | Server-side only, never exposed |

---

## CI/CD: GitHub Actions

### Pipeline Overview

```
PR opened/updated
    │
    ├─► Lint (parallel)
    ├─► Typecheck (parallel)
    ├─► Test (parallel, non-blocking)
    └─► Build (parallel)
    │
    ▼
All pass? → Deploy preview to staging
    │
    ▼
PR merged to main
    │
    ▼
Deploy to production
    │
    ▼
Failure? → Auto-revert + Telegram alert
```

### Workflow File

Location: `.github/workflows/ci.yml`

### Jobs

| Job | Blocking | Purpose |
|-----|----------|---------|
| `lint` | Yes | ESLint checks |
| `typecheck` | Yes | TypeScript compilation |
| `test` | No | Vitest (continue-on-error) |
| `build` | Yes | Production build succeeds |
| `deploy-preview` | — | Staging for PRs |
| `deploy-production` | — | Production on main merge |

### Non-Blocking Tests

Tests use `continue-on-error: true`. Rationale:
- Don't block deploys for flaky tests
- Tests are informational, not gatekeepers
- Personal project, acceptable risk

### Auto-Revert

If production deploy fails:
1. Revert commit is created automatically
2. Telegram notification sent
3. Previous working version restored

### AI Agent PRs

PRs created by AI agents (Claude, Copilot) require `ci:approved` label before merge. Prevents accidental merge of unreviewed AI code.

---

## Cloudflare Workers

### Gemini Proxy Worker

Location: `functions/api/parse.ts`

**Purpose:** Proxy Gemini API calls to hide API key from client.

**Endpoint:** `POST /api/parse`

**Request:**
```json
{
  "type": "pdf" | "image" | "text",
  "content": "base64 or text"
}
```

**Response:**
```json
{
  "flights": [
    {
      "date": "2024-01-15",
      "origin": "JFK",
      "destination": "LHR",
      "airline_iata": "BA",
      "confidence": 0.95
    }
  ]
}
```

### Worker Deployment

Workers deploy with Pages. No separate deployment needed.

---

## Supabase

### Project Info

| Item | Value |
|------|-------|
| Region | (your region) |
| Plan | Free tier |
| Database | PostgreSQL 15 |

### Key Features Used

- **Auth:** Email/password with 30-day sessions
- **Database:** PostgreSQL with RLS
- **Triggers:** Stats computation, badge evaluation
- **Storage:** Not used (no file uploads stored)
- **Edge Functions:** Not used (using CF Workers instead)

### Migrations

Location: `supabase/migrations/`

**Creating migrations:**
```bash
supabase migration new <name>
```

**Applying migrations:**
```bash
supabase db push
```

### RLS Policies

All tables have RLS enabled. See architecture.md for policy details.

### Backups

Free tier: Daily backups, 7-day retention.

**Manual backup:**
```bash
supabase db dump > backup.sql
```

---

## Domain & DNS

### Domain

`kuuki.indi256.com` — subdomain of personal domain

### DNS Configuration

Managed via Cloudflare DNS (same account as Pages).

| Record | Type | Value |
|--------|------|-------|
| kuuki | CNAME | kuuki.pages.dev |

### SSL

Automatic via Cloudflare. No manual certificate management.

---

## Monitoring

### Current State (MVP)

| What | How |
|------|-----|
| Errors | Console logging, manual review |
| Uptime | Cloudflare analytics |
| Performance | Cloudflare analytics |
| Database | Supabase dashboard |

### Future (Post-MVP)

| What | Tool |
|------|------|
| Error tracking | Sentry |
| Uptime monitoring | Better Uptime or similar |
| Performance | Lighthouse CI |

---

## Local Development

### Prerequisites

- Node.js 18+
- pnpm
- Supabase CLI (optional, for migrations)

### Setup

```bash
cd ~/kuuki
pnpm install
cp apps/web/.env.example apps/web/.env.local
# Fill in environment variables
pnpm dev
```

### Environment Variables (Local)

Create `apps/web/.env.local`:

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
VITE_MAPBOX_TOKEN=xxx
```

### Common Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm test         # Run tests
pnpm lint         # ESLint
pnpm typecheck    # TypeScript check
```

### Testing Workers Locally

```bash
cd functions
wrangler dev
```

---

## Secrets Management

### Client-Side (Safe to Expose)

- Supabase URL
- Supabase anon key
- Mapbox public token

These are in `.env` files and bundled into the client. They're designed to be public.

### Server-Side (Never Expose)

- Gemini API key
- Supabase service role key (if used)

These live in Cloudflare Workers secrets:

```bash
wrangler secret put GEMINI_API_KEY
```

### Git Ignored

```
.env.local
.env.*.local
```

Never commit secrets. Use environment variables.

---

## Scaling Considerations

### Current Limits (50-500 Users)

Everything works fine at this scale:
- Single Supabase project
- Free tier Cloudflare
- Trigger-based stats (acceptable write overhead)

### If Scale Grows (1000+ Users)

Consider:
- Separate staging Supabase project
- Upgrade Supabase plan for more connections
- Add Redis/KV caching for leaderboards
- Move stats to async queue processing

### Not Planned

These are explicitly not on the roadmap:
- Multi-region deployment
- CDN for static assets (Cloudflare handles this)
- Container orchestration
- Microservices

---

## Incident Response

### If Production Breaks

1. **Check Cloudflare dashboard** for deploy status
2. **Check Supabase dashboard** for database issues
3. **Check GitHub Actions** for failed deploys
4. If recent deploy broke it, auto-revert should have triggered
5. If not, manually revert: `git revert HEAD && git push`

### If Gemini API Breaks

1. Check Gemini status page
2. Worker will return error to client
3. Users can still add flights manually
4. No data loss

### If Supabase Breaks

1. Check Supabase status page
2. App will show error states
3. No user action possible until restored
4. Data is safe (Supabase handles durability)

---

## Quick Reference

### URLs

| What | URL |
|------|-----|
| Production | https://kuuki.indi256.com |
| Staging | https://kuuki-staging.pages.dev |
| Supabase | https://supabase.com/dashboard |
| Cloudflare | https://dash.cloudflare.com |
| GitHub | https://github.com/xxx/kuuki |

### Commands

| Task | Command |
|------|---------|
| Local dev | `pnpm dev` |
| Build | `pnpm build` |
| Test | `pnpm test` |
| Deploy | Push to `main` |
| DB migration | `supabase db push` |
