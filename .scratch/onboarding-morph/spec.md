# Spec: One card from sign-up to the first journal

Status: ready-for-agent. Q1–Q3 were answered on 2026-10-11 (see Further Notes). Production steps (D1 migration 0010, the import Worker deploy, the binding) still need their own authorization under the runbook. Planning and local implementation don't.

Decisions: [decisions.md](decisions.md) (interview, 2026-10-11). Extends [the one-form auth spec](../auth-one-form/spec.md).

Design source of truth: the Paper file **"Kuuki — Auth redesign"** (file id `01M48F4SHK61AZS2FH5P5JPRY7`), page p-1-0. Read it through the Paper MCP: `get_jsx` and `get_computed_styles` for exact values, `get_screenshot` only to orient. Board names are quoted below.

| Row | Boards |
| --- | --- |
| 15 · Key frames, desktop | "15.1 Onboarding — name", "15.2 … first flight, agent first", "15.3 … back from the assistant, paste", "15.4 … reading flights, safe to leave", "15.5 … review, tall card", "15.6 … narrator reveal, then dissolve" |
| 15 · Key frames, mobile | "15.7 … name (mobile)", "15.8 … first flight, agent first (mobile)", "15.9 … review, sheet full height (mobile)", "15.10 … narrator reveal (mobile)" |
| 16–19 · Break boards | Stress scenarios and proposed missing states for name (16), first flight (17), review (18) and reveal (19). Boards marked "(proposed)" are design proposals; where they conflict with this spec, this spec wins. |

## Problem Statement

Creating a Kuuki account works. What follows it feels like a different product:

- Create account in the auth card jumps to a separate `/onboarding` page. The card the person was just using disappears, and so does the brand panel.
- That page shows a "Name · Capture · Reveal" progress list and asks for a display name *and* a username with format rules (`a-z0-9_`, 3 to 30 characters) and a live availability check. That's bureaucracy before the person has seen anything.
- Adding flights starts with a three-button picker (Upload / Paste / Manual). The best path, letting an AI assistant find every flight in email and calendar, is hidden behind "Paste", and its prompt is out of step with what the parser actually accepts.
- If the person stops partway, nothing remembers where they were. The only "done" signal is having a username, so skipping isn't a real choice.

## Solution

The auth card never leaves. After Create account it morphs in place through four steps, each its own URL under `/welcome/*`:

1. **Name.** One question, "What should we call you?" The passport on the left (a strip on mobile) prints the name as it's typed. The private `/fly/<slug>` address is derived quietly.
2. **First flight.** The copyable prompt for the person's own AI assistant is the hero. The step accepts anything: paste anywhere, drop a boarding pass anywhere, or "Paste from clipboard" on return. "Type a flight in" and "I'll do this later" are quiet links.
3. **Review.** The card grows tall. Unsure flights are pinned on top with one-tap fixes, and everything else is a compact list. "Save N flights" leaves anything still unsure out.
4. **Reveal.** One narrator line about the new journal, then "Open my journal" dissolves the card into the Overview.

Abandoned sessions resume the card at the right step. "I'll do this later" is final and lands on an empty Overview. Returning members get the same dissolve after signing in.

## User Stories

IDs are stable; later revisions keep them.

### Shape and navigation

- **O1.** As a new member, after I press Create account, I want the card to morph into the name step without a page load, so the sign-up feels like one thing. *Accept:* no full navigation and no unmount of the card shell between the create step and "15.1"; the URL becomes `/welcome/name` through a history push.
- **O2.** As a member in onboarding, I want each step to have its own URL (`/welcome/name`, `/welcome/flights`, `/welcome/review`, `/welcome/ready`), so browser Back takes me to the previous step with the same morph. *Accept:* Back from flights shows name with its saved value. Back from review shows flights. Back from name never undoes account creation and never shows the create step.
- **O3.** As someone with an old link, I want `/onboarding` and `/onboarding?step=*` to redirect to the matching `/welcome/*` step, so old links and the existing gate redirect keep working.
- **O4.** As a member who stopped partway, I want signing in to resume the card at my step, so I don't start over. *Accept:* no name → name. Name but no import and not onboarded → flights. An import batch still running → reading (the "15.4" state). A batch with drafts in review → review. Onboarded → the normal sign-in dissolve into Overview.
- **O5.** As a returning, onboarded member, I want sign-in to end with the same dissolve into the Overview, so both doors feel alike.
- **O6.** As a member, I want "I'll do this later" to be final, so the card never nags me again. *Accept:* it records onboarding as done, dissolves into an empty Overview, and `/welcome/*` then redirects to the Overview.
- **O7.** As a mobile member, I want the sheet to grow to full height for flights and review, with the brand band shrunk into a passport strip, so the content has the room ("15.7"–"15.10").

### Name

- **O8.** As a new member, I want one empty name field that is autofocused with `autocomplete="name"`, accepting any script, capitals and spaces, so I can write my name as I write it. *Accept:* Continue is disabled while the trimmed value is empty. Leading and trailing spaces are trimmed and inner runs collapse to one space. The name is 1 to 40 characters, and the field stops accepting input at 40 (board 16).
- **O9.** As a new member on desktop, I want the passport cover to print my name as I type, and on mobile the strip to show it, so I see where it goes. *Accept:* the preview updates on every input event. Long names follow the cover rules from board 16. Reduced motion: no animation, same content.
- **O10.** As a new member, I want my public address derived for me and shown as a small editable line with a lock, so I never have to invent a handle. *Accept:* the slug is a transliteration of the name (Cyrillic → Latin), lowercased, with non-alphanumerics collapsed to `-`, and suffixed `-2`, `-3`… on collision. Editing it validates format and availability inline. The profile stays private (`is_public` unchanged, default 0), and the step doesn't ask about visibility.
- **O11.** As a new member, if saving the name fails or I'm offline, I want my text kept and a plain retry, so nothing I typed is lost.

### First flight

- **O12.** As a new member, I want the prompt for my AI assistant to be the first thing on the flights step, with a full-width Copy prompt button, so the best path is the obvious one ("15.2"/"15.8"). *Accept:* the copy is the v2 prompt (O24). If the clipboard write fails, the prompt text is selected for manual copying (current `source-step.tsx` behavior).
- **O13.** As a member coming back from my assistant, I want the card to be waiting for the reply ("15.3"), so I know what to do next. *Accept:* after a successful copy, the step switches to the paste state. It shows "Paste from clipboard", the ⌘V/drop hint, "Copy again" and "I'll do this later".
- **O14.** As a member on the flights step, I want to paste text anywhere on the page with ⌘V/Ctrl+V, or drop a PDF, PNG or JPEG anywhere, so I don't have to aim. *Accept:* a document-level paste listener ignores pastes into editable fields other than the step's own. Dropping shows a full-card drop target. Unsupported types show the board 17 error state.
- **O15.** As a member, I want "Paste from clipboard" to read the clipboard when I press it, so one tap is enough on any browser. *Accept:* it reads inside the click gesture (`navigator.clipboard.read()` for images, `readText()` otherwise). On denial or an empty clipboard, it shows the board 17 state that points to ⌘V or the mobile paste button. It never loops a permission prompt.
- **O16.** As a member returning to the tab, I want the reply picked up automatically where my browser already allows it, so I may not need to paste. *Accept:* on `visibilitychange` to visible, only when `permissions.query({name:'clipboard-read'})` reports `granted`, the step reads text silently. A result is acted on only if it starts with the v2 header (O24). Otherwise nothing happens. It never triggers a permission prompt.
- **O17.** As a member, I want any pasted or dropped content accepted ("ingest everything"), so I don't need the exact format. *Accept:* text in the v2 format (or the legacy pipe format) parses deterministically with no model call, capped at 500 flights. Anything else goes through the existing Gemini extraction, capped at 100 flights and the existing `MAX_TEXT_LENGTH`. Both paths respect the existing import rate limits, with the board 17 state when a limit is hit.
- **O18.** As a member with a long history, I want to see flights being found ("15.4") and be told I can close the tab, so a slow read isn't a trap. *Accept:* "You can close this tab" appears only after the job worker has accepted the batch (`202 {batchId}`), and closing the tab doesn't stop the read. Without the binding (the local unbound fallback) the note isn't shown. A live count ("23 found so far, 6 countries") updates in an `aria-live="polite"` region. Leaving and coming back resumes per O4.
- **O19.** As a member, if nothing usable is found (0 flights, not flights at all, or an error mid-read), I want a plain message and a way to try again, so I'm not stuck. *Accept:* board 17 states; "Copy again", paste and "I'll do this later" stay available.
- **O20.** As a member who'd rather type, I want "Type a flight in" to open a one-flight form inside the card, so typing stays inside the same flow. *Accept:* saving it goes to the reveal with the single-flight narrator case. See Further Notes Q3.

### Review

- **O21.** As a member with imported drafts, I want the card to grow tall and show unsure flights first, each with a one-tap fix, so checking 41 flights takes seconds ("15.5"/"15.9"). *Accept:* the heading is "N flights. Check K." (copy for K=0 and N=1 from board 18). Unsure kinds and their fixes: ambiguous city → airport chips; missing day → date input + Leave out; maybe cancelled → I flew it / Leave out. Resolved rows leave the unsure group. Other draft problems the existing review model reports keep their existing fix UI inside the same row shape.
- **O22.** As a member, I want everything else as a compact list (date · route · flight number) with a short preview and "Show all N", and a sticky "Save N flights" bar that says how many unsure flights saving leaves out, so I can finish without fixing everything. *Accept:* Save converts the included drafts and excludes rows still unsure or marked Leave out. The desktop passport stretches with the card and stamps the countries present. A save error keeps every choice and offers retry.

### Reveal and done

- **O23.** As a member who saved flights, I want one narrator line about my journal plus a short stats line, then "Open my journal →" to dissolve the card into my Overview, so the ending is a moment rather than a redirect ("15.6"/"15.10"). *Accept:* the line comes from a new deterministic onboarding trigger family covering big history, small history, upcoming only and a single flight, with 3 variants each in EN and RU (Russian uses «вы»). The stats line mentions left-out flights only when there are some. No auto-advance. Pressing the button records onboarding as done before the dissolve starts. Reduced motion: a crossfade without scale or blur.

### Prompt

- **O24.** As a member, I want the prompt I give my assistant to produce exactly what Kuuki reads best, so the paste parses for free and completely. *Accept:* the prompt is rewritten (with the writing-for-agents skill) in EN and RU. It asks for a first line `KUUKI FLIGHTS v2`, then the pipe-list rows the parser accepts, and formalises what the parser already absorbs: `[notes]`, `Undated`, `(calendar entry)`, the other-passenger section, and cancelled/refunded/superseded handling. It asks for no PII beyond what a row needs. The parser accepts v2 and the current header-less format.

### Gate and persistence

- **O25.** As the system, I want "onboarded" to mean `profiles.onboarded_at IS NOT NULL` rather than "has a username", so skip and finish are both real states. *Accept:* `requireOnboardedMember` and `getMemberLanding` send members without `onboarded_at` to their resume step (O4). Every existing profile is backfilled so no current member ever sees onboarding.
- **O26.** As an onboarded member, I want to change my name and my `/fly` address in Settings, so the links that point at `/onboarding` today ("Change username", "View my profile" with no username) still lead somewhere. *Accept:* Settings edits the name and the address inline with the same rules as O8/O10. A member with no address gets one derived from their name the first time Settings saves or the profile is made public.

## Implementation Decisions

### Card shell and routing

- **One client state machine owns sign-in, create and onboarding.** The auth card's states (`form`, `checking`, `create`, `creating`, request/sending/sent) gain `name`, `flights` (sub-states `prompt`, `awaiting-paste`, `reading`, `nothing-found`, `error`), `manual`, `review`, `ready` and `dissolving`. The brand panel becomes a passport preview driven by the same state (cover for `name`, open spread with stamps for `flights`/`review`/`ready`).
- **Routes.** Add `/welcome/[step]` (`name`, `flights`, `review`, `ready`) to the `(card)` route group, rendering the same card frame as `/`, `/signin` and `/signup` with the step chosen server-side. Inside the card, steps advance with `history.pushState`, so the React tree, and with it the card shell, never unmounts. `popstate` maps back to the step and plays the reverse morph.
- **Create account no longer does a document navigation.** Today `withIdentityMutation(..., '/onboarding')` ends in `resetPrivateState()` → `window.location.assign` (`client/activity.tsx`), which exists to drop the previous owner's private stores and the Next segment cache. For create, the previous identity is a guest and the card page renders no private data. Decision: add an in-place identity transition for guest → new member. It aborts tracked operations, clears the previous owner's local stores if there was one, publishes the new identity, then pushes `/welcome/name` without reloading. A guest → member transition from any page other than the card still uses the document navigation. Sign-in (member → member, or guest → existing member) keeps the document navigation and gets the dissolve as an exit animation before `location.assign` (O5).
- **Gate.** `requireOnboardedMember()` and `getMemberLanding()` (`server/gates.ts`) key off `onboarded_at` and compute the resume step: `name` if `display_name` is empty, `review` if the member has an unexpired import batch with review drafts, `flights` (reading sub-state) if a batch is `processing`, otherwise `flights`. `ONBOARDING_NAME_PATH` is replaced by a `welcomePath(step)` helper. `/onboarding` and its `?step=` forms redirect to the computed welcome step (O3). The `(entry)/onboarding` page and its `onboarding-name`/`onboarding-flow` components are retired after the redirect lands.
- **`safeTargetPath`** in `activity.tsx` adds `/welcome/name` and drops `/onboarding` once nothing targets it.
- **Dissolve.** The exit is an opacity/scale/blur animation on the card (`--dur-moment`, `--ease-out`), followed by navigation to `/overview`. The Overview's existing entrance plays. Reduced motion: opacity only. Cross-document View Transitions are a possible enhancement, not a requirement.

### Name and address

- **Schema reuse, no slug column.** The free-text name is stored in `profiles.display_name`. The `/fly/[username]` route and its unique `lower(username)` index stay. The derived address is written to `username`, so the public route needs no change.
- **Name rules:** trimmed, inner whitespace collapsed, 1 to 40 characters (board 16 finding), `dir="auto"` on the field, single line. The cover and strip show at most 2 lines on desktop (with a step-down font size) and 1 line on mobile, ending in an ellipsis.
- **Address rules.** The server is authoritative, and today it has no format check (the `{3,30}` rule is client-only). Decision: `PATCH /api/profiles/me` validates `username` against `^[a-z0-9_][a-z0-9_-]{2,29}$` and returns 400 `INVALID_USERNAME` otherwise. The pattern accepts every handle valid under today's client rule (`[a-z0-9_]{3,30}`) plus new hyphenated ones. The same PATCH validates `display_name` after trimming and collapsing whitespace: 1 to 40 characters, or 400 `INVALID_NAME`.
- **Derivation is a pure shared function** `deriveAddress(name)`: Cyrillic → Latin transliteration with one fixed table (Russian passport-style ICAO 9303 table: `ж→zh`, `х→kh`, `ц→ts`, `щ→shch`, `ю→iu`, `я→ia`), diacritics stripped via NFKD, lowercase, runs of other characters → `-`, trimmed and cut to 30 characters. If the result is under 3 characters, or the name has no Latin-mappable letters (CJK, Arabic, emoji-only), use `pilot-` plus 4 random base36 characters. The server resolves collisions by appending `-2`, `-3`… silently; a silent suffix is not an error state. That overrides the 16.12 "(proposed)" warning.
- **Name step save** is one `PATCH /api/profiles/me` with `{display_name, username}`, where `username` is the derived address unless the person edited it. A 409 on an edited address shows the inline "taken" message. A 409 on a derived address retries with the next suffix server-side, so the client never sees it. Offline and save errors use the board 16 notice pattern, and the text is kept. `check-username` stays for the inline edit, with the new pattern. The edit field is a full 48px input on mobile (board 16.13 drew it at 36px).

### Persistence

- **Migration `0010_onboarding_state.sql`:** `ALTER TABLE profiles ADD COLUMN onboarded_at TEXT;` then `UPDATE profiles SET onboarded_at = COALESCE(updated_at, created_at) WHERE onboarded_at IS NULL;` so every existing profile is onboarded. The new-profile insert in `functions/api/_lib/users.ts` leaves it NULL. Remote application follows `docs/runbooks/audit-remediation-release.md`, and local preflight doesn't authorize remote writes.
- **`POST /api/profiles/me/onboarded`** (or `onboarded: true` in the PATCH body; the plan picks one) sets `onboarded_at = now` once, idempotently. Called by "I'll do this later" (O6) and by "Open my journal" (O23) before the dissolve starts.

### First flight and import

- **Agent prompt v2** replaces `S.prompt` in `client/import/copy.ts` (EN and RU). It's written with the writing-for-agents skill against the actual grammar of `functions/api/import/_text.ts`. Its first output line is `KUUKI FLIGHTS v2`. It keeps the "can't access email, say so and stop" rule and the no-PII rule. It keeps leaving cancelled/refunded flights out, but lists uncertain ones with a `[maybe cancelled]` note so they reach the review as `review_required`.
- **Parser.** `parseStructuredText` strips an optional leading `KUUKI FLIGHTS v<N>` line (unknown N still parses), ignores a wrapping code fence, and otherwise keeps its current grammar and its all-or-nothing contract: any unrecognised line → `null` → the model path. A reply with the header but one bad line therefore still costs one model call. That's acceptable under "ingest everything".
- **Caps.** `MAX_DRAFTS_PER_BATCH` becomes source-dependent: 500 when `parseStructuredText` succeeded (no model call), 100 for model extraction. Both runtimes enforce it: the bound path in `workers/import/ImportJob.ts` (`persist`, where `local` is already known) and the unbound path in `submitImport`. Production uses the bound path, so the DO cap is the one that matters. The DO's 1 MiB output cap is unaffected, since 500 rows serialize to far less. Confirm stays at `FLIGHT_BULK_CREATE_MAX = 50` items per request, and the client chunks a large save into sequential confirm calls with progress. `MAX_TEXT_LENGTH` (100,000) and the 10 MiB file cap don't change. The `import-parse` bucket (20 per hour) stays, and hitting it shows the board 17 rate-limit state with the time until the next try.
- **Submission** reuses `POST /api/import/jobs` with `submissionOperationId` (idempotent replay on retry) and `ImportSource {type, content, sourceLabel}`. The batch id is kept in the welcome URL (`/welcome/flights?batch=` → `/welcome/review?batch=`) with `replaceState`, as onboarding-flow does today. The gate's resume lookup makes the URL optional.
- **Paste anywhere / drop anywhere** is one document-level handler mounted only on the `flights` step. It ignores events whose target is an editable element other than the step's own. Text, PDF, PNG and JPEG are routed to `ImportSource`. Other types and oversized files show the board 17 error states without a request.
- **Clipboard.** "Paste from clipboard" calls `navigator.clipboard.read()` (image items → `image`, text → `text`) inside the click, falling back to `readText()`. Automatic reading on `visibilitychange` runs only when `navigator.permissions.query({name:'clipboard-read'})` resolves `granted`, and only acts on text that starts with the v2 header (O16). Browser behavior is the per-browser check in Testing Decisions.
- **Reading state.** On `202 {batchId}` (bound) it subscribes to `GET /api/import/batches/:id/events` per the ADR 0001 §9 SSE contract: reconnect with `?after=N`, fetch the snapshot on `snapshot` and close on `end`. On a 200/201 snapshot (unbound) it renders that snapshot directly. The live count and country count come from the drafts received so far. "You can close this tab" is shown only on the bound path, after the 202 (Q1).
- **Error and edge states** (board 17). Every error is a warning note on the same step. The prompt stays visible, and "Copy again", paste and "I'll do this later" stay in reach. Copy from board 17, with these corrections:
  - **Retry never needs a re-paste.** The client keeps the submitted text or file in memory for the life of the step. The server keeps neither (`0007_import_drafts.sql`: pasted text and uploaded bytes are not stored), and that stays true.
  - **Rate limit.** The `import-parse` bucket (20 per hour) applies to every submission, including deterministic ones, so the board 17.10 sentence "A reply in the Kuuki format still works right away" is dropped. The countdown shows only if the 429 carries a retry time. Otherwise it says "Try again in a while".
  - **Over the deterministic cap.** The first 500 become drafts (`ROWS_TRUNCATED`), and the note says how many were left for a second paste. Over 100,000 characters is rejected before any work (`TEXT_TOO_LONG`), for both paths.
  - **Clipboard.** After one denial, "Paste from clipboard" becomes the ⌘V hint (desktop) or a paste box (mobile). An image on the clipboard is handled like a dropped file.
  - **Reading.** It reserves the height of the 4-row list, so the layout doesn't jump. Free text shows placeholder rows plus "Free text takes a little longer." until the first draft arrives. A model failure after partial drafts offers "Review N flights" and "Read the rest again", which resubmits the kept text with a new operation id.
  - **Offline before the server accepts:** "Waiting for a connection", "Keep this tab open for now" and "Try now". It submits automatically on `online`.
  - **"Prompt copied"** is session-local. It persists through error states and is cleared when reading starts. It's never restored on return.
  - **Coming back to a finished batch** lands on review ("Your flights are ready"), never on the prompt (board 17.13 and O4).
- **"Type a flight in"** renders the existing `FlightForm` inside the card at `/welcome/flights?manual=1`. On save it goes straight to `ready` (no review), using the single-flight narrator case (see Q3).

### Import job worker in production (Q1 = a)

This completes the ADR 0001 §9 "T11 wiring handoff", which was left to the architecture owner. The code already supports both runtimes: `POST /api/import/jobs` dispatches to the DO only when `env.IMPORT_JOBS` exists, and `apps/next/worker.ts` passes `env` through to the API handlers.

- **Import Worker configs.** Add production configs next to `workers/import/wrangler.local.toml`, which stays local-only: `kuuki-import` on `kuuki-db` and `kuuki-import-preview` on `kuuki-preview`.
  - Each has `compatibility_date` of at least `2026-10-01`, the `enable_request_signal` and `request_signal_passthrough` flags, and the migration `tag = "import-job-v1"`, `new_sqlite_classes = ["ImportJob"]`.
  - Set `workers_dev = false`, `preview_urls = false` and no routes. The default fetch stays 404.
  - Secret `GEMINI_API_KEY`; `GEMINI_IMPORT_MODEL` stays optional.
- **Binding.** In `apps/next/wrangler.toml`, add `[[durable_objects.bindings]] name = "IMPORT_JOBS", class_name = "ImportJob", script_name = "kuuki-import"`, and the same under `[env.preview]` with `kuuki-import-preview`. Bindings don't inherit into environments.
  - `[env.activation]` stays unbound. It serves no import routes and has no Gemini key.
  - Keep `GEMINI_API_KEY` on `kuuki-next`: the legacy `parse.ts` endpoint and aircraft enrichment still use it.
- **Request signal.** Add `enable_request_signal` and `request_signal_passthrough` to `kuuki-next`'s `compatibility_flags`, so a closed SSE connection unsubscribes.
  - Leave its `compatibility_date` (`2026-08-06`) as it is. Raising it is a separate change with its own risk.
  - If the flags turn out to require the newer date, the plan stops and asks.
- **Deploy order and release gates.** Follow the `deploy-kuuki` skill and the runbook, and update the skill, which currently lists the import DO as out of scope. Order:
  1. Deploy `kuuki-import-preview`, then `kuuki-next --env preview`.
  2. Verify on preview: submit a model-path reply, close the tab for more than 30 seconds, reopen, and the batch has finished. Then run `pnpm verify:import:provider --real-provider` against the preview key.
  3. Do the same for production: `kuuki-import` first, then `kuuki-next`.
  4. Each deploy needs explicit authorization. A gradual deployment (`versions upload` then 0%/100% with the override header) is the recommended route for the `kuuki-next` change.
- **Rollback.** Removing the binding from `kuuki-next` and redeploying returns to the synchronous runtime with no code change (ADR §9). A rollback to an earlier `kuuki-next` version does the same. In-flight batches keep running in `kuuki-import`, which writes to D1 directly, and the unbound events endpoint serves them as snapshots. Leave `kuuki-import` deployed until those batches settle, because its 120-second DO alarm is what ends a stuck one.
- **Records.** Update ADR 0001 §9 and open item 1 to say production wiring was done with this work. GLOSSARY needs no change.

### Review

- **Compact onboarding review** is a new component over the existing `review-model.ts` (`partition`, `readiness`, `isChosen`, `validateValues`) and `questions.ts` (`AirportQuestion`, `StatusQuestion`), using `PATCH /api/import/drafts/:id` with `version` for each fix and `POST /api/import/batches/:id/confirm` for Save. Unsure = `readiness(...) !== null`, or an airport question, or a status question (`review_required`). Low-confidence fields (`LOW_CONFIDENCE = 0.7`) without one of those questions aren't pinned; they show their value in the "Looks right" list. A 409 `DRAFT_VERSION_CONFLICT` refetches the batch and keeps unsent local choices (`withUnsent`).
- **Layout rules** come from boards 15.5/15.9 and the board 18 findings:
  - **Heading.** "{N} flight(s). Check {K}." The subline "Fix what's unsure, or leave it out." shows only when K > 0. At K = 0 it reads "{N} flight(s). All look right." Singular and plural forms apply in EN and RU.
  - **Unsure rows** come first. An empty "Looks right" section is hidden. Upcoming rows carry a muted "Upcoming" tag and are counted in N.
  - **Looks right** previews 7 rows, then "Show all N". It expands in place inside a capped scroll region (desktop max height about one viewport). The card never grows to the full list. The desktop passport is sticky inside the stretched panel.
  - **Airport chips** fit up to 4 on one row. Above 4 they wrap into a grid of 3 columns. Each chip is at least 44×44px and carries the code with a small airport or area name under it. Chips never scroll horizontally. London has 6 airports, so the grid case is the normal one.
  - **Rows** show only the first flight number of a codeshare, and any value that still overflows ends in an ellipsis. A missing value shows "—".
  - **Leave out** collapses an unsure row into a muted row ("Left out" plus a shu "Put back").
  - **Save bar.** The bar reads "Save {M} flight(s)" plus "{U} still unsure / Saving leaves them out." when U > 0. At M = 0 it never says "Save 0". It reads "Nothing to save / Your journal starts empty." with "Start empty", which behaves like "I'll do this later" (O6). A save error reads "Couldn't save / Nothing is lost. Your fixes are kept." with "Try again". Offline reads "You're offline / Your fixes are kept. Save when you're back." with Save disabled.
  - **Mobile below 360px:** the passport strip drops its labels and the name truncates to one line.
  - **No duplicates UI.** A new account has no flights to duplicate.
- **Passport stretch** (desktop): the left panel's height follows the card. Stamps are the distinct countries of the drafts that will be saved, drawn as **pending** visuals until publication. They're decoration in the card, not the canonical Stamp state.

### Reveal

- **Narrator** gains a `welcome` slot. `NarratorSlot` today takes `OverviewScope` in `Trigger.when`. The welcome facts are not an Overview scope, so add a sibling picker `pickWelcomeLine(facts, seed, locale)` in `client/overview/narrator/` that reuses `CORPUS`, `fnv1a32`, `fill` and `formatNumber`. `WelcomeFacts = {flown, upcoming, countries, km, since, topCity?, single?: {o, d}, leftOut}`. Trigger order: `welcome.upcoming` (flown 0, upcoming ≥ 1), `welcome.single` (flown 1), `welcome.big` (flown ≥ 10), `welcome.small` (2 to 9). Variants that need `{city}` fall back to a variant without it when `topCity` is missing. The seed is the member id. Corpus draft: board 19 (EN + RU, 3 each). It's reviewed against the Glossary narrator rules (dry, never mean, RU «вы», no em dashes), and the "{n} flights" lines use EN/RU plural rules.
- **Stats sub-line:** "{countries}, {km} km." plus "{k} left out; add them anytime from your journal." only when k > 0. Left-out leads the line when k ≥ flown. Upcoming only: "{b} upcoming. Add past ones anytime from your journal." Numbers use locale formatting (RU no-break space). Headline `text-wrap: balance`, with a no-break space between number and noun. Caps: headline ≤ 90 characters, sub-line ≤ 100.
- **Facts source:** computed client-side from the confirm results and the saved drafts' fields (distance via `greatCircleKm` in `packages/shared/src/geo.ts`). The reveal never waits for derived-state publication.
- **Stamp text is fixed** across locales ("KUUKI · ENTRY / WELCOME / date"), and the date is the reveal day. Board 19.9 showed the localized RU stamp overflowing.

## Testing Decisions

Runners: `pnpm test` (`test:api` with Vitest over `functions/**` and the shared packages, then the Next app's Vitest over `src/**/*.test.{ts,tsx}`). `pnpm test:next:navigation` runs Playwright against `next:preview` with the `minimal` fixture at 390×844.

**Existing seams to reuse.**
- `apps/next/tests/auth-entry.test.ts` (it already covers create → onboarding at `:127`).
- `apps/next/tests/onboarding.test.ts` and `apps/next/tests/import.test.ts`.
- `functions/test/import-*.test.ts`.
- `client/public/onboarding-{page,name,flow}.test.tsx`. These get rewritten or retired with the old page.
- `narrator/triggers.test.ts`.

**Required checks** (one per failure mode):

1. **Morph without reload (O1, O2).** A Playwright test: create an account from `/` and assert that the card frame element is the same node (a marker set on `window` before Create survives) when `/welcome/name` is reached. Then fill the name → `/welcome/flights`. Back → `/welcome/name` with the value kept. Back again does not show the create step.
2. **Old URLs and gate (O3, O4, O25).** Playwright or a server test: `/onboarding?step=name` → `/welcome/name`. A member with `display_name` and no `onboarded_at` → `/welcome/flights`. A member with an unexpired review batch → `/welcome/review`. An onboarded member visiting `/welcome/name` → `/overview`.
3. **Skip is final (O6).** "I'll do this later" → empty Overview. Reloading `/welcome/flights` → `/overview`.
4. **Migration backfill (O25).** An API test runs migrations over a fixture with profiles that have and lack a username and asserts that every one has `onboarded_at`. A newly inserted profile has NULL.
5. **Address derivation (O10).** Unit table for `deriveAddress`: `Alex Mor` → `alex-mor`, `Александра` → `aleksandra`, `Щукин Юрий` → `shchukin-iurii`, `李明` → `pilot-xxxx` (pattern), `A` → `pilot-xxxx`, a 60-character name → ≤ 30 characters. An API test: a colliding derived address gets `-2`, and an invalid `username` → 400 `INVALID_USERNAME`.
6. **Parser v2 (O17, O24).** `parseStructuredText` had no direct test; add one. The v2 header plus valid rows parse. The header plus a code fence parse. Header-less legacy rows parse. One unknown line → `null`. Caps on both runtimes: in `import-stream.test.ts` (the DO) and in the unbound `submitImport` path, 450 deterministic rows produce 450 drafts, 600 produce 500 with `ROWS_TRUNCATED`, and 150 model-extracted rows truncate at 100.
7. **Prompt/parser contract (O24).** A test feeds the parser the example block embedded in the v2 prompt (EN and RU) and asserts that it parses, so the prompt and the grammar can't drift again.
8. **Paste anywhere (O14).** A jsdom test: a `paste` event on `document` with text submits an import. A paste whose target is another input does not. A dropped `.docx` shows the unsupported-type error without a request.
9. **Review save (O21, O22).** A component test over a fixture batch: unsure rows render first, picking an airport chip sends `PATCH` with the version, and Save sends only chosen drafts, chunked at 50. A save failure keeps choices.
10. **Welcome narrator (O23).** Unit test of `pickWelcomeLine` per trigger (upcoming, single, small, big): the variant is deterministic per seed, `{city}` falls back when missing, RU plurals hold for 1/2/5/11/21, and every corpus line respects the 90-character cap after filling with the board 19 worst cases.
11. **Name length (O8).** The input enforces 40 characters, and the server rejects a `display_name` over 40.
12. **Close-tab note follows the runtime (O18).** A component test: a `202 {batchId}` response shows "You can close this tab" and opens the event stream. A 201 snapshot response shows neither. The existing `import-runtime.test.ts` Miniflare disconnect proof keeps passing unchanged, and it is the evidence that the read survives the tab closing.
13. **Config is deployable.** `pnpm typecheck:import` passes. A `wrangler deploy --dry-run` of each new import config and of `apps/next` (production and preview envs) passes, and CI runs the import dry-runs next to the existing `build:import`.

**Release gate (manual, hosted).** On preview, then production, per the deploy order above: a model-path reply survives a closed tab for more than 30 seconds, and `verify:import:provider --real-provider` passes. Record both in the release notes. This is the "hosted verification remains a release gate" item from ADR 0001 §9.

**Manual, per browser (O15, O16).** Chrome, Safari and Firefox, desktop and iOS Safari. Record each case in the plan's verification log:
- The "Paste from clipboard" result: text, image, denied, empty.
- Whether the automatic read ever fires without a prompt.
- That no permission prompt appears without a click.

**Visual.** Compare against boards 15.x at 1440 and 390, and against the board 16–19 worst cases (long and Cyrillic names, chip overflow, the RU reveal).

## Out of Scope

- Connecting email or calendar directly (OAuth, inbox forwarding), deep links into specific assistants, and help for people whose assistant can't see mail (rejected in the interview).
- A public/private question during onboarding. Visibility stays in Settings.
- A sample or demo reveal on skip, a required first flight, and a question-by-question review deck.
- The import page's full review (duplicates, aircraft enrichment, bulk tools). Onboarding uses the compact review only. After onboarding, imports keep the existing review.
- Dark-theme boards for the new steps. The existing tokens carry the theme, and no separate Paper pass is planned.
- Changing the sign-in or create steps themselves ([auth one-form spec](../auth-one-form/spec.md)), beyond what leaves them.

## Further Notes

### Resolved questions (2026-10-11)

- **Q1 → (a): wire the job worker in production.** Without it, `POST /api/import/jobs` runs extraction inside the request. Cloudflare may cancel that work when the client disconnects, and `ctx.waitUntil` adds at most 30 seconds ([Workers limits](https://developers.cloudflare.com/workers/platform/limits/#duration), [Context](https://developers.cloudflare.com/workers/runtime-apis/context/)), so "You can close this tab" would be false for long model reads.
  - The rejected options were (b) showing the note only for deterministic parses and (c) `waitUntil` with its ceiling.
  - The work is in "Import job worker in production" above. The note is shown only after the bound 202 (O18).
- **Q2 → confirmed.** Backfill marks every existing profile onboarded, including any without a username. O26 derives their address lazily in Settings. SQL can't transliterate, so the migration doesn't try.
- **Q3 → confirmed.** "Type a flight in" saves one flight and goes straight to the reveal (single-flight case), with no review and no "add another".

### Assumptions (reversible, stated so they can be caught)

- The name cap of 40 characters and the cover/strip truncation come from board 16, not the interview.
- A silent `-N` suffix on collision of a derived address. Board 16.12's warning notice applies only to an edited address.
- The address pattern `^[a-z0-9_][a-z0-9_-]{2,29}$` keeps existing handles valid. The `/fly/[username]` route keeps its name.
- Welcome stamps in the card are decorative. Canonical stamp pressing still follows ADR 0001 after publication.
- The deterministic cap is 500, which the interview gave as an example ("for example up to 500").

### Context

- Code facts were gathered on 2026-10-11 at `main` (`4149f7f8`). The latest migration is `0009_schedule_time_provenance.sql`.
- D1 migration 0010, the two import Worker deploys and the `IMPORT_JOBS` binding follow `docs/runbooks/audit-remediation-release.md`, and deploys go through the `deploy-kuuki` skill. This spec authorizes none of them; each needs its own go-ahead.
