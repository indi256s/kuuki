# Kuuki - Implementation Plan

> **Historical MVP roadmap.** Status and stack below record the original Vite application. Start with [README.md](./README.md) for current source and release authorities.
> **Specs:** See [SPEC.md](./SPEC.md) for complete product requirements.
> **Tasks:** See [tasks/](./tasks/) for detailed implementation per phase.
> **Design System:** See [FRONTEND_GUIDELINES.md](./FRONTEND_GUIDELINES.md) for UI guidelines.

---

## Current Status

**🎉 MVP COMPLETE** — All phases done, CI/CD deployed, ready for users.

| Phase                  | Status  | Details                                                       |
| ---------------------- | ------- | ------------------------------------------------------------- |
| **0.5 Reference Data** | ✅ Done | 726 aircraft, 512 airports, 162 airlines loaded               |
| **1 Foundation**       | ✅ Done | Auth, i18n, tests, CF Pages (kuuki.indi256.com)               |
| **1.5 Onboarding**     | ✅ Done | Landing page, showcase modal, username picker, empty states   |
| **2 Core Flights**     | ✅ Done | Flight CRUD, dashboard with stats, route map, autocomplete    |
| **3 AI Import**        | ✅ Done | Gemini 3 Flash proxy, upload/paste UI, review with confidence |
| **3.5 UI Redesign**    | ✅ Done | shadcn/ui components, Warm Japanese aesthetic, dark mode      |
| **4 Social**           | ✅ Done | Public profiles, leaderboards, compare, 20 badges             |
| **4.5 Passport**       | ✅ Done | Country stamps, manual claims, 246 countries, 31 tests        |
| **5 Advanced Stats**   | ✅ Done | 4 tiers: Overview, Avia Geek, Country Geek, Time Geek         |
| **6 Polish**           | ✅ Done | Dark mode, mobile responsive, errors, settings, CI/CD         |

---

## Phase Overview

### Phase 0.5: Reference Data ✅

Aircraft, airports, airlines loaded as static JSON. See `packages/data/`.

### Phase 1: Foundation ✅

Open registration auth, i18n (EN/RU), 26 tests passing, Cloudflare Pages live.

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

**Design Direction:** Warm Japanese Minimalism

- Light mode: Warm paper-like neutrals (Washi) — breathable, organic
- Dark mode: Deep ink/charcoal with amber accents — focused, energetic
- Generous whitespace (Ma) and rounded corners
- Subtle hover states and smooth animations
- Full dark mode support with 3-way toggle

**Components Rebuilt:**

- Dashboard with sticky header, dropdown menu, animated stats cards
- Flight form using shadcn Dialog
- Landing page with feature cards and staggered animations
- Import page with cleaner parsing states

→ See [FRONTEND_GUIDELINES.md](./FRONTEND_GUIDELINES.md) for full design system

### Phase 4: Social ✅

Public profiles, compare feature, leaderboards, and 20 badges with space-themed tiers.

**Features:**

- Public profiles at `/fly/{username}` with stats, badges, and rankings
- Leaderboards with 5 categories (flights, distance, countries, cities, airlines)
- Compare feature for side-by-side stat comparison
- 20 badges across 6 categories (flights, distance, airlines, aircraft, achievement, secret)
- 10 theme color presets with visual density scaling
- Privacy controls (public/private profiles, leaderboard opt-in)
- 5 flight minimum for leaderboard eligibility

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

### Phase 5: Advanced Stats ✅

Progressive unlock system with 4 specialized stat tiers and sarcastic AI commentary.

**Tiers:**

- **Overview** (always visible) — Total flights, distance, countries, airlines with animated stat cards
- **Avia Geek** (5+ aircraft) — Aircraft breakdown, manufacturers, widebody/narrowbody ratio
- **Country Geek** (5+ countries) — Continent coverage, world completion %, regional progress
- **Time Geek** (10+ flights) — Total flight time, longest/shortest flights, departure patterns

**Features:**

- Tier unlock celebration toast with blur-to-clear reveal animation
- Sarcastic AI "Flight Stats AI" commentary with randomized quips
- Flight popover for viewing individual flight details
- Duration formatting utility with localized output
- Departure pattern analysis (Night Owl, Early Bird, Business Hours, Evening)

**Tech:**

- `useUnlockProgress` hook for tier state management
- `formatDuration` utility with comprehensive test coverage
- Database migration for departure pattern tracking
- Responsive grid layout (2-col on desktop, stacked on mobile)

→ [tasks/phase-5-advanced-stats.md](./tasks/phase-5-advanced-stats.md)

### Phase 6: Polish ✅

Dark mode, mobile-first responsive design, error handling, settings, CI/CD.

**Sub-phases:**

- ✅ **Dark Mode** — 3-way toggle (Light/Dark/System), localStorage persistence
- ✅ **Phase 6a: Core Navigation** — Bottom tab bar, mobile header, FAB, safe area CSS
- ✅ **Phase 6b: Flight Management** — CSS card/table switch, bottom sheet forms, keyboard-aware resize
- ✅ **Phase 6c: Content Pages** — Map collapsible, country sheet with letter accordion, profile mini-header, collapsible sections, vertical stats grid
- ✅ **Phase 6d: Polish & Performance** — 44px touch targets (WCAG 2.5.5), `--duration-micro` token, `prefers-reduced-motion` support, Lighthouse checklist
- ✅ **Phase 6e: Error Handling** — Route-level boundaries, toast notifications with aviation personality, auto-retry with exponential backoff, i18n messages (EN/RU)
- ✅ **Phase 6f: Settings Page** — `/settings` route with language, CSV export (portable + enriched), account deletion with password verification
- ✅ **Phase 6g: CI/CD Pipeline** — GitHub Actions with lint/typecheck/build, auto-revert on main failure, Telegram notifications

**CI/CD Features:**

- Parallel jobs: lint, typecheck, test, build
- Tests non-blocking (`continue-on-error`)
- Staging deploys for PRs → `kuuki-staging.pages.dev`
- Production deploys on main → `kuuki.indi256.com`
- Auto-revert breaking commits + Telegram alerts
- AI agent PRs require `ci:approved` label

→ [tasks/phase-6-polish.md](./tasks/phase-6-polish.md)

---

## Design System

**Direction:** Warm Japanese Minimalism — Modern travelers who feel like crazy scientists analyzing their own life data

**Colors (OKLCH):**

- Background: `oklch(0.985 0.002 240)` — soft washi paper with blue tint
- Primary: `oklch(0.55 0.12 25)` — warm amber accent
- Foreground: `oklch(0.25 0.01 260)` — ink charcoal

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

→ Full details: [FRONTEND_GUIDELINES.md](./FRONTEND_GUIDELINES.md)

---

## Available Tools

### Design Skills

| Skill                      | Use Case                                              |
| -------------------------- | ----------------------------------------------------- |
| `/frontend-design`         | Creative UI — landing pages, profiles, visualizations |
| `/interface-design`        | App interfaces — dashboards, forms, data tables       |
| `/interface-design:status` | Show current design system state                      |
| `/interface-design:audit`  | Check consistency against design system               |

### Cloudflare Skills

| Skill                    | Use Case                                        |
| ------------------------ | ----------------------------------------------- |
| `/cloudflare:cloudflare` | Platform overview — Workers, Pages, storage, AI |
| `/cloudflare:wrangler`   | Deployment, KV, R2, D1, Queues, Workflows       |
| `/cloudflare:web-perf`   | Core Web Vitals (FCP, LCP, TBT, CLS)            |

### Workflow Skills

| Skill                                         | Use Case                      |
| --------------------------------------------- | ----------------------------- |
| `/superpowers:brainstorming`                  | Before any feature work       |
| `/superpowers:test-driven-development`        | Before writing implementation |
| `/superpowers:systematic-debugging`           | When encountering bugs        |
| `/superpowers:verification-before-completion` | Before claiming done          |
| `/code-review:code-review`                    | Review PRs                    |

### MCP Servers

| Server            | Capabilities                                                 |
| ----------------- | ------------------------------------------------------------ |
| `supabase`        | DB schema, migrations, RLS, edge functions, TypeScript types |
| `context7`        | Library docs (Mapbox, react-map-gl, Gemini SDK)              |
| `playwright`      | E2E tests, visual regression                                 |
| `cloudflare-docs` | Cloudflare documentation                                     |
| `shadcn`          | Component registry, examples, add commands                   |

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
pnpm lint         # Run ESLint
pnpm typecheck    # Run TypeScript checks

# Add shadcn components
cd apps/web
npx shadcn@latest add <component>

# Deploy (auto on push to main)
git push origin main
```

---

## MVP Complete 🎉

All planned phases are complete. The app is feature-complete for MVP launch.

---

## Post-MVP: Consistency Refactor ✅

Code cleanup to ensure codebase consistency with DNA documentation patterns.

**Completed 2026-02-02:**

| Area                    | Status  | Changes                                                                           |
| ----------------------- | ------- | --------------------------------------------------------------------------------- |
| **Login Page Redesign** | ✅ Done | Split layout with vertical Katakana (クウキ) branding, flowing shimmer animation  |
| **Form Migration**      | ✅ Done | SignInForm, SignUpForm, FlightForm migrated to React Hook Form + Zod              |
| **Error Handling**      | ✅ Done | Added onSuccess/onError with toast notifications to all mutations                 |
| **Design Tokens**       | ✅ Done | Migrated legacy tokens (bg-sky-raised → bg-card, text-ink → text-foreground)      |
| **Code Style**          | ✅ Done | FlightEditRow uses cn() helper, font-data for IATA codes, warning semantic tokens |

**Files Modified:**

- `routes/AuthPage.tsx` — Complete redesign with vertical katakana branding
- `components/auth/SignInForm.tsx` — RHF + Zod migration
- `components/auth/SignUpForm.tsx` — RHF + Zod migration
- `components/flights/FlightForm.tsx` — RHF + Zod migration
- `components/ui/form.tsx` — Added shadcn form component
- `hooks/useFlights.ts` — Added toast error handlers
- `hooks/usePassport.ts` — Added toast error handlers
- `components/landing/FeatureGrid.tsx` — Token migration
- `components/landing/HeroSection.tsx` — Token migration
- `components/common/WindLoader.tsx` — Token migration
- `components/map/RouteMap.tsx` — Token migration
- `components/import/FlightEditRow.tsx` — cn() helper, font-data, warning tokens
- `index.css` — Added text-flow animation, writing-vertical utility, warning tokens
- `packages/shared/src/i18n/*.json` — Added toast message translations

**Live URLs:**

- Production: https://kuuki.indi256.com
- Staging: https://kuuki-staging.pages.dev (PR previews)

---

## Post-MVP: Profile Page Redesign ✅

Full visual overhaul of the `/fly/:username` profile page to match the Warm Japanese Minimalism brand.

**Completed 2026-02-10:**

| Area                   | Status  | Changes                                                                                                                                            |
| ---------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Route Registration** | ✅ Done | `/fly/:username` added as public route in App.tsx                                                                                                  |
| **ProfileHeader**      | ✅ Done | Atmospheric radial gradient banner, SVG grain overlay, circular avatar with lantern glow, Share button                                             |
| **ProfileStats**       | ✅ Done | Hero stat (text-5xl font-data), borderless typography grid, avionics-panel labels                                                                  |
| **ProfileBadges**      | ✅ Done | Horizontal scroll pills on mobile, flowing wrap desktop, tier color dots                                                                           |
| **ProfileRankings**    | ✅ Done | Single list layout, prominent rank numbers, thin progress bars, amber top-10 highlight                                                             |
| **ProfileSection**     | ✅ Done | Clean divider-style triggers, uppercase tracking-widest titles, subtle desktop dividers                                                            |
| **ProfilePage Layout** | ✅ Done | Removed wrapping Card, Ma spacing (space-y-12/16), max-w-3xl, くうき watermark, staggered animations, atmospheric 404, frosted-glass private state |
| **ProfileMiniHeader**  | ✅ Done | Theme color accent line, font-data key stat                                                                                                        |

**Files Modified:**

- `apps/web/src/App.tsx` — Added lazy import + public route
- `apps/web/src/routes/ProfilePage.tsx` — Full layout restructure
- `apps/web/src/components/profile/ProfileHeader.tsx` — Visual redesign
- `apps/web/src/components/profile/ProfileStats.tsx` — Visual redesign
- `apps/web/src/components/profile/ProfileBadges.tsx` — Visual redesign
- `apps/web/src/components/profile/ProfileRankings.tsx` — Visual redesign
- `apps/web/src/components/profile/ProfileSection.tsx` — Refinement
- `apps/web/src/components/profile/ProfileMiniHeader.tsx` — Match new style

---

## Post-MVP: Data Quality Fixes ✅

Fixed leaderboard staleness and data integrity issues across user_stats and flights tables.

**Completed 2026-02-10:**

| Area                       | Status  | Changes                                                                                                                                                          |
| -------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Leaderboard Refresh**    | ✅ Done | Added missing trigger: `user_stats` changes now auto-refresh `leaderboard_cache` (was never refreshing after flight add/edit/delete)                             |
| **Refresh Debounce**       | ✅ Done | 30-second debounce on leaderboard refresh to prevent excessive recalculations during bulk imports                                                                |
| **Continents Calculation** | ✅ Done | Restored continent mapping in `recalculate_user_stats` (was hardcoded to 0); recalculated all users                                                              |
| **Enrichment Status**      | ✅ Done | Fixed 180 flights stuck as `pending` despite having `aircraft_icao`; added BEFORE UPDATE trigger to auto-set `enrichment_status='enriched'` when aircraft is set |
| **Frontend Cache**         | ✅ Done | Leaderboard React Query keys now invalidated after flight create/update/delete/batch-delete mutations                                                            |

**Migrations:**

- `20260210140000_add_leaderboard_refresh_trigger_on_stats.sql`
- `20260210163000_fix_continents_count_calculation.sql`
- `20260210163500_auto_update_enrichment_status_on_aircraft_change.sql`

**Known (not bugs):**

- 129 flights still missing `aircraft_icao` — genuinely unresolvable, can be re-enriched via "Find Aircraft" button
- ~80 flights missing `departure_time`/`arrival_time` — pre-fix imports; times now required in Gemini schema (see Import UX Improvements below)

---

## Post-MVP: Import UX Improvements ✅

Live flight reveal animation and time extraction reliability fix.

**Completed 2026-02-12:**

| Area                        | Status  | Changes                                                                                                                                      |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Flight Reveal Animation** | ✅ Done | After Gemini returns flights, they appear one-by-one as compact text lines with staggered fade-up animation before transitioning to review   |
| **Time Extraction Fix**     | ✅ Done | Made `departure_time`/`arrival_time` required in Gemini response schema; ~26% of imports were silently dropping times due to optional fields |

**Flight Reveal UX:**

- Compact monospace flight lines: `B2 946   LED → MSQ   15 Jan 2026   20:10–21:40`
- Staggered `animate-fade-up` (300ms between each flight)
- Validation checkmarks after all flights revealed
- Auto-transition to review step after reveal completes
- Scrollable container (`max-h-48`) for large imports

**Time Extraction Fix:**

- Root cause: `departure_time`/`arrival_time` were optional in `FLIGHT_RESPONSE_SCHEMA`, letting Gemini silently omit clearly visible times
- Fix: Made times required in schema, updated prompt to emphasize time extraction, added empty-string-to-undefined normalization

**Files Modified:**

- `apps/web/src/components/import/FlightProgressModal.tsx` — Flight reveal animation with staggered appearance
- `apps/web/src/routes/ImportPage.tsx` — `pendingFlights` state, delayed review transition
- `functions/api/import/parse.ts` — Times required in schema, empty string normalization
- `functions/api/import/_shared.ts` — Updated extraction prompt for time emphasis
- `packages/shared/src/i18n/en.json` — Added `import.parsing.flightsFound`
- `packages/shared/src/i18n/ru.json` — Added `import.parsing.flightsFound`

---

## What's Next (Future Ideas)

These are **not planned** — just ideas for post-MVP based on user feedback:

| Feature                  | Description                                         |
| ------------------------ | --------------------------------------------------- |
| **Trip Grouping**        | Group flights into trips (vacation, business, etc.) |
| **Seat Tracking**        | Record seat numbers, window/aisle preferences       |
| **Loyalty Programs**     | Track miles across airline programs                 |
| **Flight Reviews**       | Rate flights, add notes about experience            |
| **Social Sharing**       | Share flight maps/stats to social media             |
| **Mobile App**           | React Native or PWA with offline support            |
| **OpenClaw Integration** | AI code review on PRs via webhook                   |
| **Separate Staging DB**  | Dedicated Supabase project for staging              |

---

## Deferred CI/CD Enhancements

| Item                             | Reason                                        |
| -------------------------------- | --------------------------------------------- |
| `dev` + `main` branch strategy   | MVP simplicity; add when team grows           |
| OpenClaw webhook for code review | Requires webhook setup; manual review for now |
| Rich Telegram notifications      | Basic alerts sufficient for solo dev          |
| Lighthouse CI                    | Manual testing sufficient for MVP             |
