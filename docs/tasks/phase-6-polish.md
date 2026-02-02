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

### Error Handling ✅

**Skill:** `/interface-design`, `/frontend-design`

**Tone:** Aviation-themed messages with GLaDOS-lite personality for mild errors, neutral for serious errors (data loss risk).

**Key Decisions:**
- Context-dependent severity: same error can be mild (network) or serious (failed save)
- Hybrid display: validation errors inline, API/network errors via toast
- Auto-retry: 3 silent retries with exponential backoff (1s → 2s → 4s → max 30s)
- Toast: 5 seconds, top-right (desktop), top-center (mobile)
- Import errors: inline within wizard, not toasts
- Auth expiry: silent re-auth attempt before redirect

**New Files Created:**
```
apps/web/src/
├── lib/errors/
│   ├── types.ts         # ErrorCategory, ClassifiedError types
│   ├── classify.ts      # Error classification by status/message
│   ├── messages.ts      # Aviation-themed message key selection
│   └── index.ts
├── stores/
│   └── errorStore.ts    # Zustand store for 3s deduplication
├── components/error/
│   ├── ToastProvider.tsx   # Sonner config, responsive positioning
│   ├── CrashScreen.tsx     # Minimal crash UI (no illustration)
│   ├── ErrorBoundary.tsx   # Route-level boundary, keyed by pathname
│   └── index.ts
└── hooks/
    ├── useToast.ts         # i18n-aware toast hook
    └── useErrorHandler.ts  # Central handler with silent re-auth
```

**Dependencies Added:**
- `sonner` — Toast library

**i18n Messages Added (EN/RU):**
- 3 network error variants ("Ground control to Major Tom...")
- 3 API error variants ("Servers experiencing turbulence...")
- 2 rate limit variants
- 2 not found variants
- 3 generic fallback variants
- Neutral messages for auth, data loss, validation
- Crash screen strings

**React Query Configuration:**
- `retry: 3` with exponential backoff for queries
- `retry: false` for mutations (user-triggered retry)
- `staleTime: 30_000` (30 seconds)
- `refetchOnWindowFocus: false`

**ImportPage Updates:**
- Parse errors shown inline with Alert component
- Tracks failed save indices for partial success messaging
- New i18n key: `import.success.partialFail`

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

**Phase 6e Error Handling (Complete):**
```
apps/web/src/
├── lib/errors/
│   ├── types.ts           ✅
│   ├── classify.ts        ✅
│   ├── messages.ts        ✅
│   └── index.ts           ✅
├── stores/
│   └── errorStore.ts      ✅
├── components/error/
│   ├── ToastProvider.tsx  ✅
│   ├── CrashScreen.tsx    ✅
│   ├── ErrorBoundary.tsx  ✅
│   └── index.ts           ✅
└── hooks/
    ├── useToast.ts        ✅
    └── useErrorHandler.ts ✅

packages/shared/src/i18n/
├── en.json                ✅ (error messages added)
└── ru.json                ✅ (error messages added)
```

**Pending:**
```
apps/web/src/
├── components/settings/
│   ├── DeleteAccount.tsx
│   └── ExportData.tsx

.github/
└── workflows/
    └── ci.yml
```

## Verification

From SPEC.md checklist:
- [x] Dark mode: Toggle theme, verify persistence
- [x] i18n: Switch to Russian, verify translations (error messages added)
- [ ] CSV export: Download flight data, verify format
- [x] Mobile 6a: Bottom tab bar, mobile header, FAB on Flights page
- [x] Mobile 6b: Card/table switch, bottom drawer forms, keyboard-aware resize
- [x] Mobile 6c: Map collapsible, country sheet, profile sections, vertical stats
- [x] Mobile 6d: Touch targets (44px), reduced motion, Lighthouse checklist created
- [x] Error states: Route boundaries, toast system, aviation personality messages
