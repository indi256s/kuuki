# Phase 1.5: Onboarding & Landing

**Status:** Pending
**Depends on:** Phase 1 complete

## Tasks

### Pre-login Modal Showcase (3 slides)

**Skill:** `/frontend-design`

| Modal | Content |
|-------|---------|
| 1 | "Log Your Journeys - Build your flight collection. Every takeoff, every landing, remembered." |
| 2 | "Discover Your Stats - Distance flown, countries visited, airlines collected. See your patterns." |
| 3 | "Compare & Share - Join the leaderboard. Share your aviation story with the world." |

**Requirements:**
- Skip button always visible
- Remembered in localStorage (don't show again)
- Creative, eye-catching design

### Landing Page

**Skill:** `/frontend-design`

**Style:** Feature highlights (3-4 sections with screenshots/mockups)
- Not elaborate - showcase modals do the selling
- Distinctive aviation aesthetic
- Clear CTA to sign in / request invite

### Post-login Onboarding

**Skill:** `/interface-design`

**Flow:**
1. Username picker (flexible format → normalized, e.g., "John Doe" → "john-doe")
2. Import CTA: "Import your flight history or add manually"

**Skip:** No home airport selection for MVP

### Empty States

**Skill:** `/interface-design`

**Approach:** Sample data preview
- Show what dashboard WOULD look like with example data
- "This could be you" messaging
- Playful hand-drawn doodles + helpful text

## Files to Create

```
apps/web/src/
├── components/
│   ├── onboarding/
│   │   ├── ShowcaseModal.tsx
│   │   ├── UsernamePicker.tsx
│   │   └── ImportCTA.tsx
│   └── landing/
│       └── LandingPage.tsx
└── routes/
    └── LandingPage.tsx (or update existing)
```
