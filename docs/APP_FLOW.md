# Kuuki - Application Flow

> **For AI Agents:** This documents every page and navigation path. Use this to understand how users move through the app.

---

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
         │ Enter: email, password, invite code
         │ Invite code validated on blur
         │
         ▼
    ┌─────────┐
    │ Valid?  │
    └────┬────┘
     No  │  Yes
    ┌────┴────┐
    ▼         ▼
┌───────┐  ┌─────────────────┐
│ Error │  │  /onboarding    │
│ Toast │  │  Username Picker │
└───────┘  └────────┬────────┘
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
**Error States:** Invalid invite code, email already exists
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
