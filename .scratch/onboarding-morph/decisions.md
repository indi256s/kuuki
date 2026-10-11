# Onboarding morph — interview decisions (2026-10-11)

Status: spec ready-for-agent in spec.md (Q1 → wire the import job worker in prod; Q2, Q3 confirmed 2026-10-11); break boards 16–19 drawn. Paper: "Kuuki — Auth redesign" (file `01M48F4SHK61AZS2FH5P5JPRY7`), page p-1-0.

Extends [the one-form auth spec](../auth-one-form/spec.md). Today Create account calls `router.push('/onboarding')`, which leaves the card for a separate page with a "Name · Capture · Reveal" progress list, a username form and a three-button picker. The user named all three as the worst parts of the flow.

## Shape

- **One card, from sign-in to the first flight.** Create → name → first flight → review → narrator reveal, then the card dissolves into Overview. Returning members get the same dissolve after sign-in.
- **Steps are in history.** Each step pushes a URL under `/welcome/*`, and Back morphs to the previous step. Account creation is never undone. The old `/onboarding?step=` URLs redirect.
- **Resume.** An account that hasn't finished onboarding resumes the card at its step after signing in, including review of a running or finished import batch.
- **Skip is final.** "I'll do this later" on the flights step persists and lands on an empty Overview. The card never comes back.
- **Persistence:** add `profiles.onboarded_at` (set on skip or reveal). The migration backfills every existing profile. A D1 migration follows `docs/runbooks/audit-remediation-release.md`.

## Name

- Right after create, its own step: "What should we call you?", one empty field with autofocus and `autocomplete="name"`.
- **One name** for the person and the public profile: free text, so Cyrillic, capitals and spaces are allowed. The `/fly/<slug>` slug is derived invisibly (transliterated, suffixed on collision), shown only as a small editable line, and changeable later.
- Profiles stay private by default (`is_public DEFAULT 0`). The public/private toggle stays in profile settings; onboarding doesn't ask.
- The `requireOnboardedMember` gate stops requiring a username and keys off `onboarded_at` / step state.

## First flight

- **The agent is the hero:** "Let your AI find every flight" with a Copy prompt button. The step itself accepts anything: **paste anywhere**, drop anywhere, and on return to the tab, clipboard auto-read where the browser allows it. "Type one in" is a quiet link. No deep links to assistants, and no extra help (the user chose "nothing extra").
- **Paste guard: ingest everything.** A reply in the header format parses deterministically for free. Any other text goes to the Gemini fallback, and the existing import rate buckets cap the cost.
- **Clipboard auto-read is best-effort** (verify per browser in the spec): Chrome asks for permission once, while Safari and Firefox show a paste affordance on every read. It only adds to paste-anywhere.
- **Slow recognition: let them leave.** "You can close this, we'll keep looking." The card resumes at review on the next visit (drafts persist for 30 days).
- **Cap:** raise the 100-flight cap when the reply parses deterministically (no model call, for example up to 500). Keep 100 for the model fallback.

## Agent prompt (rewrite with writing-for-agents)

- Keep the pipe-list format, made exact to `functions/api/import/_text.ts`, plus a first-line header (`KUUKI FLIGHTS v2`) so paste detection and the parser can recognise a reply with confidence and support versions.
- Formalise in the prompt what the parser already absorbs: `[notes]`, `Undated`, `(calendar entry)`, the other-passenger section, cancelled/refunded handling. No PII (as today). EN and RU.

## Review

- **The card grows tall.** On desktop the passport panel **stretches** with it and shows more pages and stamps.
- **Compact onboarding list** on top of the existing `review-model.ts`: date · route · flight number per row, unsure rows pinned on top with a "Check" chip, fixed inline, then a sticky "Save N flights". No duplicates UI (new accounts have none).

## Live preview (desktop left panel)

- **Passport throughout.** Name step: the cover shows the name as they type it. Flights and review: pages open and stamps land as rows are recognised. Reduced motion: static.

## Reveal

- **One narrator line**, then the card dissolves into Overview. It's a new trigger slot in `client/overview/narrator/corpus.ts` (deterministic, 3 variants, seeded). There are lines for every case: big history, small history, upcoming only, a single flight.

## Mobile

- **The sheet grows to full height** for flights and review. The brand band shrinks into a small passport-preview strip at the top.

## Rejected / not chosen

- Auto-generated handle, a random handle, an opaque ID URL, keeping display name and username separate.
- A sample reveal on skip, a required first flight.
- A question deck before the review list, embedding the import review as it is.
- Help for connecting email, an "upcoming only" prompt, an "AI can't see my mail" escape.
