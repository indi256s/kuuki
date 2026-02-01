# Kuuki Documentation

**For AI agents: Start here before exploring the codebase.**

## Quick Reference

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [SPEC.md](./SPEC.md) | Product requirements, tech stack, data models, UI/UX specs | Before any implementation work |
| [PLAN.md](./PLAN.md) | High-level phases, status, available tools | To understand current progress and next steps |
| [tasks/](./tasks/) | Detailed implementation tasks per phase | When working on a specific phase |
| [plans/](./plans/) | Ad-hoc design documents | When referenced by tasks |

## Current Status

**Phase 1 (Foundation):** ✅ Complete - auth, i18n, testing, Cloudflare Pages live.

**Phase 1.5 (Onboarding):** ✅ Complete - landing page, showcase modal, username picker, empty states.

**Phase 2 (Core Flights):** ✅ Complete - flight CRUD, dashboard with stats, route map, autocomplete.

**Next:** Phase 3 (AI Import) - Gemini proxy, upload UI, import review.

## Project Structure (Key Paths)

```
kuuki/
├── apps/web/src/           # React SPA source
│   ├── components/
│   │   ├── auth/           # SignInForm, SignUpForm
│   │   ├── dashboard/      # StatsCards, RecentFlights, EmptyState
│   │   ├── flights/        # FlightForm, FlightList, FlightCard, FlightTable, Autocompletes
│   │   ├── landing/        # HeroSection, FeatureGrid
│   │   ├── map/            # RouteMap (SVG visualization)
│   │   └── onboarding/     # ShowcaseModal, UsernamePicker, ImportCTA
│   ├── hooks/              # useAuth, useLanguage, useShowcase, useFlights, useStats
│   ├── lib/                # supabase, auth, i18n, sampleData, flights, geo
│   ├── routes/             # LandingPage, AuthPage, OnboardingPage, DashboardPage, FlightsPage
│   └── stores/             # Zustand stores (authStore)
├── packages/
│   ├── shared/             # Shared code, i18n translations
│   └── data/               # Static reference data (aircraft, airports, airlines)
├── functions/              # Cloudflare Workers
├── supabase/migrations/    # Database migrations
└── docs/                   # You are here
```

## Available Tools

### Skills (Claude Code)

**Design:**
- `/frontend-design` - Creative UI (landing pages, profiles, visualizations)
- `/interface-design` - App interfaces (dashboards, forms, data tables)
- `/playground` - Interactive HTML prototypes

**Cloudflare:**
- `/cloudflare:cloudflare` - Platform overview (Workers, Pages, storage, AI)
- `/cloudflare:wrangler` - Deployment and management
- `/cloudflare:web-perf` - Core Web Vitals auditing

**Workflow:**
- `/superpowers:brainstorming` - Before feature work
- `/superpowers:test-driven-development` - Before implementation
- `/superpowers:verification-before-completion` - Before claiming done

### MCP Servers

| Server | Use For |
|--------|---------|
| `supabase` | DB schema, migrations, RLS, edge functions, TypeScript types |
| `context7` | Library docs (Mapbox, react-map-gl, Gemini SDK) |
| `playwright` | E2E tests, visual regression |
| `cloudflare-docs` | Cloudflare documentation |

## Do Not

- Scan the entire repo when docs answer the question
- Skip reading SPEC.md before implementing features
- Implement without checking current phase status in PLAN.md
