# Kuuki (空気)

A travel geek platform for flight tracking, visited places mapping, and social leaderboards.

## Features

- **Flight Tracking** - Import flights via AI or add manually
- **Visited Places** - Auto-extracted countries/cities from flights
- **Leaderboards** - Multi-category rankings (countries, cities, flights, distance, airlines)
- **Public Profiles** - Shareable travel stats and maps
- **Achievements** - Badge system for milestones

## Tech Stack

- **Frontend**: React 19 + Vite + TypeScript + Tailwind CSS
- **Hosting**: Cloudflare Pages + Workers
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth (Google OAuth)
- **AI**: Google Gemini (for flight parsing)

## Project Structure

```
kuuki/
├── apps/
│   └── web/              # React SPA
├── packages/
│   ├── shared/           # Types and constants
│   └── data/             # Static reference data
├── functions/            # Cloudflare Workers (edge API)
└── supabase/             # Database migrations
```

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build
```

## License

Private
