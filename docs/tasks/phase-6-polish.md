# Phase 6: Polish

**Status:** In Progress
**Depends on:** Phase 5 complete

## Tasks

### Dark Mode Toggle ✅

**Options:** Light / Dark / System

**Storage:** localStorage (`kuuki-theme` key)

**Implementation:**
- ✅ Tailwind dark mode classes (full OKLCH palette)
- ✅ System preference detection
- ✅ Persistent user choice (localStorage)
- ✅ 3-way dropdown switcher (Light / Dark / System)
- ✅ i18n translations (EN/RU)

### Mobile Responsiveness

**Skill:** `/interface-design:audit`, `/cloudflare:web-perf`
**MCP:** `playwright`

**Approach:** Distinct layouts (not just scaling), broken into 4 sub-phases.

#### Phase 6a: Core Navigation ✅

**Breakpoint:** 640px (sm:) separates mobile and desktop

**New Components:**
- `MobileTabBar.tsx` — Bottom tab bar with 5 tabs (Dashboard, Flights, Import, Passport, Profile)
- `MobileHeader.tsx` — Minimal sticky header with logo + action slot
- `FloatingActionButton.tsx` — 56x56px FAB for primary actions

**CSS Utilities Added:**
- `pb-safe` — Bottom padding for tab bar + safe area
- `h-tab-bar` — Tab bar height (64px + safe area)
- `bottom-safe-fab` — FAB positioning above tab bar

**Route Pages Updated:**
- All 6 protected routes now have mobile header, tab bar, and safe padding
- Desktop headers hidden on mobile via `hidden sm:block`
- Profile tab dynamically links to `/fly/{username}`

**i18n Keys Added:**
- `nav.home`, `nav.addFlight` in EN/RU

#### Phase 6b: Flight Management ✅

**New Components:**
- `FlightCardActions.tsx` — Overflow menu for Edit/Delete actions
- `useIsMobile.ts` — Viewport detection hook with matchMedia
- `useKeyboardHeight.ts` — Virtual keyboard height detection for bottom sheets

**Changes:**
- CSS-only card/table switch at 640px breakpoint (no JS hydration flash)
- FlightForm uses Sheet (bottom drawer) on mobile, Dialog on desktop
- Sheet component enhanced with keyboard-aware max-height adjustment
- FlightCard redesigned with 2-line route hero and overflow menu
- FlightList with responsive table headers (hidden on mobile)

#### Phase 6c: Content Pages ✅

**New Components:**
- `CollapsibleCard.tsx` — Reusable card with expand/collapse trigger
- `MapCollapsible.tsx` — Dashboard map preview → fullscreen dialog
- `ProfileMiniHeader.tsx` — Sticky mini-header that appears on scroll
- `ProfileSection.tsx` — Collapsible wrapper for profile sections
- `CountryListSheet.tsx` — Mobile sheet with letter accordion (A-C, D-F, etc.)
- `accordion.tsx`, `collapsible.tsx` — shadcn primitives added

**Route Changes:**
- Dashboard: MapCollapsible on mobile, inline map on desktop
- Profile: Mini-header + collapsible sections with IntersectionObserver scroll detection
- Passport: CountryListSheet on mobile, Dialog on desktop
- CountryGeekTier: Vertical stack on mobile with compact progress bars

**i18n Keys Added:**
- `dashboard.routeMap`, `dashboard.tapToExpand`
- `passport.claimHint`
- `leaderboard.rankingsEmpty`
- `badges.empty`

#### Phase 6d: Polish & Performance ✅

- ✅ Touch target audit (44px minimum via `@media (pointer: coarse)`)
- ✅ Removed xs/sm button variants for WCAG 2.5.5 compliance
- ✅ Added `--duration-micro: 100ms` token for micro-interactions
- ✅ Added `@media (prefers-reduced-motion: reduce)` to eliminate all animations
- ✅ Updated lg button size from 40px to 44px
- ✅ Created Lighthouse audit checklist (`docs/LIGHTHOUSE-CHECKLIST.md`)
- ❌ Playwright viewport tests (skipped — manual testing sufficient)

**Manual Testing Required:**
- Run Lighthouse on Landing, Dashboard, Flights, Passport pages
- Target scores: Performance >90, Accessibility >95, Best Practices >90, SEO >90
- Test touch targets on mobile device or Chrome DevTools emulation
- Test reduced motion with OS accessibility setting enabled

### Error Handling

**Skill:** `/interface-design`

**Tone:** Aviation-themed messages

**Examples:**
- "Flight log delayed on the tarmac. We're working to clear it for takeoff."
- "Looks like we hit some turbulence. Please try again."
- "Your connection was lost. Attempting to reconnect..."

**Implementation:**
- Per-route error boundaries
- Toast notifications for recoverable errors
- Full-page error state for critical failures

### CSV Export

**Format:** Standard CSV with all flight fields

**Fields:**
```csv
date,origin,destination,airline,aircraft,flight_number,distance_km,duration_minutes,source
```

### Account Deletion

**Style:** GDPR-compliant

**Flow:**
1. User clicks "Delete Account" in settings
2. Confirmation dialog with consequences
3. Type username to confirm
4. Hard delete all user data

### Design System Finalization

**Skill:** `/interface-design:init`, `/interface-design:audit`

**Tasks:**
- Establish design tokens (colors, spacing, typography)
- Document component patterns
- Consistency audit across all pages
- Create theme variations (3 colorful themes)

### CI/CD Pipeline

**Skill:** `/cloudflare:wrangler`
**MCP:** `cloudflare-workers-builds`

**GitHub Actions workflow:**

```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  build:
    steps:
      - Lint (pnpm lint)
      - Type-check (pnpm typecheck)
      - Test (pnpm test)
      - Deploy preview (PR) / production (main)
```

## Files to Create/Update

```
apps/web/src/
├── components/
│   ├── ui/
│   │   └── ErrorBoundary.tsx
│   ├── settings/
│   │   ├── ThemeToggle.tsx
│   │   ├── DeleteAccount.tsx
│   │   └── ExportData.tsx
│   └── layout/
│       ├── MobileNav.tsx
│       └── DesktopSidebar.tsx
└── styles/
    └── themes/

.github/
└── workflows/
    └── ci.yml
```

## Verification

From SPEC.md checklist:
- [x] Dark mode: Toggle theme, verify persistence
- [ ] i18n: Switch to Russian, verify translations
- [ ] CSV export: Download flight data, verify format
- [x] Mobile 6a: Bottom tab bar, mobile header, FAB on Flights page
- [x] Mobile 6b: Card/table switch, bottom drawer forms, keyboard-aware resize
- [x] Mobile 6c: Map collapsible, country sheet, profile sections, vertical stats
- [x] Mobile 6d: Touch targets (44px), reduced motion, Lighthouse checklist created
- [ ] Error states: Trigger errors, verify messages
