# Kuuki - Implementation Plan

> **Start here:** Check [README.md](./README.md) for quick reference and project structure.
> **Specs:** See [SPEC.md](./SPEC.md) for complete product requirements.
> **Tasks:** See [tasks/](./tasks/) for detailed implementation per phase.

---

## Current Status

| Phase | Status | Details |
|-------|--------|---------|
| **0.5 Reference Data** | ✅ Done | 173 aircraft, 115 airports, 90+ airlines loaded |
| **1 Foundation** | ✅ Done | Auth, i18n, tests, CF Pages (kuuki.indi256.com) |
| **1.5 Onboarding** | ✅ Done | Landing page, showcase modal, username picker, empty states |
| **2 Core Flights** | ✅ Done | Flight CRUD, dashboard with stats, route map, autocomplete |
| **3 AI Import** | ✅ Done | Gemini 3.0 Flash proxy, upload/paste UI, review with confidence |
| **4 Social** | ⏳ Pending | Profiles, leaderboards, badges |
| **5 Advanced Stats** | ⏳ Pending | Progressive unlock tiers |
| **6 Polish** | ⏳ Pending | Dark mode, mobile, CI/CD |

---

## Phase Overview

### Phase 0.5: Reference Data ✅

Aircraft, airports, airlines loaded as static JSON. See `packages/data/`.

### Phase 1: Foundation ✅

Auth with invite codes, i18n (EN/RU), 26 tests passing, Cloudflare Pages live.

→ [tasks/phase-1-foundation.md](./tasks/phase-1-foundation.md)

### Phase 1.5: Onboarding & Landing ✅

Pre-login showcase, landing page, username picker, empty states.

→ [tasks/phase-1.5-onboarding.md](./tasks/phase-1.5-onboarding.md)

### Phase 2: Core Flight Management ✅

Flight CRUD with form modal, future flights with countdown, dashboard with stats cards, route map visualization, autocomplete for airports/airlines/aircraft.

→ [tasks/phase-2-core-flights.md](./tasks/phase-2-core-flights.md)

### Phase 3: AI Import ✅

Cloudflare Pages Function proxy for Gemini 3.0 Flash, drag-drop/paste upload, WindLoader animation, review with inline editing and confidence colors, duplicate detection.

**Enhancement (v2):** Smart context-aware Import flow
- New users: Text mode with Gemini prompt helper always visible (bulk import from Gmail/Calendar)
- Returning users: File upload mode (quick boarding pass scans)
- Auto mode switching when pasting text
- Drag-drop works in both modes

→ [tasks/phase-3-ai-import.md](./tasks/phase-3-ai-import.md)

### Phase 4: Social

Public profiles, compare feature, leaderboards, badges.

→ [tasks/phase-4-social.md](./tasks/phase-4-social.md)

### Phase 5: Advanced Stats

Progressive unlock tiers: Overview, Avia Geek, Country Geek, Duration.

→ [tasks/phase-5-advanced-stats.md](./tasks/phase-5-advanced-stats.md)

### Phase 6: Polish

Dark mode, mobile responsiveness, error handling, CI/CD.

→ [tasks/phase-6-polish.md](./tasks/phase-6-polish.md)

---

## Available Tools

### Design Skills

| Skill | Use Case |
|-------|----------|
| `/frontend-design` | Creative UI — landing pages, profiles, visualizations |
| `/interface-design` | App interfaces — dashboards, forms, data tables |
| `/interface-design:init` | Initialize design system (tokens, patterns) |
| `/interface-design:audit` | Check consistency against design system |
| `/playground` | Interactive HTML prototypes |

### Cloudflare Skills

| Skill | Use Case |
|-------|----------|
| `/cloudflare:cloudflare` | Platform overview — Workers, Pages, storage, AI |
| `/cloudflare:wrangler` | Deployment, KV, R2, D1, Queues, Workflows |
| `/cloudflare:web-perf` | Core Web Vitals (FCP, LCP, TBT, CLS) |
| `/cloudflare:agents-sdk` | Stateful AI agents |
| `/cloudflare:durable-objects` | Stateful coordination |

### Workflow Skills

| Skill | Use Case |
|-------|----------|
| `/superpowers:brainstorming` | Before any feature work |
| `/superpowers:test-driven-development` | Before writing implementation |
| `/superpowers:systematic-debugging` | When encountering bugs |
| `/superpowers:verification-before-completion` | Before claiming done |
| `/code-review:code-review` | Review PRs |

### MCP Servers

| Server | Capabilities |
|--------|--------------|
| `supabase` | DB schema, migrations, RLS, edge functions, TypeScript types |
| `context7` | Library docs (Mapbox, react-map-gl, Gemini SDK) |
| `playwright` | E2E tests, visual regression |
| `cloudflare-docs` | Cloudflare documentation |
| `cloudflare-workers-builds` | Build insights |

---

## Workflow

1. **Read docs first** — Check this folder before exploring codebase
2. **Brainstorm** — Use `/superpowers:brainstorming` before feature work
3. **TDD** — Write tests first with `/superpowers:test-driven-development`
4. **Verify** — Use `/superpowers:verification-before-completion` before claiming done
5. **Review** — Use `/code-review:code-review` after completing phases
