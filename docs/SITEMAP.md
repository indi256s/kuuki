# Kuuki Sitemap

## Public Routes

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing Page | Marketing page, sign up/sign in CTAs |
| `/auth` | Auth Page | Sign in / sign up forms |

## Authenticated Routes

All routes below require authentication (wrapped in `ProtectedRoute`).

| Route | Page | Description |
|-------|------|-------------|
| `/onboarding` | Onboarding | First-time user setup |
| `/dashboard` | Dashboard | Stats overview, route map, recent flights |
| `/flights` | Flights | Full flight list with edit/delete |
| `/import` | Import | AI-powered flight import from text/PDF/image |

## Navigation Structure

```
Header (authenticated pages)
├── Logo → /dashboard
├── Nav Links
│   ├── Dashboard → /dashboard
│   ├── Flights → /flights
│   └── Import → /import
├── Theme Toggle (sun/moon icon)
└── User Menu (avatar dropdown)
    ├── Language Toggle
    └── Sign Out
```

## Component Structure

```
routes/
├── LandingPage.tsx      # Public landing
├── AuthPage.tsx         # Sign in/up
├── OnboardingPage.tsx   # First-time setup
├── DashboardPage.tsx    # Main dashboard
├── FlightsPage.tsx      # Flight list
└── ImportPage.tsx       # AI import flow

components/
├── common/
│   ├── AppHeader.tsx    # Shared nav header
│   └── ThemeToggle.tsx  # Dark mode toggle
├── dashboard/           # Dashboard widgets
├── flights/             # Flight list & forms
├── import/              # Import flow steps
└── ui/                  # shadcn components
```
