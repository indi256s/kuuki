# Historical documentation index

Archived on 2026-10-12 from [docs/README.md](../README.md). The phase table and
project tree describe the former Vite app. Skill and MCP catalogs record an old
agent environment; consult installed capabilities for current tools. Statements
about the Next app below are preserved context, not release acceptance.

## Current Status

**Current surface:** the Next app in `apps/next`. The MVP phases below describe the former Vite build.

| Phase                     | Status   |
| ------------------------- | -------- |
| Phase 0.5: Reference Data | Complete |
| Phase 1: Foundation       | Complete |
| Phase 1.5: Onboarding     | Complete |
| Phase 2: Core Flights     | Complete |
| Phase 3: AI Import        | Complete |
| Phase 3.5: UI Redesign    | Complete |
| Phase 4: Social           | Complete |
| Phase 4.5: Passport       | Complete |
| Phase 5: Advanced Stats   | Complete |
| Phase 6: Polish           | Complete |

## Project Structure

Current code is in `apps/next` (Next app and composed Worker), `functions/api` (shared API handlers), `db/migrations` (D1) and `workers/maintenance` (scheduled recovery). See the [root README](../../README.md#structure) for the current structure. The tree below records the former Vite layout and is archival.

```
kuuki/
├── apps/web/src/           # React SPA source
│   ├── components/
│   │   ├── ui/             # shadcn/ui components
│   │   ├── auth/           # Login and signup
│   │   ├── dashboard/      # Dashboard, stats cards
│   │   ├── flights/        # Flight list, forms
│   │   ├── import/         # AI import flow
│   │   ├── passport/       # Country stamps
│   │   └── social/         # Profiles, leaderboards
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities, supabase client
│   ├── routes/             # Route components
│   └── stores/             # Zustand stores
├── packages/
│   ├── shared/             # Shared code, i18n translations
│   └── data/               # Static reference data
├── functions/              # Cloudflare Workers (Gemini proxy)
├── supabase/migrations/    # Database migrations
└── docs/                   # You are here
```

## Available Tools

### Skills (Claude Code)

**Design:**

- `/frontend-design` - Creative UI (landing pages, profiles)
- `/interface-design` - App interfaces (dashboards, forms)

**Cloudflare:**

- `/cloudflare:cloudflare` - Platform overview
- `/cloudflare:wrangler` - Deployment

**Workflow:**

- [Reconcile documentation](.././skills/update-docs-after-feature/SKILL.md) - Correct affected docs after features, fixes or structural changes
- `/superpowers:brainstorming` - Before feature work
- `/superpowers:test-driven-development` - Before implementation
- `/superpowers:verification-before-completion` - Before claiming done

### MCP Servers

| Server            | Use For                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------ |
| `supabase`        | Historical schema/migration context; current data uses D1 and application ownership checks |
| `context7`        | Library docs                                                                               |
| `shadcn`          | Component registry                                                                         |
| `cloudflare-docs` | Cloudflare documentation                                                                   |

## Do Not

- Scan the entire repo when docs answer the question
- Add features that violate the PRD non-goals
- Ignore the design system in `DESIGN.md`
