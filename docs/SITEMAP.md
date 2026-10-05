# Kuuki Sitemap

## Current Next routes

The current app is [apps/next](../apps/next/src/app/), with server gates in
[gates.ts](../apps/next/src/server/gates.ts). The Vite inventory below is rollback
history. It does not describe the current navigation.

| Routes | Current behavior |
| --- | --- |
| `/` | Guest landing; authenticated members continue to Overview or unfinished onboarding. |
| `/signin`, `/signup` | Separate authentication forms; members use the same landing gate. |
| `/activation-request`, `/activate`, `/activate.html` | Generic activation request and restricted static token completion. The Worker owns static completion, including its recovery-host boundary. |
| `/forgot-password`, `/reset-password`, `/password-updated` | Generic recovery request, token-only password replacement and sign-in confirmation. |
| `/account-deleted` | Signed-out deletion confirmation. |
| `/onboarding?step=name`, `capture`, `reveal` | Name/profile setup, shared manual/upload/paste Capture, then truthful saved-flight feedback. A durable import `batch` can resume Capture. |
| `/overview` | Period totals, insights, upcoming/awaiting journeys and missing-aircraft recovery. |
| `/journal` | Paged flight log; search/filter/sort/page state belongs to this URL. |
| `/journal/[id]/edit`, `/add`, `/import` | Own-flight editing, manual Capture and resumable import Source/Progress/Review/Done. |
| `/passport` | Collection, region/detail sheets, claims/ground visits, awaiting arrivals and period-aware map. |
| `/passport/manage` | Aircraft in journal: bulk aircraft assignment. `?countryCode=CC` redirects to `/passport?country=CC`. |
| `/fly/[username]` | Public profile for visitors or private owner profile; live visibility gates protect private records. |
| `/leaderboard` | Public eligible rankings; authenticated own rank/notifications follow the same eligibility policy. |
| `/settings` | Dirty-state-protected profile, privacy, appearance, export and reauthenticated deletion. |
| `/me` | Resolves to the own profile, unfinished Name step or sign-in. |
| `/dashboard`, `/flights`, `/journey`, `/landing` | Compatibility redirects to Overview, Journal, Overview and `/`. |

Member routes require an authenticated, named profile. Public profile and
leaderboard pages use the member shell for authenticated viewers and the brand
shell for guests. Desktop navigation is Overview / Journal / Passport /
Leaderboard, plus Add and account controls. Mobile tabs are Overview / Journal /
Add / Passport / Me. Header titles follow the current route.

The [Worker](../apps/next/worker.ts), [API handlers](../functions/api/) and
[release runbook](runbooks/2026-10-04-next-release-candidate.md) own runtime,
authentication and host contracts. No hosted acceptance is implied by this map.

## Legacy rollback inventory

The following inventory is retained for `apps/web` only.

## Public Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Auth Page | Sign in / sign up entry point (Default route) |
| `/landing` | Landing Page | Marketing page |
| `/fly/:username` | Public Profile | Public view of user's flight stats and passport |
| `/leaderboard` | Leaderboard | Global rankings and stats |

## Authenticated Routes

All routes below require authentication (wrapped in `ProtectedRoute`).

| Route | Page | Description |
|-------|------|-------------|
| `/dashboard` | Dashboard | Personal stats overview, map, and recent activity |
| `/flights` | Flights | Full flight log with search, filter, and edit capabilities |
| `/passport` | Passport | Visual passport representation of travel history & badges |
| `/import` | Import | AI-powered flight import tool |
| `/settings` | Settings | Account preferences and configuration |
| `/onboarding` | Onboarding | First-time user setup wizard |

## Component Structure

```
routes/
├── AuthPage.tsx         # / (Home/Login)
├── LandingPage.tsx      # /landing
├── DashboardPage.tsx    # /dashboard
├── FlightsPage.tsx      # /flights
├── PassportPage.tsx     # /passport
├── ImportPage.tsx       # /import
├── SettingsPage.tsx     # /settings
├── ProfilePage.tsx      # /fly/:username
├── LeaderboardPage.tsx  # /leaderboard
└── OnboardingPage.tsx   # /onboarding

components/
├── auth/                # Authentication forms
├── badges/              # Gamification badges
├── common/              # Shared headers, toggles, generic UI
├── compare/             # User comparison tools
├── dashboard/           # Dashboard-specific widgets
├── error/               # Error boundaries and toast providers
├── flights/             # Flight lists, filters, and forms
├── import/              # Import flow logic and UI
├── landing/             # Marketing page sections
├── layout/              # Layout wrappers
├── leaderboard/         # Ranking tables and pods
├── map/                 # Interactive flight maps
├── onboarding/          # Setup wizard steps
├── passport/            # Visual passport book components
├── profile/             # Public profile views
├── settings/            # User settings forms
└── ui/                  # shadcn/ui base primitives
```

## Navigation Hierarchy

**Primary Navigation (Header/Sidebar):**

1. **Dashboard** (`/dashboard`)
2. **Flights** (`/flights`)
3. **Passport** (`/passport`)
4. **Leaderboard** (`/leaderboard`)

**Secondary/Action:**

- **Import** (`/import`) - Often a distinct action button

**User Menu:**

- **Public Profile** (`/fly/:username`)
- **Settings** (`/settings`)
- **Sign Out**
