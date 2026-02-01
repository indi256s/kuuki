# CLAUDE.md - Kuuki Development Guide

This is the main pet project for indi256 - a personal flight tracking app.

## Quick Reference

```bash
cd ~/kuuki
pnpm install    # Install dependencies
pnpm dev        # Start dev server (usually port 5173)
pnpm build      # Production build
pnpm test       # Run tests

# Add shadcn components
cd apps/web
npx shadcn@latest add <component>
```

## Project Structure

- `apps/web/` - React + Vite frontend
- `packages/shared/` - Shared types, i18n translations (en.json, ru.json)
- `packages/data/` - Static reference data (airports, airlines, aircraft)
- `functions/` - Cloudflare Workers API (Gemini proxy)
- `supabase/` - Database migrations
- `docs/` - Specs and implementation plans
- `.interface-design/` - Design system documentation

## i18n

Translations are in `packages/shared/src/i18n/`:
- `en.json` - English (primary)
- `ru.json` - Russian

Always add keys to both files when adding new UI text.

## Component Locations

Key component directories in `apps/web/src/components/`:
- `ui/` - **shadcn/ui components** (Button, Card, Dialog, Input, etc.)
- `auth/` - Login, signup, invite code
- `dashboard/` - Main dashboard, StatsCards, EmptyState
- `flights/` - Flight list, details, add/edit forms
- `import/` - ImportUpload, ImportReview (AI parsing)
- `landing/` - Public landing page
- `map/` - Route visualization
- `onboarding/` - First-time user flow
- `common/` - Shared components (WindLoader)

## Design System

**Direction:** Nordic Skies — Scandinavian minimalism

**UI Library:** shadcn/ui (New York style)

**Typography:**
- Display/Body: DM Sans
- Data/Mono: JetBrains Mono

**Color System (OKLCH):**

Uses both shadcn tokens and legacy Kuuki tokens:

| shadcn | Legacy | Use |
|--------|--------|-----|
| `primary` | `runway` | Primary actions, links |
| `foreground` | `ink` | Body text |
| `muted-foreground` | `ink-muted` | Secondary text |
| `background` | `sky` | Page background |
| `card` | `sky-raised` | Card backgrounds |
| `border` | `edge` | Borders |
| `destructive` | `emergency` | Error states |

**Animation Utilities:**
- `animate-fade-up` - Entrance animation
- `stagger-children` - Auto-delay for lists
- `group-hover:scale-110` - Icon hover effect

**Full design system:** `.interface-design/system.md`

## Adding Components

```bash
# Add a new shadcn component
cd apps/web
npx shadcn@latest add accordion

# View available components
npx shadcn@latest view @shadcn
```

## Documentation

- `docs/PLAN.md` - Implementation roadmap and phase status
- `docs/SPEC.md` - Product requirements
- `docs/tasks/` - Per-phase task lists
- `.interface-design/system.md` - Design tokens and patterns
