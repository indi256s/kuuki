# Kuuki - Product Requirements Document

> **For AI Agents:** This is your contract. Read this to understand exactly what "done" looks like.

---

## Overview

| Attribute | Value |
|-----------|-------|
| **Name** | Kuuki (display as "Kuuki" only, hiragana くうき for branding only) |
| **Domain** | kuuki.indi256.com |
| **Tagline** | A flight stats vault for aviation enthusiasts |
| **Scale** | 50-500 users (first 6 months) |
| **Status** | Feature-complete MVP, open beta |

### What Kuuki Is

A personal flight tracking app for aviation enthusiasts. Log journeys, build your collection, discover patterns, compare with others.

### What Kuuki Is NOT

- Not a social network (no following, no activity feeds)
- Not a booking tool (no flight search, no prices)
- Not a loyalty program tracker (no miles, no elite status)
- Not a travel planning app (no trip planning, no itineraries)

---

## Target Users

### Primary Persona

**Aviation enthusiast who flies 5-50 times per year.**

Characteristics:
- Cares deeply about flight history
- Enjoys stats, experiments, and a bit of chaos
- Values both function and personality
- Wants to track and compare, but values privacy

### Emotional Goals

| Goal | Example |
|------|---------|
| Pride in collection | "Look at all these flights" |
| Curiosity about patterns | "I had no idea I flew that much distance" |
| Friendly competition | "Top 15% of countries visited" |
| Nostalgia | "My first international flight was 8 years ago" |

### NOT Optimizing For

- Daily engagement (this isn't social media)
- Viral growth (quality community over quantity)
- Monetization (personal project)

---

## Core Philosophy

### Privacy: Private by Default, Public by Choice

| Data type | Visibility | Rationale |
|-----------|------------|-----------|
| Individual flights | Always private | Personal travel history is sensitive |
| Route map | Always private | Visual travel patterns reveal too much |
| Aggregate stats | User choice | Numbers are less identifying than routes |
| Badges earned | Public if profile public | Achievements are meant to be shared |
| Passport stamps | Always private | Personal travel visualization only |

**Hard Rules:**
- NEVER show individual flight details on public profiles
- NEVER show the map visualization publicly
- ALWAYS require explicit opt-in for leaderboard participation
- ALWAYS let users make their entire profile private

### Gamification: Celebrate, Don't Manufacture Anxiety

**What we DO:**
- Award badges for genuine milestones (first flight, 100 flights, circumnavigator distance)
- Show percentile rankings ("Top 15%") instead of exact positions
- Use duration milestones (hours in air) as progress markers
- Display only earned badges — never locked ones

**What we DON'T do:**
- NO daily streaks (creates anxiety, punishes breaks)
- NO progress bars toward next badge (creates pressure)
- NO "X more flights to unlock..." prompts
- NO exact leaderboard rankings (intimidating)
- NO push notifications for engagement

### Anti-Gaming: Community Trust Over Fraud Detection

- Public profiles + reporting
- Gaming becomes obvious at small scale
- Don't build complex fraud detection for 50-500 users

---

## Features

### 1. Flight Logging

**Core Fields (Required):**
| Field | Type | Notes |
|-------|------|-------|
| date | DATE | Flight date |
| origin | TEXT | IATA code (3 letters) |
| destination | TEXT | IATA code (3 letters) |
| airline_iata | TEXT | Required for every flight |

**Optional Fields:**
| Field | Type | Notes |
|-------|------|-------|
| aircraft_icao | TEXT | Leave blank if unknown |
| flight_number | TEXT | |
| departure_utc | TIMESTAMPTZ | Stored as UTC |
| arrival_utc | TIMESTAMPTZ | Stored as UTC |

**Computed Fields:**
| Field | Calculation |
|-------|-------------|
| distance_km | Great circle × 1.10 (typical routing) |
| duration_minutes | Per-aircraft estimates if times not provided |

**Success Criteria:**
- [ ] User can add flight with required fields in < 30 seconds
- [ ] Autocomplete shows airports/airlines/aircraft with code + name
- [ ] Duplicate detection warns but allows override
- [ ] Future flights show countdown timers

### 2. AI Import (Gemini)

**Supported Formats:**
- PDF (boarding passes, itineraries)
- Screenshots (any image with flight info)
- Plain text (copy-pasted flight info)

**Processing Flow:**
1. Upload → Preview (user confirms before parsing)
2. Gemini OCR extracts text
3. Gemini semantic parsing + enrichment
4. Results shown in single scrollable list
5. User reviews, edits inline, saves all at once

**AI Behavior Rules:**
| Rule | Details |
|------|---------|
| Allow inferences | Infer airline from flight number format |
| Enrichment scope | Airline + aircraft data only |
| No personal data | Never extract loyalty numbers, seat assignments |
| User confirmation | ALWAYS require human review before saving |

**Success Criteria:**
- [ ] User can import boarding pass PDF with 90%+ accuracy
- [ ] All extracted data shown with confidence indicators
- [ ] Inline editing for corrections
- [ ] Batch save creates flights atomically

### 3. Dashboard

**Layout Priority:**
1. Big numbers: total flights, distance, countries, airlines
2. Route map below (private, owner-only)
3. Recent flights list

**Empty State:**
- Show sample data preview
- "This could be you" messaging
- Clear CTAs: "Add Flight" and "Import"

**Success Criteria:**
- [ ] Stats update immediately after adding flight
- [ ] Map shows all flight routes with arcs
- [ ] Empty state guides new users effectively

### 4. Stats System

**Progressive Unlock Tiers:**

| Tier | Unlock Criteria | Focus |
|------|-----------------|-------|
| Overview | Always visible | Flights, countries, distance, airlines |
| Avia Geek | 5+ aircraft types | Aircraft, manufacturers, widebody vs narrowbody |
| Country Geek | 5+ countries | Continents, regions, world completion % |
| Time Geek | 10+ flights | Hours in air, longest flight, departure patterns |

**Fun Facts Framing:**
- "Distance to the Moon: 42% complete" (384,400 km)
- "You've flown X.X trips around Earth" (40,075 km each)
- "Time in air: X days, Y hours"
- "You've visited X% of all countries" (195 UN members)

**Success Criteria:**
- [ ] Tier unlocks trigger celebration toast
- [ ] Stats cards animate on load
- [ ] Units always in kilometers

### 5. Passport Feature

**Overview:** Personal "Nomad Passport" at `/passport` with country stamps.

**Data Sources:**
1. Flight data (auto-derived from airport countries)
2. Manual claims (for ground travel)

**Stamp Design:**
| Element | Implementation |
|---------|----------------|
| Shape | Circle for Asia, rectangle for others |
| Colors | Flag colors as border/accent |
| Text | Native script name + English name |
| Date | Relative format ("2 years ago") |
| Visit count | Ink-stamped corner (×5) |

**Success Criteria:**
- [ ] Countries from flights appear automatically
- [ ] Manual claims support land/sea entry methods
- [ ] Stamp click shows detailed popup
- [ ] Always private (not on public profile)

### 6. Social Features

**Public Profiles (`/fly/{username}`):**
- Username, display name, avatar, bio (140 chars)
- Aggregate stats: flights, distance, countries, cities, airlines
- Badges earned
- Leaderboard percentile rankings
- NEVER: individual flights or route map

**Leaderboards:**
| Category | Metric |
|----------|--------|
| countries | Unique countries visited |
| cities | Unique cities visited |
| flights | Total flight count |
| distance | Total km flown |
| airlines | Unique airlines |

- Display: Percentile only ("Top 15%")
- Eligibility: 10 flight minimum
- Opt-in required: `show_on_leaderboards` setting

**Compare Feature:**
- Default: Curated comparison (top 5 most interesting stats)
- Optional: Full side-by-side tables

**Success Criteria:**
- [ ] Public profiles load without authentication
- [ ] Map and individual flights never shown publicly
- [ ] Leaderboard respects opt-in setting

### 7. Badges

**20 Badges Across 6 Categories:**

| Category | Examples |
|----------|----------|
| Milestones | First Flight, Frequent Flyer (50), Centurion (100) |
| Explorer | Arctic Circle, Equator Hopper, Island Collector |
| Collector | Fleet Master (20 aircraft), Alliance Ace, Retro |
| Achievement | Iron Butt (12+ hr), Night Owl (10 red-eyes), Jet Setter |
| Continent | Europhile, Asianaut, Americas Wanderer, Africa Explorer |
| Secret | Circumnavigator (40,075 km) |

**Display Rules:**
- Show earned badges only
- DON'T show locked badges
- DON'T show progress toward next badge

**Success Criteria:**
- [ ] Badges evaluate on flight insert via trigger
- [ ] Award notification on first earn
- [ ] Badges visible on public profile if public

### 8. Settings

| Setting | Options |
|---------|---------|
| Language | EN / RU |
| Theme | Light / Dark / System |
| Profile visibility | Public / Private |
| Leaderboard opt-in | Yes / No |
| Display name | Text |
| Bio | Text (140 chars max) |

**Data Operations:**
- CSV export: All flights as CSV
- Account deletion: Full GDPR-style delete

**Success Criteria:**
- [ ] All settings persist immediately
- [ ] CSV export is valid and complete
- [ ] Account deletion removes all user data

---

## Non-Goals (Explicit Scope Limits)

### Data We Don't Track

| Data | Reason |
|------|--------|
| Cabin class | Not core to flight stats |
| Seat numbers | Personal detail, not essential |
| Codeshare operating carrier | Marketing carrier is enough |
| Loyalty program numbers | Security risk, out of scope |
| Booking reference / PNR | Not relevant after flight |
| Ticket price | Too personal |
| Baggage details | Not flight stats |

### Features We Don't Build

**Engagement Mechanics:**
- Daily streaks
- Progress bars to next badge
- Push notifications
- Email engagement campaigns

**Social Features:**
- Following/followers
- Activity feed
- Comments on profiles
- Direct messaging

**Booking & Planning:**
- Flight booking
- Price alerts
- Trip planning
- Automatic flight detection (requires email access)

**Loyalty & Rewards:**
- Loyalty program tracking
- Miles calculation
- Elite status tracking

---

## User Stories

### Authentication

```
AS a new user
I WANT to sign up with email/password
SO THAT I can start tracking my flights

Acceptance:
- Signup accepts email and password only
- Profile auto-created on signup
- Redirect to dashboard after onboarding
```

```
AS an existing user
I WANT to sign in with 30-day sessions
SO THAT I don't have to log in frequently

Acceptance:
- Session persists for 30 days
- Password reset requires verified email
```

### Flight Management

```
AS a user
I WANT to add a flight manually
SO THAT I can track flights not in imported documents

Acceptance:
- Required fields: date, origin, destination, airline
- Autocomplete for airports/airlines/aircraft
- Distance/duration auto-calculated
```

```
AS a user
I WANT to import flights from boarding passes
SO THAT I can quickly add multiple flights

Acceptance:
- Upload PDF/image or paste text
- Review parsed results before saving
- Edit any field inline
- Save all at once
```

```
AS a user
I WANT to track future flights
SO THAT I can see upcoming trips with countdowns

Acceptance:
- Future flights flagged separately
- Countdown timers displayed
- Don't count toward stats until date passes
```

### Stats & Gamification

```
AS a user
I WANT to see my flight statistics
SO THAT I can understand my travel patterns

Acceptance:
- Total flights, distance, countries, airlines visible
- Stats update immediately on flight add
- Progressive tiers unlock with data
```

```
AS a user
I WANT to earn badges for achievements
SO THAT I feel recognized for milestones

Acceptance:
- Badges award automatically
- Only earned badges shown
- No progress bars or pressure
```

### Social

```
AS a user
I WANT to share my profile publicly
SO THAT others can see my travel achievements

Acceptance:
- Control profile visibility in settings
- Public shows stats and badges only
- Map and individual flights always private
```

```
AS a user
I WANT to compare stats with another user
SO THAT I can see how my travel compares

Acceptance:
- Side-by-side stat comparison
- Available on public profiles
- Works for logged-in users only
```

---

## Decision Framework

When evaluating new features, apply these filters in order:

1. **Privacy check:** Does this expose individual flight data or travel patterns?
2. **Anxiety check:** Does this create pressure, guilt, or FOMO?
3. **Complexity check:** Does this require server-side logic we don't have?
4. **Scale check:** Does this make sense for 50-500 users?
5. **Craft check:** Does this align with the design aesthetic?

If any check fails, reconsider the feature or find an alternative approach.

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Time to first flight | < 2 minutes from signup |
| Import accuracy | > 90% for standard boarding passes |
| Page load time | < 2s on 3G |
| User retention (30-day) | > 50% for active importers |
| Bug reports | < 1 per user per month |

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [APP_FLOW.md](./APP_FLOW.md) | User navigation paths and screen inventory |
| [TECH_STACK.md](./TECH_STACK.md) | All dependencies with exact versions |
| [FRONTEND_GUIDELINES.md](./FRONTEND_GUIDELINES.md) | Design system and UI patterns |
| [BACKEND_STRUCTURE.md](./BACKEND_STRUCTURE.md) | Database schema and API contracts |
| [PLAN.md](./PLAN.md) | Implementation roadmap and status |
