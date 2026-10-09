# Cloudflare Pages Setup for Kuuki

**Date:** 2026-01-31
**Status:** Completed (2026-01-31)

## Overview

Deploy the Kuuki React SPA to Cloudflare Pages with GitHub integration and custom domain.

## Configuration

### Pages Project Settings

| Setting           | Value                                            |
| ----------------- | ------------------------------------------------ |
| Project name      | `kuuki`                                          |
| Production branch | `main`                                           |
| Root directory    | `/`                                              |
| Build command     | `pnpm install && pnpm --filter @kuuki/web build` |
| Output directory  | `apps/web/dist`                                  |

### Environment Variables

| Variable                 | Value                     | Notes             |
| ------------------------ | ------------------------- | ----------------- |
| `NODE_VERSION`           | `20`                      | Required for pnpm |
| `VITE_SUPABASE_URL`      | (from Supabase dashboard) | Public            |
| `VITE_SUPABASE_ANON_KEY` | (from Supabase dashboard) | Public anon key   |

### Custom Domain

- Domain: `kuuki.indi256.com`
- DNS: Auto-configured CNAME to `kuuki.pages.dev`
- SSL: Automatic

## SPA Routing

React Router requires server-side fallback to index.html.

**File:** `apps/web/public/_redirects`

```
/*    /index.html   200
```

## Security Headers

**File:** `apps/web/public/_headers`

```
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
```

## Implementation Steps

### Step 1: Add SPA files

- Create `apps/web/public/_redirects`
- Create `apps/web/public/_headers`

### Step 2: Verify build

```bash
pnpm install && pnpm --filter @kuuki/web build
```

### Step 3: Create Cloudflare Pages project

1. Cloudflare Dashboard → Pages → Create project
2. Connect GitHub repo `indi256s/kuuki`
3. Apply build settings from this doc
4. Add environment variables

### Step 4: Add custom domain

1. Pages project → Custom domains
2. Add `kuuki.indi256.com`

### Step 5: Test deployment

- Push commit to trigger deploy
- Verify `kuuki.indi256.com` loads
- Test direct URL `/auth` works (SPA routing)

## Preview Deployments

Every PR automatically gets a preview URL: `<branch>.kuuki.pages.dev`
