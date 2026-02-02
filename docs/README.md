# Kuuki Documentation

**For AI agents: Start with [DNA](./dna/) before exploring the codebase.**

## Quick Reference

| Document | Purpose | When to Read |
|----------|---------|--------------|
| **[dna/](./dna/)** | **Source of truth for all decisions** | **Always read first** |
| [PLAN.md](./PLAN.md) | Implementation roadmap and phase status | To understand current progress |
| [SPEC.md](./SPEC.md) | Original interview-derived specification | Historical reference (archival) |
| [tasks/](./tasks/) | Detailed implementation tasks per phase | When working on a specific phase |
| [plans/](./plans/) | Ad-hoc design documents | When referenced by tasks |

## DNA (Start Here)

The `dna/` folder contains LLM-optimized documentation organized for quick lookup:

| File | Purpose |
|------|---------|
| [dna/PRINCIPLES.md](./dna/PRINCIPLES.md) | Core beliefs, privacy philosophy, gamification stance |
| [dna/features.md](./dna/features.md) | Feature-specific decisions |
| [dna/boundaries.md](./dna/boundaries.md) | What we DON'T do |
| [dna/architecture.md](./dna/architecture.md) | Stack, database, data flow |
| [dna/patterns.md](./dna/patterns.md) | Code patterns, testing |
| [dna/design.md](./dna/design.md) | Design philosophy, component selection |
| [dna/infrastructure.md](./dna/infrastructure.md) | Deployment, CI/CD |

## Current Status

**🎉 MVP COMPLETE** — All 6 phases done, CI/CD deployed, ready for users.

| Phase | Status |
|-------|--------|
| Phase 0.5: Reference Data | ✅ Complete |
| Phase 1: Foundation | ✅ Complete |
| Phase 1.5: Onboarding | ✅ Complete |
| Phase 2: Core Flights | ✅ Complete |
| Phase 3: AI Import | ✅ Complete |
| Phase 3.5: UI Redesign | ✅ Complete |
| Phase 4: Social | ✅ Complete |
| Phase 4.5: Passport | ✅ Complete |
| Phase 5: Advanced Stats | ✅ Complete |
| Phase 6: Polish | ✅ Complete |

**Live:** https://kuuki.indi256.com

## Project Structure (Key Paths)

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
│   ├── pages/              # Route components
│   └── stores/             # Zustand stores
├── packages/
│   ├── shared/             # Shared code, i18n translations
│   └── data/               # Static reference data
├── functions/              # Cloudflare Workers (Gemini proxy)
├── supabase/migrations/    # Database migrations
├── .interface-design/      # Design system tokens
└── docs/                   # You are here
    └── dna/                # Source of truth
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

- Skip reading `dna/PRINCIPLES.md` before feature work
- Scan the entire repo when DNA answers the question
- Add features that violate `dna/boundaries.md`
- Ignore the design system in `dna/design.md`
