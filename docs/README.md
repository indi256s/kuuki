# Kuuki Documentation

**For AI agents: Start with [DESIGN.md](../DESIGN.md) (UI), [GLOSSARY.md](../GLOSSARY.md) (domain terms) and [plans/](./plans/) before exploring the codebase.**

## Canonical Documentation

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[PRD.md](./PRD.md)** | **Product requirements, features, philosophy** | Scoping features and non-goals |
| [APP_FLOW.md](./APP_FLOW.md) | User navigation paths, screen inventory | Building UI or flows |
| [Screenshot atlas](./user-journeys/README.md) | Captured UI states, user journeys, searchable gallery and agent-readable manifest | Navigating the current UI, planning features or redesign |
| [TECH_STACK.md](./TECH_STACK.md) | Dependencies with exact versions | Installing packages |
| [DESIGN.md](../DESIGN.md) | Design System 2.0 for `apps/next` | Writing UI code |
| [FRONTEND_GUIDELINES.md](./FRONTEND_GUIDELINES.md) | Legacy Vite design guide | Changing `apps/web` only |
| [BACKEND_STRUCTURE.md](./BACKEND_STRUCTURE.md) | Database schema, RLS, API contracts | Working with data |
| [PLAN.md](./PLAN.md) | Implementation roadmap and status | Understanding progress |

## Quick Reference

| I need to... | Read this |
|--------------|-----------|
| Understand what we're building | [PRD.md](./PRD.md) |
| See user navigation flows | [APP_FLOW.md](./APP_FLOW.md) |
| Know exact package versions | [TECH_STACK.md](./TECH_STACK.md) |
| Build UI components | [DESIGN.md](../DESIGN.md) |
| Work with database | [BACKEND_STRUCTURE.md](./BACKEND_STRUCTURE.md) |
| Check project status | [PLAN.md](./PLAN.md) |

## Additional Documentation

| Document | Purpose |
|----------|---------|
| [SPEC.md](./SPEC.md) | Original interview-derived specification (archival) |
| [SITEMAP.md](./SITEMAP.md) | Route inventory |
| [tasks/](./tasks/) | Detailed implementation tasks per phase |
| [plans/](./plans/) | Ad-hoc design documents |

## Current Status

**Current surface:** the Next app in `apps/next`. `apps/web` is the legacy Vite app, kept as the rollback. The MVP phases below describe the original Vite build.

| Phase | Status |
|-------|--------|
| Phase 0.5: Reference Data | Complete |
| Phase 1: Foundation | Complete |
| Phase 1.5: Onboarding | Complete |
| Phase 2: Core Flights | Complete |
| Phase 3: AI Import | Complete |
| Phase 3.5: UI Redesign | Complete |
| Phase 4: Social | Complete |
| Phase 4.5: Passport | Complete |
| Phase 5: Advanced Stats | Complete |
| Phase 6: Polish | Complete |

**Live:** https://kuuki.indi256.com

## Project Structure

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
- `/superpowers:brainstorming` - Before feature work
- `/superpowers:test-driven-development` - Before implementation
- `/superpowers:verification-before-completion` - Before claiming done

### MCP Servers

| Server | Use For |
|--------|---------|
| `supabase` | DB schema, migrations, RLS, types |
| `context7` | Library docs |
| `shadcn` | Component registry |
| `cloudflare-docs` | Cloudflare documentation |

## Do Not

- Scan the entire repo when docs answer the question
- Add features that violate the PRD non-goals
- Ignore the design system in `DESIGN.md`
