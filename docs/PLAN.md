# Kuuki - Project Status & Roadmap

> **Start here:** Check [README.md](./README.md) for quick reference and project structure.
> **Design System:** See [FRONTEND_GUIDELINES.md](./FRONTEND_GUIDELINES.md) for UI guidelines.

---

## Current Status

**OPEN BETA** — MVP complete, polishing for public launch.

**Live:** https://kuuki.indi256.com

---

## MVP Summary (Complete)

All foundational phases shipped between January and February 2026:

| Phase | What Shipped |
|-------|-------------|
| Reference Data | 726 aircraft, 512 airports, 300+ airlines as static JSON |
| Foundation | Auth with invite codes, i18n (EN/RU), Cloudflare Pages deployment |
| Onboarding | Landing page, showcase modal, username picker, empty states |
| Core Flights | Flight CRUD, dashboard stats, route map, airport/airline autocomplete |
| AI Import | Gemini 3 Flash proxy, drag-drop/paste, review with confidence scoring |
| UI Redesign | shadcn/ui (New York), Warm Japanese Minimalism, OKLCH colors, dark mode |
| Social | Public profiles, leaderboards, compare feature, 20 space-themed badges |
| Passport | Country stamps, manual claims, 246 countries, ground visit tracking |
| Advanced Stats | 4-tier progressive unlock (Overview, Avia Geek, Country Geek, Time Geek) |
| Polish | Mobile-first responsive, error handling, settings, CSV export, CI/CD pipeline |

Post-MVP refinements (Feb 2026):
- Login page redesign with vertical Katakana branding
- Form migration to React Hook Form + Zod
- Profile page visual overhaul (atmospheric gradients, lantern glow)
- Data quality fixes (leaderboard triggers, continent calculation, enrichment status)
- Import UX (live flight reveal animation, time extraction reliability)

---

## Open Beta Focus

### Performance & Error Handling Audit (Feb 2026) - Done

Comprehensive codebase audit fixing 30+ issues:

| Area | Fixes |
|------|-------|
| **React Performance** | `useAuth()` selector optimization (useShallow), lifted badge tier computation (9 hooks to 1), memoized import routes, combined filter queries (3 to 1), removed duplicate dashboard stats fetch |
| **Error Handling** | Dashboard loading/error states, mutation error classification with i18n, aircraft enrichment error handlers, delete dialog try/catch/finally, auth form error mapping |
| **Data Integrity** | Unhandled promise rejection fix, lib functions throw instead of swallowing errors, public profile error distinction (not-found vs network), auth store try/catch around getProfile |
| **State Management** | Stale filters closure fix, auth subscription cleanup |
| **Bundle & Import** | Batch flight imports (single INSERT), removed phantom radix-ui package, lazy Agentation dev tool, module-scope constants |

### Remaining Beta Polish

| Item | Priority | Status |
|------|----------|--------|
| List virtualization (react-virtual) for flight list | High | Planned |
| Server-side favorite computation in user_stats | Medium | Planned |
| deleteAccount error collection and reporting | Medium | Planned |
| Cache headers for hashed assets in wrangler.toml | Low | Planned |
| Service worker TopoJSON caching | Low | Planned |
| @kuuki/data sub-path exports for better chunking | Low | Planned |
| Error boundary around lazy Suspense children | Low | Planned |
| DM Sans italic font axis audit | Low | Planned |

---

## Future Ideas

Not planned — ideas for post-beta based on user feedback:

| Feature | Description |
|---------|-------------|
| **Trip Grouping** | Group flights into trips (vacation, business, etc.) |
| **Seat Tracking** | Record seat numbers, window/aisle preferences |
| **Loyalty Programs** | Track miles across airline programs |
| **Flight Reviews** | Rate flights, add notes about experience |
| **Social Sharing** | Share flight maps/stats to social media |
| **Journey Planner** | Plan future trips with route optimization |
| **Separate Staging DB** | Dedicated Supabase project for staging environment |

---

## Infrastructure

| Component | Details |
|-----------|---------|
| **Frontend** | React + Vite SPA on Cloudflare Pages |
| **API** | Cloudflare Pages Functions (Gemini proxy) |
| **Database** | Supabase (Postgres + RLS + triggers) |
| **CI/CD** | GitHub Actions (lint, typecheck, build, auto-revert) |
| **Production** | https://kuuki.indi256.com |
| **Staging** | PR previews at kuuki-staging.pages.dev |

---

## Design System

**Direction:** Warm Japanese Minimalism

| Element | Choice |
|---------|--------|
| Components | shadcn/ui (New York style) |
| Colors | OKLCH with warm paper (light) / deep ink (dark) |
| Typography | DM Sans (display/body) + JetBrains Mono (data) |
| Animations | fade-up entrance, stagger-children, hover scale |

Full details: [FRONTEND_GUIDELINES.md](./FRONTEND_GUIDELINES.md)
