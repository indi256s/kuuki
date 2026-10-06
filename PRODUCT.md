# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Frequent flyers and aviation enthusiasts who want more than a spreadsheet of legs. They log flights after trips, browse stats on desktop or phone, and optionally share a public profile or compete on leaderboards. Context is reflective (reviewing travel history) rather than transactional (booking).

Sign-up is open to the public, so public profiles and leaderboards are seen by strangers, not only a known circle. Some accounts were migrated from the earlier Kuuki and are activated rather than created fresh.

## Product Purpose

Kuuki (空気, "air") turns flight history into a visual travel legacy: maps, passport stamps, analytics, and social features. Success means accurate data, fast import, and an interface that feels like a personal journal rather than a generic SaaS dashboard.

## Positioning

- **A journal, not a tracker.** Kuuki is for looking back on flights already taken. It does not do live flight tracking or booking, and it should not imitate trackers such as Flighty or flightradar logs.
- **AI import.** Snap a boarding pass or drop a PDF or text, and Kuuki extracts the flights for the owner to review, instead of making them type each leg.

## Operating Context

The [Redesign 2.0 brief](docs/plans/2026-10-04-redesign-2.0-ux-ui.md) defines three jobs, in priority order:

- **Capture.** Get flights in correctly with minimum effort, through Add (manual entry), Import (boarding pass, PDF or pasted text) and the Journal.
- **Remember.** Where have I been, what was notable, what's next. This happens on Overview, Passport and country detail.
- **Share.** Show it off and see where I stand, on the public profile and Leaderboard.

Usage is after the trip, on desktop or phone. Imported and detected flights wait in a review queue until the owner confirms them.

## Capabilities and Constraints

- Flights move through a lifecycle and become passport stamps only once confirmed. The one documented exception is that an awaiting flight auto-confirms seven days after it becomes date-eligible (DESIGN.md D11). Terms are in [GLOSSARY.md](GLOSSARY.md) and [ADR 0001](docs/adr/0001-flight-lifecycle-and-import-drafts.md).
- Public profiles are opt-in. Turning the profile off also removes the user from leaderboards.
- EN and RU are both supported throughout, with real Russian plural forms. Russian copy addresses the user as «вы».
- Runs on Cloudflare. The current app is `apps/next`; the Vite app in `apps/web` is kept only as a rollback surface (see [AGENTS.md](AGENTS.md)).

## Brand Personality

Calm, precise, quietly proud. Japanese-minimal restraint with warm terracotta accents. The product should feel like a sanctuary for journeys, not a growth-hacked startup.

## Brand Commitments

- **Name and wordmark.** Kuuki / 空気. The wordmark is text only: "Ku" in the accent color followed by "uki", with no icon.
- **Voice: dry humor, contained.** Quips belong in ambient places only, such as the rotating auth taglines (`auth.taglines` in `packages/shared/src/i18n`) and empty states. Trust lines, errors, privacy, capture and destructive flows stay calm and direct.

## Anti-references

- Generic AI SaaS landing grids (identical icon cards, gradient hero text, glass-everywhere chrome)
- Utilitarian flight-log spreadsheets with no visual identity
- Navy-and-gold fintech or indigo "cinematic dark mode" that reads as a different product
- Bounce easing, side-stripe callouts, and ghost cards (border plus wide shadow)

## Evidence on Hand

- [User-journey atlas](docs/user-journeys/README.md), captured 2026-10-03: 184 states across 29 flows, with screenshots.
- [Interface audit](docs/user-journeys/2026-10-03/audit/AUDIT.md): 113 findings.
- Real copy: the EN/RU strings in `packages/shared/src/i18n`, including the auth taglines.
- Self-hosted Onest and JetBrains Mono fonts and country map data in `apps/next/public`.
- Kuuki has no testimonials, press coverage, user counts or usage statistics. Do not invent any of them. The sample data on surfaces is illustrative and must be labelled as such.

## Product Principles

1. **Trust before delight.** Capture, auth, privacy and errors are precise and calm. Delight is kept for rare moments such as the first stamp or a finished import.
2. **The owner confirms.** Data becomes part of someone's record only through their own confirmation, with any automatic rule stated wherever it applies.
3. **Every screen answers one question first.** Each screen has one hero element, and everything else is visibly secondary.
4. **Built for strangers.** With open sign-up, privacy defaults, public visibility and leaderboard participation are always explicit and reversible.

## Design Principles

1. **Data serves the story** — stats and maps should clarify travel patterns, not decorate empty space.
2. **One material at a time** — flat surfaces, borders, or shadow; not all three on the same card.
3. **Tokens over literals** — maps, charts, and surfaces use the OKLCH system; no orphan hex palettes.
4. **Accessible by default** — semantic headings, contrast-tested placeholders, reduced-motion fallbacks.
5. **Motion with purpose** — ease-out reveals; no bounce or elastic feedback on routine UI.

## Accessibility & Inclusion

- Target WCAG 2.1 AA for text contrast (4.5:1 body, 3:1 large text and UI components).
- Respect `prefers-reduced-motion` globally.
- Screen-reader-friendly headings and form labels; skip link to main content.
- i18n for interactive labels (EN/RU).
