# Kuuki (くうき)

**Your Personal Travel Legacy.**
Turn your flight history into a visual legacy. Designed for explorers. Beautifully quantified.

---

## Philosophy

**Kuuki (空気)** means "Air" or "Atmosphere" in Japanese.

Most flight trackers are utilitarian spreadsheets. Kuuki is designed to be a **digital sanctuary** for your journeys. It combines the precision of a data-logger with the aesthetics of a travel journal.

---

## Features

- **AI Import** — Snap a photo of your boarding pass; Gemini AI parses the details.
- **Manual Entry** — For aviation purists who know their tail numbers.
- **Visual Routes** — Animated maps of your journeys.
- **Digital Passport** — Collect country stamps as you land.
- **Geek-Grade Analytics** — Aircraft types, circadian rhythm, streaks, and more.
- **Social (Opt-in)** — Leaderboards, public profiles, privacy first.

---

## Tech Stack

- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, shadcn/ui
- **Backend:** Supabase (Auth, Postgres, RLS)
- **Edge:** Cloudflare Pages + Workers (API gateway)
- **AI:** Google Gemini (boarding pass parsing, aircraft enrichment)
- **Monorepo:** pnpm + Turborepo

---

## Project Structure

```
apps/web/          React + Vite frontend
packages/shared/   Shared types, i18n (en.json, ru.json)
packages/data/     Static reference data (airports, airlines, aircraft)
functions/         Cloudflare Workers API (Gemini proxy)
supabase/          Database migrations
docs/              Project documentation (PRD, design system, etc.)
```

---

## Getting Started

### Prerequisites

- **Node.js** 20+
- **pnpm** 9+ (`corepack enable && corepack prepare pnpm@latest --activate`)

### Setup

```bash
# Clone and install
git clone https://github.com/indi256s/kuuki.git
cd kuuki
pnpm install

# Configure environment
cp apps/web/.env.example apps/web/.env
# Then fill in your Supabase credentials (ask the project owner)
```

### Environment Variables

| Variable | Where | Description |
|---|---|---|
| `GEMINI_API_KEY` | Cloudflare `.dev.vars` | Google Gemini API key (for AI import + aircraft enrichment) |
| `AUTH_SECRET` | Cloudflare `.dev.vars` / `wrangler pages secret put` | Pepper/HMAC key for password hashing (required; auth fails closed if unset) |

### Run

```bash
pnpm dev        # Start dev server at http://localhost:5173
pnpm build      # Production build
pnpm test       # Run tests
```

---

## Contributing

1. Create a branch from `main`
2. Make your changes
3. Run `pnpm build` to ensure no type errors
4. Open a PR against `main`

### Useful Docs

Start with `docs/README.md` for the full index:

- `docs/PRD.md` — Product requirements
- `docs/APP_FLOW.md` — User navigation paths
- `docs/FRONTEND_GUIDELINES.md` — Design system and component patterns
- `docs/BACKEND_STRUCTURE.md` — Database schema and RLS policies

---

## License

MIT © [Indi256](https://github.com/indi256)
