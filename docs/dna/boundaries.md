# Kuuki DNA: Boundaries

> What we explicitly DON'T do. These are intentional omissions, not oversights.
> When an LLM suggests adding these features, point them here.

---

## Data We Don't Track

| Data | Why not |
|------|---------|
| Cabin class (economy/business/first) | Adds complexity, not core to flight stats |
| Seat numbers | Personal detail, not essential |
| Codeshare operating carrier | Marketing carrier is enough |
| Loyalty program numbers | Security risk, out of scope |
| Booking reference / PNR | Not relevant after flight |
| Ticket price | Too personal, varies wildly |
| Baggage details | Not flight stats |
| In-flight purchases | Not flight stats |
| Airport lounge visits | Not flight stats |
| Ground transportation | Not flight stats |

**Rule:** If it's not about the flight itself (route, aircraft, airline, time), we don't track it.

---

## Features We Don't Build

### Engagement Mechanics

| Feature | Why not |
|---------|---------|
| Daily streaks | Creates anxiety, punishes breaks |
| Progress bars to next badge | Creates pressure |
| "X more to unlock" prompts | Manipulative |
| Push notifications | Not a habit app |
| Email engagement campaigns | Not a growth startup |
| Gamified onboarding quests | Over-engineered |

### Social Features

| Feature | Why not |
|---------|---------|
| Following/followers | We're not a social network |
| Activity feed | Privacy concern, complexity |
| Comments on profiles | Moderation burden |
| Direct messaging | Out of scope |
| Flight sharing to social media | Privacy by default |
| Public route maps | Too revealing of travel patterns |

### Booking & Planning

| Feature | Why not |
|---------|---------|
| Flight booking | We're a tracker, not an OTA |
| Price alerts | Out of scope |
| Trip planning | Out of scope |
| Calendar integration | Future maybe, not MVP |
| Automatic flight detection | Requires email access, privacy concern |

### Loyalty & Rewards

| Feature | Why not |
|---------|---------|
| Loyalty program tracking | Complex, varies by airline |
| Miles calculation | Different programs, different rules |
| Elite status tracking | Out of scope |
| Credit card point optimization | Not our domain |

---

## Anti-Patterns to Avoid

### UI Anti-Patterns

| Anti-pattern | Why it's wrong | Do this instead |
|--------------|----------------|-----------------|
| Showing locked badges | Creates pressure | Only show earned badges |
| Exact leaderboard ranks | Intimidating | Show percentiles ("Top 15%") |
| Empty states with just "Add your first X" | Boring, unhelpful | Show sample data preview |
| Modal spam on login | Annoying | Max 3 showcase modals, skippable |
| Confetti on every action | Cheapens celebration | Reserve for genuine milestones |
| Dark patterns for engagement | Manipulative | Respect user attention |

### Technical Anti-Patterns

| Anti-pattern | Why it's wrong | Do this instead |
|--------------|----------------|-----------------|
| Custom backend server | Maintenance burden | Use Supabase direct + RLS |
| Complex fraud detection | Overkill for 50-500 users | Community trust + reporting |
| Real-time sync | Unnecessary complexity | Standard request/response |
| Microservices | Over-engineering | Monorepo, simple structure |
| Native mobile app | Too much effort | Web-first, PWA later |

### Data Anti-Patterns

| Anti-pattern | Why it's wrong | Do this instead |
|--------------|----------------|-----------------|
| Storing times in local timezone | Timezone hell | Store UTC, convert on display |
| Blocking on duplicate detection | User knows best | Warn but allow |
| Auto-saving AI imports | Errors persist | Require user confirmation |
| Inferring without showing | Users distrust magic | Show all inferences for review |

---

## Scope Boundaries

### MVP Scope (What We Built)

✅ Flight logging (manual + AI import)
✅ Stats dashboard with progressive tiers
✅ Public profiles with privacy controls
✅ Leaderboards with percentile rankings
✅ 20 badges across 6 categories
✅ Passport with country stamps
✅ Dark mode
✅ i18n (EN/RU)
✅ CSV export
✅ Mobile responsive

### Post-MVP Ideas (NOT Planned)

These are documented ideas, not commitments:

| Idea | Status |
|------|--------|
| Trip grouping | Idea only |
| Seat tracking | Explicitly rejected |
| Loyalty programs | Explicitly rejected |
| Flight reviews/ratings | Idea only |
| Social sharing | Idea only |
| Mobile app (PWA) | Future maybe |
| More languages | Future maybe |
| Home airport feature | Deferred |
| Calendar integration | Deferred |
| Email notifications | Deferred |

---

## When to Say No

Use this checklist when evaluating feature requests:

### Automatic No

- [ ] Requires tracking personal data beyond flights
- [ ] Creates daily engagement pressure
- [ ] Needs a custom backend server
- [ ] Requires moderation infrastructure
- [ ] Exposes travel patterns publicly

### Probably No

- [ ] Requires third-party API integration (beyond Gemini)
- [ ] Adds significant complexity for edge cases
- [ ] Serves <5% of users
- [ ] Requires mobile-specific implementation

### Consider Carefully

- [ ] Adds new data field to flights
- [ ] Creates new badge category
- [ ] Adds new stats tier
- [ ] Requires database migration

---

## Saying No Gracefully

When declining a feature request, explain which principle it violates:

**Privacy concern:**
> "We don't track [X] because it reveals personal travel patterns. See PRINCIPLES.md → Privacy Philosophy."

**Gamification concern:**
> "We don't show [X] because it creates engagement pressure. See PRINCIPLES.md → Gamification Stance."

**Scope concern:**
> "This is outside our core mission of flight stats tracking. Kuuki is a vault, not a [social network / booking tool / etc]."

**Complexity concern:**
> "This would require [custom backend / third-party integration / moderation], which violates our minimal server footprint principle."
