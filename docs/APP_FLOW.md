# Kuuki — Application Flow

## Current Next routes

The current app is [apps/next](../apps/next/src/app/), with server gates in
[gates.ts](../apps/next/src/server/gates.ts). The Vite inventory below is rollback
history. It does not describe the current navigation.

| Routes | Current behavior |
| --- | --- |
| `/` | Guest landing; authenticated members continue to Overview or unfinished onboarding. |
| `/signin`, `/signup` | Separate authentication forms; members use the same landing gate. |
| `/activation-request`, `/activate`, `/activate.html` | Generic activation request and restricted static token completion. The Worker owns static completion, including its recovery-host boundary. |
| `/forgot-password`, `/reset-password`, `/password-updated` | Generic recovery request, token-only password replacement and sign-in confirmation. |
| `/account-deleted` | Signed-out deletion confirmation. |
| `/onboarding?step=name`, `capture`, `reveal` | Name/profile setup, shared manual/upload/paste Capture, then truthful saved-flight feedback. A durable import `batch` can resume Capture. |
| `/overview` | Period totals, insights, upcoming/awaiting journeys and missing-aircraft recovery. |
| `/journal` | Paged flight log; search/filter/sort/page state belongs to this URL. |
| `/journal/[id]/edit`, `/add`, `/import` | Own-flight editing, manual Capture and resumable import Source/Progress/Review/Done. |
| `/passport` | Collection, region/detail sheets, claims/ground visits, awaiting arrivals and period-aware map. |
| `/passport/manage` | Retained places/aircraft helper; consolidation is a carried dependency. |
| `/fly/[username]` | Public profile for visitors or private owner profile; live visibility gates protect private records. |
| `/leaderboard` | Public eligible rankings; authenticated own rank/notifications follow the same eligibility policy. |
| `/settings` | Dirty-state-protected profile, privacy, appearance, export and reauthenticated deletion. |
| `/me` | Resolves to the own profile, unfinished Name step or sign-in. |
| `/dashboard`, `/flights`, `/journey`, `/landing` | Compatibility redirects to Overview, Journal, Overview and `/`. |

Member routes require an authenticated, named profile. Public profile and
leaderboard pages use the member shell for authenticated viewers and the brand
shell for guests. Desktop navigation is Overview / Journal / Passport /
Leaderboard, plus Add and account controls. Mobile tabs are Overview / Journal /
Add / Passport / Me. Header titles follow the current route.

The [Worker](../apps/next/worker.ts), [API handlers](../functions/api/) and
[release runbook](runbooks/2026-10-04-next-release-candidate.md) own runtime,
authentication and host contracts. No hosted acceptance is implied by this map.

## Current journeys

Guests see explicitly labeled sample Ticket/Stamp/profile content before signup.
Onboarding persists the profile before Capture; skipping continues to Overview.
Capture reuses normal save/import authorities and resumes durable batches. Reveal
uses canonical saved flights and newly published country acknowledgments;
upcoming-only saves show booked Tickets. Refresh without the original receipt
reports Saved without replaying historical stamps.

Import retains review rows and uncertain-save recovery. Published evidence
controls country stamps; pending publication is shown honestly. Journal Undo is
route-local: leaving before its timer cancels the scheduled deletion. Bulk Undo
restores rows without restoring the prior selection. These are current contracts,
not global-toast support.

Settings protects unsaved changes on links, history and unload. Deletion requires
password reauthentication and succeeds only after the server cascade. Activation
and recovery scrub tokens at the start of their early bootstrap; completion remains separate from
sign-in. Functional evidence and deferred visual/release gates are tracked in the
[redesign handoff](plans/2026-10-04-redesign-2.0-implementation-handoff.md).

## Legacy Vite flow reference

Everything below describes rollback and historical screen names.

## Screen Inventory


### Public Routes (No Auth Required)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | AuthPage | Sign in / sign up entry point |
| `/landing` | LandingPage | Marketing page for visitors |
| `/fly/:username` | ProfilePage | Public view of user stats |
| `/leaderboard` | LeaderboardPage | Global rankings |

### Protected Routes (Auth Required)

| Route | Component | Purpose |
|-------|-----------|---------|
| `/dashboard` | DashboardPage | Personal stats overview |
| `/flights` | FlightsPage | Full flight log |
| `/passport` | PassportPage | Country stamps visualization |
| `/import` | ImportPage | AI-powered flight import |
| `/settings` | SettingsPage | Account preferences |
| `/onboarding` | OnboardingPage | First-time user setup |

---

## Navigation Structure

### Desktop Navigation (Sidebar)

```
┌─────────────────────────────────┐
│  Kuuki                    [⚙️]  │
├─────────────────────────────────┤
│  Personal                        │
│    📊 Dashboard                  │
│    ✈️  Flights                   │
│    🛂 Passport                   │
├─────────────────────────────────┤
│  Explore                         │
│    🏆 Leaderboard               │
├─────────────────────────────────┤
│  Account                         │
│    👤 Profile                    │
│    ⚙️  Settings                  │
│    🚪 Sign Out                   │
└─────────────────────────────────┘
```

**Sidebar Behavior:** Collapsible with icons (user toggleable)

### Mobile Navigation (Bottom Tab Bar)

```
┌─────────────────────────────────────────────────┐
│                                                  │
│              [Content Area]                      │
│                                                  │
├─────────────────────────────────────────────────┤
│  📊      ✈️      [+]      🏆      👤            │
│ Home   Flights  Add    Board   Profile          │
└─────────────────────────────────────────────────┘
```

**Center FAB:** Prominent "Add Flight" button

---

## User Flows

### Flow 1: New User Registration

```
┌─────────────────┐
│   /landing      │  ← User discovers Kuuki
│   (optional)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│       /         │  ← Auth page (default)
│   Sign Up Tab   │
└────────┬────────┘
         │
         │ Enter: email, password
         │
         ▼
┌─────────────────┐
│  /onboarding    │
│  Username Picker │
└────────┬────────┘
         │
         │ Pick username (normalized)
         │
         ▼
┌─────────────────┐
│   /dashboard    │
│   (Empty State) │
└────────┬────────┘
         │
         │ User sees sample data preview
         │ CTAs: "Add Flight" or "Import"
         │
         ▼
┌────────────────────────┐
│ First flight added OR  │
│ First import complete  │
└────────────────────────┘
```

**Entry Points:** Direct URL, /landing CTA
**Exit Points:** /dashboard
**Error States:** Invalid email/password, email already exists
**Success State:** Profile created, redirected to dashboard

---

### Flow 2: Returning User Sign In

```
┌─────────────────┐
│       /         │
│   Sign In Tab   │
└────────┬────────┘
         │
         │ Enter: email, password
         │
         ▼
    ┌──────────────┐
    │ Credentials  │
    │   valid?     │
    └──────┬───────┘
       No  │  Yes
      ┌────┴────┐
      ▼         ▼
┌──────────┐  ┌─────────────────┐
│  Error   │  │   /dashboard    │
│  Toast   │  │   (With Stats)  │
└──────────┘  └─────────────────┘
```

**Session:** 30-day persistence
**Entry Points:** Direct URL, expired session redirect
**Exit Points:** /dashboard
**Error States:** Wrong password, account not found

---

### Flow 3: Add Flight Manually

```
┌─────────────────┐
│   /dashboard    │
│  or /flights    │
└────────┬────────┘
         │
         │ Click "+" or "Add Flight"
         │
         ▼
┌─────────────────────────────────────┐
│         Add Flight Modal            │
│ ┌─────────────────────────────────┐ │
│ │ Date:        [     📅     ]    │ │
│ │ From:        [ JFK ▼         ] │ │  ← Autocomplete
│ │ To:          [ LHR ▼         ] │ │  ← Autocomplete
│ │ Airline:     [ BA ▼          ] │ │  ← Autocomplete
│ │                                 │ │
│ │ [+ Add more details]           │ │  ← Progressive disclosure
│ │ ───────────────────────────────│ │
│ │ Aircraft:    [ 777 ▼         ] │ │  ← Optional
│ │ Flight #:    [              ] │ │  ← Optional
│ │ Departure:   [     ⏰     ]   │ │  ← Optional
│ │ Arrival:     [     ⏰     ]   │ │  ← Optional
│ └─────────────────────────────────┘ │
│                                      │
│        [ Cancel ]  [ Save ]          │
└─────────────────────────────────────┘
         │
         ▼
    ┌──────────────┐
    │  Duplicate   │
    │  detected?   │
    └──────┬───────┘
       Yes │  No
      ┌────┴────┐
      ▼         ▼
┌───────────┐  ┌─────────────────┐
│  Warning  │  │  Success Toast  │
│  Dialog   │  │  "Flight added" │
└─────┬─────┘  └────────┬────────┘
      │                 │
      │ User confirms   │
      ▼                 │
┌───────────┐           │
│   Save    │◄──────────┘
└─────┬─────┘
      │
      ▼
┌─────────────────┐
│  Stats Updated  │  ← Triggers refresh
│  Badges Checked │  ← Via DB trigger
└─────────────────┘
```

**Entry Points:** Dashboard FAB, Flights page button, Mobile center tab
**Exit Points:** Modal closes, back to originating page
**Error States:** Required field missing, invalid IATA code
**Success State:** Flight saved, stats updated, badge check triggered

---

### Flow 4: AI Import

```
┌─────────────────┐
│    /import      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│           Import Page               │
│                                     │
│   ┌───────────────────────────┐    │
│   │                           │    │
│   │   Drop file here or       │    │
│   │   click to browse         │    │
│   │                           │    │
│   │   📄 PDF  📷 Image  📝 Text│    │
│   │                           │    │
│   └───────────────────────────┘    │
│                                     │
│   ─── or paste text below ───       │
│   ┌───────────────────────────┐    │
│   │                           │    │
│   │  [Text area for paste]    │    │
│   │                           │    │
│   └───────────────────────────┘    │
│                                     │
│              [ Parse ]              │
└─────────────────────────────────────┘
         │
         │ File uploaded or text pasted
         │
         ▼
┌─────────────────────────────────────┐
│         Parsing State               │
│                                     │
│         ✈️ WindLoader Animation     │
│                                     │
│         "Reading file..."           │
│         "Extracting text..."        │
│         "Finding flights..."        │
│                                     │
└─────────────────────────────────────┘
         │
         ▼
    ┌──────────────┐
    │   Flights    │
    │   found?     │
    └──────┬───────┘
       No  │  Yes
      ┌────┴────┐
      ▼         ▼
┌───────────┐  ┌─────────────────────────────────────┐
│   Error   │  │          Review State               │
│   State   │  │                                     │
│           │  │  Found 3 flights:                   │
│ "No valid │  │                                     │
│  flights  │  │  ┌─ Flight 1 ─────────────────────┐│
│  found"   │  │  │ JFK → LHR  •  Jan 15, 2026     ││
│           │  │  │ British Airways  •  BA178       ││
│  [Try     │  │  │ Boeing 777-300ER               ││
│   again]  │  │  │ ⚠️ Low confidence on aircraft   ││
│           │  │  │              [Edit] [Remove]   ││
└───────────┘  │  └─────────────────────────────────┘│
               │                                     │
               │  ┌─ Flight 2 ─────────────────────┐│
               │  │ LHR → CDG  •  Jan 18, 2026     ││
               │  │ ...                             ││
               │  └─────────────────────────────────┘│
               │                                     │
               │       [ Cancel ]  [ Save All ]     │
               └─────────────────────────────────────┘
         │
         │ User edits if needed, clicks Save All
         │
         ▼
┌─────────────────┐
│  Batch Insert   │
│  Stats Updated  │
│  Badges Checked │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Success!      │
│  "3 flights     │
│   imported"     │
│                 │
│  [View Flights] │
└─────────────────┘
```

**Entry Points:** Dashboard CTA, Import nav item
**Exit Points:** /flights after success, stay on /import on error
**Error States:** Parse failed, no flights found, Gemini API error
**Success State:** Flights saved, redirect option shown

---

### Flow 5: View Flight Details

```
┌─────────────────┐
│    /flights     │
└────────┬────────┘
         │
         │ Desktop: Click row in table
         │ Mobile: Tap card in list
         │
         ▼
┌─────────────────────────────────────┐
│         Flight Detail Popover       │
│                                     │
│   JFK → LHR                         │
│   New York → London                 │
│                                     │
│   Date:       January 15, 2026      │
│   Airline:    British Airways       │
│   Flight:     BA178                 │
│   Aircraft:   Boeing 777-300ER      │
│   Distance:   5,539 km              │
│   Duration:   7h 15m                │
│                                     │
│   Source:     AI Import             │
│                                     │
│   [ Edit ]  [ Delete ]              │
└─────────────────────────────────────┘
         │
         │ User clicks Edit
         │
         ▼
┌─────────────────────────────────────┐
│         Edit Flight Modal           │
│   (Same as Add Flight, prefilled)   │
└─────────────────────────────────────┘
         │
         │ User clicks Delete
         │
         ▼
┌─────────────────────────────────────┐
│         Confirm Delete              │
│                                     │
│   "Delete this flight?"             │
│                                     │
│   ⚠️ This may affect your badges    │
│      and leaderboard rank.          │
│                                     │
│   [ Cancel ]  [ Delete ]            │
└─────────────────────────────────────┘
```

**Entry Points:** Flights table/list
**Exit Points:** Close popover, back to list
**Error States:** Flight not found (deleted elsewhere)
**Success State:** View only, or edit/delete completed

---

### Flow 6: Public Profile View

```
┌─────────────────────────────────────┐
│     Visitor (logged out or in)      │
└─────────────────┬───────────────────┘
                  │
                  │ Visits /fly/skywalker
                  │
                  ▼
┌─────────────────────────────────────┐
│         Public Profile              │
│                                     │
│   ┌─────┐                           │
│   │ 👤  │  skywalker                │
│   └─────┘  "Aviation enthusiast"    │
│                                     │
│   ┌─────────────────────────────┐  │
│   │ 127      42,847    23       │  │
│   │ Flights  km        Countries│  │
│   └─────────────────────────────┘  │
│                                     │
│   Badges:                           │
│   🏆 Centurion  🌍 Globe Trotter   │
│   ✈️ Fleet Master                   │
│                                     │
│   Rankings:                         │
│   Top 15% in countries              │
│   Top 8% in distance                │
│                                     │
│   ─────────────────────────────     │
│   [Compare with Me] (if logged in)  │
│                                     │
└─────────────────────────────────────┘
```

**What's Visible:**
- Username, display name, avatar, bio
- Aggregate stats (not individual flights)
- Badges earned
- Leaderboard percentiles

**What's NEVER Visible:**
- Individual flights
- Route map
- Passport stamps

**Entry Points:** Direct URL, leaderboard link, compare
**Exit Points:** Back navigation

---

### Flow 7: Compare Stats

```
┌─────────────────┐
│  /fly/:username │
│  (Other user)   │
└────────┬────────┘
         │
         │ Logged-in user clicks "Compare"
         │
         ▼
┌─────────────────────────────────────────────────┐
│              Compare View                       │
│                                                 │
│     You          vs       skywalker            │
│                                                 │
│   ┌──────────────────────────────────────────┐ │
│   │ Flights     [====== 85 vs 127 ========]  │ │
│   │ Distance    [======= 35k vs 42k =======] │ │
│   │ Countries   [==== 18 vs 23 ============] │ │
│   │ Airlines    [========= 12 vs 15 =======] │ │
│   │ Aircraft    [========= 8 vs 12 ========] │ │
│   └──────────────────────────────────────────┘ │
│                                                 │
│   [Show Curated] | [Show All Stats]            │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Default:** Curated (top 5 interesting)
**Toggle:** Full stats comparison
**Entry Points:** Public profile "Compare" button
**Exit Points:** Back to profile

---

### Flow 8: Leaderboard

```
┌─────────────────┐
│   /leaderboard  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│           Leaderboard               │
│                                     │
│   [ Flights | Distance | Countries ]│  ← Category tabs
│   [ Cities | Airlines ]             │
│                                     │
│   ───── Countries Ranking ─────     │
│                                     │
│   Your rank: Top 15%                │
│                                     │
│   ┌─────────────────────────────┐  │
│   │ 1.  skywalker     23 🇺🇸     │  │
│   │ 2.  jetsetterx    21 🇬🇧     │  │
│   │ 3.  aviator42     19 🇩🇪     │  │
│   │ ...                          │  │
│   │ ──── You're here ────        │  │
│   │ 12. you           18 🇺🇸     │  │
│   │ ...                          │  │
│   └─────────────────────────────┘  │
│                                     │
└─────────────────────────────────────┘
```

**Categories:** flights, distance, countries, cities, airlines
**Display:** Full rankings (percentile shown separately)
**Eligibility:** 10 flight minimum, opt-in required
**Entry Points:** Nav menu, profile rankings link

---

### Flow 9: Settings

```
┌─────────────────┐
│    /settings    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│           Settings                  │
│                                     │
│   ─── Appearance ───                │
│   Theme:     [Light|Dark|System]    │
│   Language:  [EN ▼]                 │
│                                     │
│   ─── Profile ───                   │
│   Display Name: [______________]    │
│   Bio:          [______________]    │
│   Visibility:   [Public|Private]    │
│   Leaderboards: [✓ Show me]         │
│                                     │
│   ─── Data ───                      │
│   [ Export CSV ]                    │
│                                     │
│   ─── Account ───                   │
│   [ Delete Account ]                │
│                                     │
└─────────────────────────────────────┘
```

**Actions:**
- Theme/language changes apply immediately
- Profile changes require save
- CSV export downloads file
- Delete account requires password confirmation

---

### Flow 10: Passport

```
┌─────────────────┐
│    /passport    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│              Nomad Passport                     │
│                                                 │
│   23 Countries  •  5 Continents  •  12%        │
│                                                 │
│   ┌─────────────────────────────────────────┐  │
│   │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │  │
│   │ │ 🇺🇸 │ │ 🇬🇧 │ │ 🇫🇷 │ │ 🇯🇵 │  ...   │  │
│   │ │ USA │ │ UK  │ │ FR  │ │ 日本 │        │  │
│   │ │ ×12 │ │ ×5  │ │ ×3  │ │ ×1  │        │  │
│   │ └─────┘ └─────┘ └─────┘ └─────┘        │  │
│   │                                         │  │
│   │ ┌─────┐ ┌─────┐ ┌─────┐                │  │
│   │ │ 🇩🇪 │ │ 🇮🇹 │ │ 🇪🇸 │  ...           │  │
│   │ └─────┘ └─────┘ └─────┘                │  │
│   └─────────────────────────────────────────┘  │
│                                                 │
│   [ + Add Country ]  (for ground travel)       │
│                                                 │
└─────────────────────────────────────────────────┘
         │
         │ User clicks stamp
         │
         ▼
┌─────────────────────────────────────┐
│         Stamp Popup                 │
│                                     │
│   🇯🇵 Japan (日本)                  │
│                                     │
│   First visit:  2 years ago         │
│   Last visit:   6 months ago        │
│   Total visits: 3                   │
│   Airports:     NRT, HND, KIX       │
│                                     │
│   Source:       Flight data         │
│                                     │
└─────────────────────────────────────┘
         │
         │ User clicks "Add Country"
         │
         ▼
┌─────────────────────────────────────┐
│       Claim Country Modal           │
│                                     │
│   Search: [_______________🔍]       │
│                                     │
│   ┌─────────────────────────────┐  │
│   │                             │  │
│   │   [ Interactive Map ]       │  │
│   │   Click country to select   │  │
│   │                             │  │
│   └─────────────────────────────┘  │
│                                     │
│   Selected: Thailand 🇹🇭            │
│   Entry method: [Land ▼]            │
│   Year: [2024 ▼] (optional)         │
│   Note: [_____________] (optional)  │
│                                     │
│   [ Cancel ]  [ Claim ]             │
└─────────────────────────────────────┘
```

**Privacy:** Always private (not on public profile)
**Entry Points:** Nav menu
**Exit Points:** Nav to other pages

---

## Error Handling Patterns

### Toast Notifications

```
Success: ✈️ "Flight added successfully"
Warning: ⚠️ "This looks like a duplicate"
Error:   ❌ "Flight log delayed on the tarmac"
```

**Aviation-themed personality:**
- "That route doesn't exist in our flight plan"
- "Connection lost. We're working on rerouting"

### Error Boundaries

Each route has its own error boundary. Errors don't crash the entire app.

### Network Errors

- Auto-retry with exponential backoff
- Clear error messages with retry button
- Offline: "No connection. Try again when online"

---

## Responsive Behavior

| Component | Desktop | Mobile |
|-----------|---------|--------|
| Navigation | Left sidebar | Bottom tab bar |
| Flight list | Data table | Card list |
| Add flight | Modal | Full-screen sheet |
| Filters | Horizontal row | Bottom sheet |
| Profile | Full width | Stacked sections |

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [PRD.md](./PRD.md) | Product requirements and features |
| [FRONTEND_GUIDELINES.md](./FRONTEND_GUIDELINES.md) | UI patterns and components |
