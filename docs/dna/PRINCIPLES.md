# Kuuki DNA: Core Principles

> The foundational beliefs that guide every product and technical decision.
> Read this first. All other DNA files reference these principles.

---

## Identity

**What Kuuki is:** A flight stats vault for aviation enthusiasts. Log journeys, build your collection, discover patterns, compare with others.

**What Kuuki is NOT:** A social network, a booking tool, a loyalty program tracker, or a travel planning app.

**Name:** "Kuuki" for text. Hiragana (くうき) allowed for atmospheric branding/watermarks. No Kanji in functional UI.

**Scale assumption:** 50-500 users in first 6 months. This is a personal project, not a startup. Decisions optimize for craft over growth.

**Launch approach:** Feature-complete beta with invite codes. Quality over speed.

---

## Privacy Philosophy

**Default stance:** Private by default, public by choice.

| Data type | Visibility | Rationale |
|-----------|------------|-----------|
| Individual flights | Always private | Personal travel history is sensitive |
| Route map | Always private | Visual travel patterns reveal too much |
| Aggregate stats | User choice | Numbers are less identifying than routes |
| Badges earned | Public if profile public | Achievements are meant to be shared |
| Passport stamps | Always private | Personal travel visualization only |

**Rules:**

- NEVER show individual flight details on public profiles
- NEVER show the map visualization publicly
- ALWAYS require explicit opt-in for leaderboard participation
- ALWAYS let users make their entire profile private

**Rationale:** Aviation enthusiasts want to track and compare, but travel patterns are deeply personal. A stalker shouldn't be able to see "User X flies SFO→JFK every Tuesday."

---

## Gamification Stance

**Philosophy:** Celebrate achievements, don't manufacture anxiety.

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

**Anti-gaming approach:** Community trust over hard limits. Public profiles + reporting. Gaming becomes obvious at small scale. Don't build complex fraud detection for 50-500 users.

**Rationale:** This is a hobby tracker, not a habit-forming app. Users should feel good checking their stats, not guilty for missing a day.

---

## Technical Philosophy

**Minimal server footprint:**

- Cloudflare Worker ONLY for Gemini API proxy (hides API key)
- All flight CRUD goes direct from client to Supabase
- Supabase RLS handles all security
- No custom backend server

**Why:** Less infrastructure = less maintenance = more time for features.

**Data accuracy over completeness:**

- Allow inferences (airline from flight number format)
- Require user confirmation before saving AI-parsed data
- Warn on duplicates but let user decide
- Computed fields (distance, duration) use sensible defaults

**Progressive disclosure:**

- Stats tabs appear as user accumulates data
- Don't show empty sections — show sample data or hide
- Onboarding teaches through example, not tutorials

---

## User Psychology

**Target user:** Aviation enthusiast who flies 5-50 times per year. Cares about flight history. Enjoys stats, experiments, and a bit of chaos. Values both function and personality.

**Emotional goals:**

- Pride in collection ("Look at all these flights")
- Curiosity about patterns ("I had no idea I flew that much distance")
- Friendly competition ("Top 15% of countries visited")
- Nostalgia ("My first international flight was 8 years ago")

**NOT optimizing for:**

- Daily engagement (this isn't social media)
- Viral growth (quality community over quantity)
- Monetization (personal project)

**Key insight from interview:** Users want curated stats (top 5 most interesting) over exhaustive data dumps. Percentile framing is less intimidating than exact ranks. Show the "fun facts" comparison ("42% to the Moon") to create delight.

---

## Decision Framework

When making new product decisions, apply these filters in order:

1. **Privacy check:** Does this expose individual flight data or travel patterns?
2. **Anxiety check:** Does this create pressure, guilt, or FOMO?
3. **Complexity check:** Does this require server-side logic we don't have?
4. **Scale check:** Does this make sense for 50-500 users?
5. **Craft check:** Does this align with the Warm Japanese Minimalism aesthetic?

If any check fails, reconsider the feature or find an alternative approach.

---

## Quick Reference

| Principle | One-liner |
|-----------|-----------|
| Privacy | Private by default, public by choice |
| Gamification | Celebrate achievements, don't manufacture anxiety |
| Scale | 50-500 users, optimize for craft not growth |
| Server | Minimal footprint, Supabase RLS handles security |
| UX | Progressive disclosure, teach through example |
| Stats | Percentiles over ranks, curated over exhaustive |
| Anti-gaming | Community trust, not fraud detection |
