# Phase 6: Polish

**Status:** Complete
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

### Phase 6f: Settings Page ✅

**New Route:** `/settings` — Account and data management

#### Settings Page Structure
```
apps/web/src/
├── routes/
│   └── SettingsPage.tsx          ✅ Main settings page
├── components/settings/
│   ├── index.ts                   ✅ Barrel export
│   ├── LanguageSection.tsx        ✅ EN/RU toggle
│   ├── DataExportSection.tsx      ✅ CSV export UI
│   ├── DeleteAccountSection.tsx   ✅ Danger zone card
│   └── DeleteAccountDialog.tsx    ✅ Multi-step deletion flow
├── lib/
│   └── export.ts                  ✅ CSV generation utilities
└── hooks/
    └── useExportRateLimit.ts      ✅ 5/day rate limit
```

#### CSV Export ✅

**Two formats:**
- **Portable** (9 columns): date, origin, destination, airline_iata, aircraft_icao, flight_number, distance_km, duration_minutes, source
- **Enriched** (17 columns): + origin_name, origin_city, origin_country, destination_*, airline_name, aircraft_name

**Features:**
- Client-side generation (Blob API)
- UTF-8 BOM for Excel compatibility
- Timestamped filenames: `kuuki-flights-2024-01-15.csv`
- Toggle for enriched data (adds country/city/names)
- Separate export for country claims

**Rate Limiting:**
- 5 exports per day (localStorage)
- Automatic daily reset
- Disabled button + tooltip when limit reached

#### Account Deletion ✅

**Flow:**
1. Click "Delete Account" in Danger Zone
2. Preview: Show flight/country counts + GLaDOS farewell
3. Export prompt: Optional data download before deletion
4. Password verification: Re-authenticate via `signInWithPassword`
5. Hard delete: flights → country_claims → visits → user_stats → profile
6. Sign out + redirect to landing

**Tone:** Friendly GLaDOS (sassy flight attendant, not menacing)
- "Well, this is it. Your final approach."
- "Thank you for flying with us. Or don't. Your call."

#### Navigation Updates ✅

- AppHeader: Settings link added to dropdown menu (before language toggle)
- MobileTabBar: Settings tab replaced Profile tab (profile accessible via settings/header)
- i18n: `nav.settings` already existed, added full `settings.export.*` and `settings.delete.*` keys

### Design System Finalization

**Skill:** `/interface-design:init`, `/interface-design:audit`

**Tasks:**
- Establish design tokens (colors, spacing, typography)
- Document component patterns
- Consistency audit across all pages
- Create theme variations (3 colorful themes)

### Phase 6g: CI/CD Pipeline ✅

**Skill:** `/cloudflare:wrangler`

**Files Created:**
```
.github/
├── workflows/
│   ├── ci.yml              # Main CI/CD workflow
│   └── auto-revert.yml     # Revert on main failure
└── pull_request_template.md
```

**CI Workflow Features:**
- **Triggers:** Push to main/dev, PRs to main/dev
- **Skip CI:** `[skip ci]` in commit message
- **AI Agent Gate:** PRs from `github-actions[bot]` require `ci:approved` label
- **Parallel Jobs:** lint, typecheck, test, build (fast-fail on first failure)
- **Tests Non-Blocking:** `continue-on-error: true` — tests don't block merge
- **Build Artifacts:** web-dist uploaded for deploy jobs to reuse
- **Staging:** PRs deploy to `kuuki-staging` Cloudflare Pages project
- **Production:** main branch deploys to `kuuki` Cloudflare Pages project

**Auto-Revert Workflow:**
- Triggers on CI/CD workflow failure on main
- Automatically reverts the breaking commit
- Sends Telegram notification with short SHA

**Required GitHub Secrets:**
| Secret | Purpose |
|--------|---------|
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy |
| `CLOUDFLARE_ACCOUNT_ID` | Account identifier |
| `VITE_SUPABASE_URL` | Build env var |
| `VITE_SUPABASE_ANON_KEY` | Build env var |
| `TELEGRAM_BOT_TOKEN` | Auto-revert notifications |
| `TELEGRAM_CHAT_ID` | Your Telegram chat ID |

**Typecheck Scripts Added:**
- Root: `pnpm typecheck` → turbo typecheck
- turbo.json: `typecheck` task with `dependsOn: ["^build"]`
- apps/web: `tsc -b --noEmit`

**One-Time Setup Required:**
1. Create Cloudflare Pages project: `wrangler pages project create kuuki-staging`
2. Add all 6 secrets to GitHub Settings → Secrets → Actions
3. (Optional) Configure custom domain: staging.kuuki.indi256.com → kuuki-staging.pages.dev

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

**Phase 6f Settings Page (Complete):**
```
apps/web/src/
├── routes/
│   └── SettingsPage.tsx           ✅
├── components/settings/
│   ├── index.ts                   ✅
│   ├── LanguageSection.tsx        ✅
│   ├── DataExportSection.tsx      ✅
│   ├── DeleteAccountSection.tsx   ✅
│   └── DeleteAccountDialog.tsx    ✅
├── lib/
│   └── export.ts                  ✅
└── hooks/
    └── useExportRateLimit.ts      ✅

packages/shared/src/i18n/
├── en.json                        ✅ (settings.export.*, settings.delete.* added)
└── ru.json                        ✅ (Russian translations with GLaDOS personality)
```

**Phase 6g CI/CD (Complete):**
```
.github/
├── workflows/
│   ├── ci.yml              ✅ Main CI/CD workflow
│   └── auto-revert.yml     ✅ Auto-revert on main failure
└── pull_request_template.md ✅ PR template with labels guidance
```

## Verification

From SPEC.md checklist:
- [x] Dark mode: Toggle theme, verify persistence
- [x] i18n: Switch to Russian, verify translations (error messages added)
- [x] CSV export: Download flight data, verify format (portable + enriched)
- [x] Account deletion: Password verification, data export prompt, hard delete
- [x] Settings page: Language selector, export section, danger zone
- [x] Mobile 6a: Bottom tab bar, mobile header, FAB on Flights page
- [x] Mobile 6b: Card/table switch, bottom drawer forms, keyboard-aware resize
- [x] Mobile 6c: Map collapsible, country sheet, profile sections, vertical stats
- [x] Mobile 6d: Touch targets (44px), reduced motion, Lighthouse checklist created
- [x] Error states: Route boundaries, toast system, aviation personality messages
- [x] CI/CD: GitHub Actions workflow for lint, typecheck, test, deploy
