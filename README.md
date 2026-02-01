# Kuuki (空気)

A travel geek platform for flight tracking, visited places mapping, and social leaderboards.

## Features

- **Flight Tracking** - Import flights via AI or add manually
- **Visited Places** - Auto-extracted countries/cities from flights
- **Leaderboards** - Multi-category rankings (countries, cities, flights, distance, airlines)
- **Public Profiles** - Shareable travel stats and maps
- **Achievements** - Badge system for milestones
- **Onboarding** - Showcase modal, username picker, guided first-flight experience

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS v4
- **Hosting**: Cloudflare Pages + Workers
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth (invite-code gated)
- **AI**: Google Gemini 3.0 Flash via @google/genai SDK
- **i18n**: English + Russian

## Project Structure

```
kuuki/
├── apps/
│   └── web/              # React SPA
│       └── src/
│           ├── components/   # UI (auth, dashboard, flights, landing, map, onboarding)
│           ├── hooks/        # useAuth, useLanguage, useShowcase, useFlights, useStats
│           ├── lib/          # supabase, auth, i18n, flights, geo
│           ├── routes/       # Page components
│           └── stores/       # Zustand state
├── packages/
│   ├── shared/           # Types, i18n translations
│   └── data/             # Static reference data (aircraft, airports, airlines)
├── functions/            # Cloudflare Workers (edge API)
├── supabase/             # Database migrations
└── docs/                 # Documentation and plans
```

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Run tests
pnpm test
```

## Routes

| Path | Description |
|------|-------------|
| `/` | Landing page with showcase modal |
| `/auth` | Sign in / Sign up |
| `/onboarding` | Username picker + import CTA |
| `/dashboard` | User dashboard with stats, route map, recent flights |
| `/flights` | Flight management (add, edit, delete, filter) |

## Documentation

See [docs/](./docs/) for detailed specs, plans, and implementation guides.

## License

Private
