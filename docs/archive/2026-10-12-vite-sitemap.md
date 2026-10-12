# Former Vite sitemap

Archived on 2026-10-12 from [SITEMAP.md](../SITEMAP.md). This preserves former
`apps/web` Vite behavior and screen names; it is historical reference, not the
current Next app contract or a buildable rollback surface.

## Former Vite inventory

The following inventory records the former `apps/web` app only.

## Public Routes

| Route            | Page           | Description                                     |
| ---------------- | -------------- | ----------------------------------------------- |
| `/`              | Auth Page      | Sign in / sign up entry point (Default route)   |
| `/landing`       | Landing Page   | Marketing page                                  |
| `/fly/:username` | Public Profile | Public view of user's flight stats and passport |
| `/leaderboard`   | Leaderboard    | Global rankings and stats                       |

## Authenticated Routes

All routes below require authentication (wrapped in `ProtectedRoute`).

| Route         | Page       | Description                                                |
| ------------- | ---------- | ---------------------------------------------------------- |
| `/dashboard`  | Dashboard  | Personal stats overview, map, and recent activity          |
| `/flights`    | Flights    | Full flight log with search, filter, and edit capabilities |
| `/passport`   | Passport   | Visual passport representation of travel history & badges  |
| `/import`     | Import     | AI-powered flight import tool                              |
| `/settings`   | Settings   | Account preferences and configuration                      |
| `/onboarding` | Onboarding | First-time user setup wizard                               |

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
