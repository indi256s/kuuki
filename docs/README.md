# Kuuki Documentation

**For AI agents: Start with [PRD.md](./PRD.md) before exploring the codebase.**

## Canonical Documentation

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[PRD.md](./PRD.md)** | **Product requirements, features, philosophy** | **Always read first** |
| [APP_FLOW.md](./APP_FLOW.md) | User navigation paths, screen inventory | Building UI or flows |
| [TECH_STACK.md](./TECH_STACK.md) | Dependencies with exact versions | Installing packages |
| [FRONTEND_GUIDELINES.md](./FRONTEND_GUIDELINES.md) | Design system, components, patterns | Writing UI code |
| [BACKEND_STRUCTURE.md](./BACKEND_STRUCTURE.md) | Database schema, RLS, API contracts | Working with data |
| [PLAN.md](./PLAN.md) | Project status and roadmap | Understanding progress |

## Quick Reference

| I need to... | Read this |
|--------------|-----------|
| Understand what we're building | [PRD.md](./PRD.md) |
| See user navigation flows | [APP_FLOW.md](./APP_FLOW.md) |
| Know exact package versions | [TECH_STACK.md](./TECH_STACK.md) |
| Build UI components | [FRONTEND_GUIDELINES.md](./FRONTEND_GUIDELINES.md) |
| Work with database | [BACKEND_STRUCTURE.md](./BACKEND_STRUCTURE.md) |
| Check project status | [PLAN.md](./PLAN.md) |

## Additional Documentation

| Document | Purpose |
|----------|---------|
| [SITEMAP.md](./SITEMAP.md) | Route inventory |
| [I18N_GUIDE.md](./I18N_GUIDE.md) | Internationalization and pluralization rules |
| [LIGHTHOUSE-CHECKLIST.md](./LIGHTHOUSE-CHECKLIST.md) | Performance audit targets |

## Current Status

**OPEN BETA** — MVP complete, polishing for public launch.

**Live:** https://kuuki.indi256.com

See [PLAN.md](./PLAN.md) for full roadmap and remaining beta polish items.

## Project Structure

```
kuuki/
├── apps/web/src/           # React SPA source
│   ├── components/
│   │   ├── ui/             # shadcn/ui components
│   │   ├── auth/           # Login, signup, invite
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

- Skip reading `PRD.md` before feature work
- Scan the entire repo when docs answer the question
- Add features that violate the PRD non-goals
- Ignore the design system in `FRONTEND_GUIDELINES.md`
