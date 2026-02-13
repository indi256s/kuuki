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
- `docs/` - Canonical documentation (PRD, APP_FLOW, TECH_STACK, etc.)

## i18n

Translations are in `packages/shared/src/i18n/`:
- `en.json` - English (primary)
- `ru.json` - Russian

**Always add keys to both files when adding new UI text.**

**Pluralization:**
Use i18next plural suffixes for count-based translations:
- English: `key_one`, `key_other` (e.g., "1 flight" vs "2 flights")
- Russian: `key_one`, `key_few`, `key_other` (e.g., "1 полёт", "2 полёта", "5 полётов")

See `docs/I18N_GUIDE.md` for detailed pluralization rules and examples.

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

**Direction:** Warm Japanese Minimalism — Modern travelers analyzing their life data

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

**Full design system:** `docs/FRONTEND_GUIDELINES.md`

## Adding Components

```bash
# Add a new shadcn component
cd apps/web
npx shadcn@latest add accordion

# View available components
npx shadcn@latest view @shadcn
```

## Documentation

Start with `docs/README.md` for the full index. Key documents:

- `docs/PRD.md` - Product requirements and philosophy
- `docs/APP_FLOW.md` - User navigation paths
- `docs/TECH_STACK.md` - Dependencies with exact versions
- `docs/FRONTEND_GUIDELINES.md` - Design system, components, patterns
- `docs/BACKEND_STRUCTURE.md` - Database schema, RLS, API
- `docs/PLAN.md` - Implementation roadmap and status

## Skills (for AI Agents)

Reusable skills are in `docs/skills/`. Key skills for Kuuki development:

| Skill | Purpose |
|-------|---------|
| `frontend-design` | High-quality UI with distinctive aesthetics |
| `glados-copy` | UI copy with GLaDOS persona variants |
| `webapp-testing` | Test strategies and Playwright automation |
| `brand-guidelines` | Consistent branding and visual identity |
| `canvas-design` | Visual design generation |
| `nano-banana-pro` | Image generation via Gemini |

Use these in Claude Code via `/skill-name` or in Antigravity by referencing `docs/skills/<name>/SKILL.md`.

## Feature Completion Checklist

**REQUIRED:** After completing any feature or phase, always update documentation as the final step:

1. ✅ Implementation complete and tested
2. ✅ Code committed with descriptive message
3. ✅ **Update `docs/PLAN.md`** — Mark phase/feature status in the table
4. ✅ **Update `docs/tasks/phase-X.md`** — Check off completed items, add implementation notes
5. ✅ Commit documentation changes separately (`docs: Mark Phase X as complete`)
6. ✅ Push to remote

**Why:** `PLAN.md` is the single source of truth for project status. Keeping it synchronized ensures anyone (human or agent) can quickly understand what's done and what's pending.
