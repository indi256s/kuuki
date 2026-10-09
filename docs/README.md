# Kuuki Documentation

**For AI agents: Start with [DESIGN.md](../DESIGN.md) (UI), [GLOSSARY.md](../GLOSSARY.md) (domain terms) and [plans/](./plans/) before exploring the codebase.**

## Canonical Documentation

| Document                                                                    | Purpose                                                                                               | When to Read                                                                |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| **[PRD.md](./PRD.md)**                                                      | **Product requirements, features, philosophy**                                                        | Scoping features and non-goals                                              |
| [APP_FLOW.md](./APP_FLOW.md)                                                | User navigation paths, screen inventory                                                               | Building UI or flows                                                        |
| [Screenshot atlas](./user-journeys/README.md)                               | Historical 2026-10-03 UI states, journeys and searchable manifest; Redesign 2.0 recapture is deferred | Studying prior UI evidence; use the redesign handoff for current acceptance |
| [App manifest](../apps/next/package.json) and [lockfile](../pnpm-lock.yaml) | Current dependency ranges and resolved versions                                                       | Installing packages                                                         |
| [Deploy Kuuki](./skills/deploy-kuuki/SKILL.md)                              | Current Worker release and rollback procedure                                                         | Runtime or release work                                                     |
| [Next release candidate](./runbooks/2026-10-04-next-release-candidate.md)   | Historical candidate verification and acceptance evidence                                             | Reviewing the 4 October migration                                           |
| [TECH_STACK.md](./TECH_STACK.md)                                            | Former Vite stack and runtime context                                                                 | Historical research                                                         |
| [DESIGN.md](../DESIGN.md)                                                   | Design System 2.0 for `apps/next`                                                                     | Writing UI code                                                             |
| [FRONTEND_GUIDELINES.md](./FRONTEND_GUIDELINES.md)                          | Former Vite design guide                                                                              | Historical research                                                         |
| [D1 migrations](../db/migrations/) and [API handlers](../functions/api/)    | Current schema and API implementation                                                                 | Working with data                                                           |
| [BACKEND_STRUCTURE.md](./BACKEND_STRUCTURE.md)                              | Historical Supabase schema, RLS and API context                                                       | Source migration research                                                   |
| [PLAN.md](./PLAN.md)                                                        | Original MVP roadmap and status                                                                       | Historical context                                                          |

## Quick Reference

| I need to...                                            | Read this                                                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Understand what we're building                          | [PRD.md](./PRD.md)                                                                                        |
| See user navigation flows                               | [APP_FLOW.md](./APP_FLOW.md)                                                                              |
| Know exact package versions                             | [pnpm-lock.yaml](../pnpm-lock.yaml)                                                                       |
| Build UI components                                     | [DESIGN.md](../DESIGN.md)                                                                                 |
| Work with database                                      | [D1 migrations](../db/migrations/) and [migration release gates](./runbooks/audit-remediation-release.md) |
| Check current release procedure                         | [Deploy Kuuki](./skills/deploy-kuuki/SKILL.md)                                                            |
| Check the merged redesign and deferred release evidence | [Redesign handoff](./plans/2026-10-04-redesign-2.0-implementation-handoff.md)                             |

## Additional Documentation

| Document                                                                        | Purpose                                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [SPEC.md](./SPEC.md)                                                            | Original interview-derived specification (archival)                       |
| [SITEMAP.md](./SITEMAP.md)                                                      | Route inventory                                                           |
| [tasks/](./tasks/)                                                              | Historical MVP implementation tasks per phase                             |
| [plans/](./plans/)                                                              | Ad-hoc design documents                                                   |
| [Flight enrichment sources](./research/2026-10-07-flight-enrichment-sources.md) | Historical aircraft sources, storage limits and local Gemini source audit |

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

Current code is in `apps/next` (Next app and composed Worker), `functions/api` (shared API handlers), `db/migrations` (D1) and `workers/maintenance` (scheduled recovery). See the [root README](../README.md#structure) for the current structure. The tree below records the former Vite layout and is archival.

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

- [Reconcile documentation](./skills/update-docs-after-feature/SKILL.md) - Correct affected docs after features, fixes or structural changes
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
