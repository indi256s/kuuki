# CLAUDE.md - Kuuki Development Guide

This is the main pet project for indi256 - a personal flight tracking app.

## Quick Reference

```bash
cd ~/kuuki
pnpm install    # Install dependencies
pnpm dev        # Start dev server (usually port 5173)
pnpm build      # Production build
pnpm test       # Run tests
```

## Project Structure

- `apps/web/` - React + Vite frontend
- `packages/shared/` - Shared types, i18n translations (en.json, ru.json)
- `packages/data/` - Static reference data (airports, airlines, aircraft)
- `functions/` - Cloudflare Workers API
- `supabase/` - Database migrations
- `docs/` - Specs and implementation plans

## i18n

Translations are in `packages/shared/src/i18n/`:
- `en.json` - English (primary)
- `ru.json` - Russian

Always add keys to both files when adding new UI text.

## Component Locations

Key component directories in `apps/web/src/components/`:
- `auth/` - Login, signup, invite code
- `dashboard/` - Main dashboard, EmptyState
- `flights/` - Flight list, details, add/edit forms
- `import/` - ImportUpload, ImportReview (AI parsing)
- `landing/` - Public landing page
- `map/` - Route visualization
- `onboarding/` - First-time user flow

## Design System

Uses Tailwind with semantic color tokens:
- `ink`, `ink-muted`, `ink-faint`, `ink-inverse` - Text colors
- `sky-raised`, `sky-sunken` - Surface colors
- `edge`, `edge-strong` - Border colors
- `runway`, `runway-hover`, `runway-muted` - Primary accent
- `emergency`, `emergency-muted` - Error states

## Documentation

Check `docs/` for implementation plans and specs before starting new features.
