# Phase 1.5: Onboarding & Landing

**Status:** ✅ Complete
**Depends on:** Phase 1 complete

## Summary

Implemented pre-login experience (showcase modal, landing page) and post-login onboarding (username picker, import CTA, empty states).

## User Flow

```
First visit → Showcase Modal (3 slides) → Landing Page → Auth → Username Picker → Import CTA → Dashboard
                    ↓ skip/complete              ↓                    ↓ has username
              localStorage saved           Sign In/Up              Skip to Dashboard
```

## Implementation

### Files Created

**Hooks:**
- `apps/web/src/hooks/useShowcase.ts` - localStorage management for `kuuki-showcase-seen`

**Onboarding Components:**
- `apps/web/src/components/onboarding/ShowcaseModal.tsx` - 3-slide carousel with dots navigation
- `apps/web/src/components/onboarding/UsernamePicker.tsx` - Username input with live normalization
- `apps/web/src/components/onboarding/ImportCTA.tsx` - Import options (photo/manual/skip)
- `apps/web/src/components/onboarding/index.ts` - Barrel export

**Landing Components:**
- `apps/web/src/components/landing/HeroSection.tsx` - Hero with title, subtitle, CTA buttons
- `apps/web/src/components/landing/FeatureGrid.tsx` - 3 feature cards (Log, Stats, Compete)
- `apps/web/src/components/landing/index.ts` - Barrel export

**Dashboard Components:**
- `apps/web/src/components/dashboard/EmptyState.tsx` - Sample data preview with overlay CTA
- `apps/web/src/components/dashboard/index.ts` - Barrel export

**Routes:**
- `apps/web/src/routes/LandingPage.tsx` - Public landing page with showcase modal
- `apps/web/src/routes/OnboardingPage.tsx` - Post-login onboarding flow

**Data:**
- `apps/web/src/lib/sampleData.ts` - Sample flight data and formatting utilities

### Files Modified

- `apps/web/src/App.tsx` - Added `/` (LandingPage) and `/onboarding` routes
- `apps/web/src/components/ProtectedRoute.tsx` - Added onboarding redirect for users without username
- `apps/web/src/routes/DashboardPage.tsx` - Integrated EmptyState component
- `packages/shared/src/i18n/en.json` - Added landing/onboarding/emptyState translations
- `packages/shared/src/i18n/ru.json` - Added Russian translations

## Features

### Pre-login Modal Showcase (3 slides) ✅

| Slide | Content |
|-------|---------|
| 1 | "Log Your Journeys - Build your flight collection. Every takeoff, every landing, remembered." |
| 2 | "Discover Your Stats - Distance flown, countries visited, airlines collected. See your patterns." |
| 3 | "Compare & Share - Join the leaderboard. Share your aviation story with the world." |

- Skip button always visible
- Remembered in localStorage (`kuuki-showcase-seen`)
- Dot navigation for slide selection

### Landing Page ✅

- Hero section with title, subtitle, and CTAs
- Feature grid with 3 cards (Log, Stats, Compete)
- Language toggle (EN/RU)
- Clean aviation aesthetic using Dawn Departure design tokens

### Post-login Onboarding ✅

1. **Username picker** - Flexible format → normalized (e.g., "John Doe" → "john-doe")
   - Live normalization preview
   - Profile URL preview: `kuuki.app/@username`
   - Validation (3-30 chars, alphanumeric + hyphens)
2. **Import CTA** - "Import from Photo" / "Add Manually" / "Skip"

### Empty States ✅

- Sample data preview showing what dashboard would look like
- Faded sample stats and flight list
- Overlay card with "Your Journey Awaits" messaging
- Clear CTA to add first flight

## Translations Added

```
landing.hero.*        - Landing page hero section
landing.features.*    - Feature cards
onboarding.username.* - Username picker form
onboarding.import.*   - Import CTA options
emptyState.*          - Empty state messaging
```

Both EN and RU locales updated.

## Verification

- [x] Build passes: `pnpm build` successful
- [x] Tests pass: 26 tests passing
- [x] Showcase flow: Modal appears on first visit, skip works, localStorage persists
- [x] Landing page: Hero + features render, CTA buttons navigate correctly
- [x] Auth redirect: Sign In goes to `/auth`, success redirects to onboarding/dashboard
- [x] Username picker: Normalization works, saves to profile
- [x] Empty state: Dashboard shows sample preview when no flights
- [x] i18n: Toggle EN/RU works on all pages
