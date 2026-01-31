# Phase 6: Polish

**Status:** Pending
**Depends on:** Phase 5 complete

## Tasks

### Dark Mode Toggle

**Options:** Light / Dark / System

**Storage:** `profiles.theme` field

**Implementation:**
- Tailwind dark mode classes
- System preference detection
- Persistent user choice

### Mobile Responsiveness

**Skill:** `/interface-design:audit`, `/cloudflare:web-perf`
**MCP:** `playwright`

**Approach:** Distinct layouts (not just scaling)

**Desktop:**
- Left sidebar navigation
- Table view for flight list

**Mobile:**
- Bottom tab bar (5 items)
- Card view for flight list
- Collapsible sections

**Testing:**
- Core Web Vitals audit (FCP, LCP, TBT, CLS)
- Mobile viewport testing with Playwright
- Responsive breakpoint review

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
- [ ] Dark mode: Toggle theme, verify persistence
- [ ] i18n: Switch to Russian, verify translations
- [ ] CSV export: Download flight data, verify format
- [ ] Mobile: Test all views on mobile viewport
- [ ] Error states: Trigger errors, verify messages
