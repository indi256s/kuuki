# Kuuki - Implementation Plan

> **Start here:** Check [README.md](./README.md) for quick reference and project structure.
> **Specs:** See [SPEC.md](./SPEC.md) for complete product requirements.
> **Tasks:** See [tasks/](./tasks/) for detailed implementation per phase.
> **Design System:** See [../.interface-design/system.md](../.interface-design/system.md) for UI guidelines.

---

## Current Status

| Phase | Status | Details |
|-------|--------|---------|
| **0.5 Reference Data** | ✅ Done | 726 aircraft, 512 airports, 162 airlines loaded |
| **1 Foundation** | ✅ Done | Auth, i18n, tests, CF Pages (kuuki.indi256.com) |
| **1.5 Onboarding** | ✅ Done | Landing page, showcase modal, username picker, empty states |
| **2 Core Flights** | ✅ Done | Flight CRUD, dashboard with stats, route map, autocomplete |
| **3 AI Import** | ✅ Done | Gemini 3 Flash proxy, upload/paste UI, review with confidence |
| **3.5 UI Redesign** | ✅ Done | shadcn/ui components, Scandinavian aesthetic, dark mode ready |
| **4 Social** | ✅ Done | Public profiles, leaderboards, compare, 20 badges |
| **4.5 Passport** | ✅ Done | Country stamps, manual claims, 246 countries, 31 tests |
| **5 Advanced Stats** | ⏳ Pending | Progressive unlock tiers |
| **6 Polish** | ⏳ Pending | Dark mode toggle, mobile, CI/CD |

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

Cloudflare Pages Function proxy for Gemini 3 Flash Preview, drag-drop/paste upload, WindLoader animation, review with inline editing and confidence colors, duplicate detection.

→ [tasks/phase-3-ai-import.md](./tasks/phase-3-ai-import.md)

### Phase 3.5: UI Redesign ✅ (NEW)

Complete UI overhaul with modern component library and refined aesthetics:

**Tech Stack:**
- shadcn/ui components (New York style)
- Tailwind CSS v4 with OKLCH colors
- DM Sans + JetBrains Mono typography
- Lucide React icons

**Design Direction:** Minimal Scandinavian
- Soft, airy color palette with blue undertones
- Generous whitespace and rounded corners
- Subtle hover states and smooth animations
- Dark mode tokens ready (toggle pending)

**Components Rebuilt:**
- Dashboard with sticky header, dropdown menu, animated stats cards
- Flight form using shadcn Dialog
- Landing page with feature cards and staggered animations
- Import page with cleaner parsing states

→ See [../.interface-design/system.md](../.interface-design/system.md) for full design system

### Phase 4: Social ✅

Public profiles, compare feature, leaderboards, and 20 badges with space-themed tiers.

**Features:**
- Public profiles at `/fly/{username}` with stats, badges, and rankings
- Leaderboards with 5 categories (flights, distance, countries, cities, airlines)
- Compare feature for side-by-side stat comparison
- 20 badges across 6 categories (flights, distance, airlines, aircraft, achievement, secret)
- 10 theme color presets with visual density scaling
- Privacy controls (public/private profiles, leaderboard opt-in)
- 10 flight minimum for leaderboard eligibility

**Tech:**
- Denormalized `user_stats` table with database triggers for instant updates
- Badge evaluation via trigger chain (flight → stats → badges)
- Pre-computed percentiles for fast leaderboard loads
- Row Level Security for privacy enforcement

→ [tasks/phase-4-social.md](./tasks/phase-4-social.md)

### Phase 4.5: Passport ✅

Personal "Nomad Passport" view with country stamps representing all visited countries.

**Features:**
- Dedicated `/passport` route with virtualized stamp grid
- Country stamps with regional shapes (circle for Asia, rectangle for EU/Americas)
- Native script country names + flag colors as accents
- Manual country claims for ground travel (land/sea entry methods)
- Interactive claim map with country search
- Stamp popup with detailed stats (first visit, last visit, total visits, airports)
- 5 continent achievement badges (Europhile, Asianaut, Americas Wanderer, etc.)
- 246 countries/territories with ISO 3166-1 codes

**Tech:**
- `country_claims` table with RLS for manual entries
- Extended `user_stats` with world completion %, time zones, most visited country
- Static country data in `@kuuki/data/countries.json`
- Combines flight visits + manual claims into unified passport entries
- 31 unit tests covering all passport API functions

→ [tasks/phase-4.5-passport.md](./tasks/phase-4.5-passport.md)

### Phase 5: Advanced Stats

Progressive unlock tiers: Overview, Avia Geek, Country Geek, Duration.

→ [tasks/phase-5-advanced-stats.md](./tasks/phase-5-advanced-stats.md)

### Phase 6: Polish

Dark mode toggle, mobile responsiveness, error handling, CI/CD.

→ [tasks/phase-6-polish.md](./tasks/phase-6-polish.md)

---

## Design System

**Direction:** Nordic Skies — Scandinavian minimalism, soft and airy

**Colors (OKLCH):**
- Background: `oklch(0.985 0.002 240)` — soft off-white with blue tint
- Primary: `oklch(0.65 0.12 240)` — Nordic sky blue
- Foreground: `oklch(0.25 0.01 260)` — warm slate

**Typography:**
- Display/Body: DM Sans
- Data/Mono: JetBrains Mono

**Component Library:** shadcn/ui
- Button, Card, Dialog, Input, Label, Badge
- Skeleton, Separator, DropdownMenu, Popover, Command

**Animations:**
- `animate-fade-up` — entrance animation
- `stagger-children` — auto-delay for lists
- `group-hover:scale-110` — icon hover effect

→ Full details: [../.interface-design/system.md](../.interface-design/system.md)

---

## Available Tools

### Design Skills

| Skill | Use Case |
|-------|----------|
| `/frontend-design` | Creative UI — landing pages, profiles, visualizations |
| `/interface-design` | App interfaces — dashboards, forms, data tables |
| `/interface-design:status` | Show current design system state |
| `/interface-design:audit` | Check consistency against design system |

### Cloudflare Skills

| Skill | Use Case |
|-------|----------|
| `/cloudflare:cloudflare` | Platform overview — Workers, Pages, storage, AI |
| `/cloudflare:wrangler` | Deployment, KV, R2, D1, Queues, Workflows |
| `/cloudflare:web-perf` | Core Web Vitals (FCP, LCP, TBT, CLS) |

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
| `shadcn` | Component registry, examples, add commands |

---

## Workflow

1. **Read docs first** — Check this folder before exploring codebase
2. **Brainstorm** — Use `/superpowers:brainstorming` before feature work
3. **TDD** — Write tests first with `/superpowers:test-driven-development`
4. **Verify** — Use `/superpowers:verification-before-completion` before claiming done
5. **Review** — Use `/code-review:code-review` after completing phases

---

## Quick Commands

```bash
# Development
cd ~/kuuki
pnpm dev          # Start dev server (port 5173)
pnpm build        # Production build
pnpm test         # Run tests

# Add shadcn components
cd apps/web
npx shadcn@latest add <component>

# Deploy (auto on push to main)
git push origin main
```
