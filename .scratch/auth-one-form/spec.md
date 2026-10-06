# Spec: One-form sign-in and "Can't sign in?"

Status: ready-for-agent

Design source of truth: the Paper file **"Kuuki — Auth redesign"** (file id `01M48F4SHK61AZS2FH5P5JPRY7`, https://app.paper.design/file/01M48F4SHK61AZS2FH5P5JPRY7). Read it through the Paper MCP. Use `get_jsx` and `get_computed_styles` for exact values, and `get_screenshot` only to orient. Never read sizes or colors off a screenshot. Board names are given below in quotes. The **"4.1 Spec — build notes"** board covers motion, focus, hit areas and reduced motion. It is part of this spec.

| Row | Boards |
| --- | --- |
| 1 · One form | "1.1 One form — Continue", "1.2 One form — create step", "1.3 One form — checking", "1.4 One form — wrong password" |
| 2 · Getting back in | "2.1 Get back in — request link", "2.2 … check your inbox", "2.3 … set password", "2.4 … link expired" |
| 3 · Themes | "3.1 Themes — desktop, light", "3.2 … mobile, dark", "3.3 … mobile, light" |
| 4 · Spec | "4.1 Spec — build notes", "4.2 Spec — accent proposal" |

## Problem Statement

Today, someone who arrives at Kuuki has to decide which of several doors to use before they can do anything:

- The home page is a marketing page with a hero, sample flight cards and a FAQ. It sits between visitors and the form. Most people who reach Kuuki already know why they came.
- The sign-in and sign-up pages are separate. People must remember whether they ever made an account, then pick the matching page. A wrong guess ends in "Email or password is incorrect" or "An account with this email already exists", and the fix is to go somewhere else.
- Sign-up asks for the password twice.
- Getting back into an account is split across "Forgot password?" and "Continue to activation". Choosing between them requires knowing an internal account state ("activated" versus "migrated") that people cannot see.
- Activation emails open on a separate, unbranded page that looks like a different product.
- The brand on these screens is inconsistent: a tile logo, a teal activation page and six accents, two of which (kincha and sumi) read poorly.

## Solution

There is one card, at `/`, with one form: **Email**, **Password**, **Continue**. People don't choose a mode. Kuuki works out which case applies:

- **Known email, correct password:** they are signed in and taken to their journal.
- **Known email, wrong password:** they see an inline error. A clear secondary action emails them a link to get back in.
- **Email with no journal:** the same card becomes the create step. It says "No Kuuki journal uses {email} yet." with a **Change** link, keeps the password they typed, relabels the field "Create a password" with the hint "At least 8 characters", and offers **Create account**. They don't retype anything, confirm a password, or leave the app to verify an email.

**"Can't sign in?"** is the single way back in, whatever state the account is in. Kuuki emails one link. It opens a branded Set-password page, which is either the activation variant or the reset variant depending on the account. After saving, the person returns to the card with "Password saved. Sign in with it now."

The card uses a text-only "Kuuki" wordmark: "Ku" in the accent color and "uki" in the text color. It sits on a field of small planes angled along a flight path, with a くうき watermark and a rotating tagline. It has light and dark themes, a bottom sheet on mobile, and five accents: terracotta, ai, matcha, asagi and sakura.

## User Stories

### Arriving

1. As a returning member, I want `/` to show the sign-in form straight away, so that I can get to my journal without passing a marketing page.
2. As a new visitor, I want `/` to let me start a journal with the same form, so that I don't have to find a separate sign-up page.
3. As a signed-in member, I want `/` to keep sending me straight to my journal, so that the card never gets in my way.
4. As someone with an old `/signin` or `/signup` bookmark, I want those addresses to show the same card, so that my bookmarks still work.
5. As someone with an old `/forgot-password` or `/activation-request` link, I want it to open the "Can't sign in?" request state, so that old emails and bookmarks still lead somewhere useful.
6. As a visitor, I want the card to say "Welcome to Kuuki" and "Sign in, or use a new email to start your journal.", so that I understand one form serves both purposes.

### Continuing

7. As a member, I want to type my email and password and press Continue, so that I am signed in with one action.
8. As a member using a password manager, I want the fields marked as a username field and a current-password field, so that my saved credentials fill in and submit correctly.
9. As a member, I want pressing Enter in either field to submit, so that I don't have to reach for the button.
10. As a member, I want the button to read "Checking…" with a spinner while Kuuki works, at full opacity and not clickable, so that I know my request is in progress and I can't double-submit.
11. As a member who mistyped my password, I want "Email or password is incorrect." under the password field with an icon, so that I know what went wrong without relying on color.
12. As a member who mistyped my password, I want an "Email me a link to get back in" button right below the error, so that I can recover without hunting for a link.
13. As a member who mistyped my password, I want my email to stay filled in, so that I only need to retype the password.
14. As a member, I want the wrong-password message to look the same whether my account was migrated or created here, so that the card never asks me to know my account's history.
15. As a migrated member whose account has no usable password yet, I want Continue to show the same wrong-password state, with its link-to-get-back-in action, so that I am steered to activation without being told my account type.
16. As someone who signed in too many times, I want a clear "too many attempts" message with an icon, so that I know to wait rather than keep guessing.

### Creating a journal

17. As a new visitor, I want Continue with an unused email to turn the card into "Start your journal" in place, so that I see where I am without a page load.
18. As a new visitor, I want a status line saying "No Kuuki journal uses {my email} yet.", so that I can catch a typo in my email before creating an account.
19. As a new visitor who mistyped my email, I want a **Change** link in that status line, so that I can go back to the form with my email ready to edit.
20. As a new visitor pressing Change, I want focus on the email field with its text selected, so that I can retype it immediately.
21. As a new visitor, I want the password I already typed kept and relabeled "Create a password", so that I don't type it twice.
22. As a new visitor, I want the hint "At least 8 characters" next to the field, so that I know the rule before I submit.
23. As a new visitor using a password manager, I want the field to switch to new-password autocomplete on the create step, so that my manager offers to generate and save a password.
24. As a new visitor, I want focus to move to **Create account** when the create step appears, so that pressing Enter again creates my journal.
25. As a screen-reader user, I want the "No Kuuki journal uses…" line announced as a status, so that I hear why the card changed.
26. As a new visitor, I want no confirm-password field, so that sign-up takes one less step. The reveal (eye) control lets me check what I typed.
27. As a new visitor whose password is too short, I want an inline error on the password field, so that I can fix it in place.
28. As a new visitor, I want Create account to sign me in and take me to onboarding, so that I can start logging flights immediately.
29. As a new visitor who never has to leave Kuuki to confirm an email, I want account creation to finish in this tab, so that I don't switch apps.
30. As a new visitor whose email was registered elsewhere a moment before I pressed Create account, I want "This email just got a journal. Continue to sign in.", so that I understand the race and know what to do.
31. As a new visitor whose account was created but who could not be signed in automatically, I want a clear message to sign in, so that I am not left wondering whether the account exists.

### Getting back in

32. As anyone who can't sign in, I want one "Can't sign in?" link next to the password label, so that I don't have to choose between "forgot password" and "activate".
33. As someone pressing "Can't sign in?" after typing an email, I want the request state to open with that email filled in, so that I just confirm and send.
34. As someone pressing "Can't sign in?" with an empty email field, I want the request state to open without an error, so that I am not scolded before typing.
35. As someone requesting a link with a malformed email, I want an inline field error, so that I can fix it before sending.
36. As someone requesting a link, I want the button to read "Sending…", disabled at full opacity, so that I know it's working.
37. As someone who requested a link, I want a "Check your inbox" state, announced as a status, that names the email it went to, so that I know where to look.
38. As someone waiting for the email, I want "Send again" after 60 seconds, announced once when it becomes available rather than every second, so that I can retry without being flooded.
39. As someone who asked too often, I want "Too many links requested. Try again in an hour.", so that I know the limit and the wait.
40. As someone requesting while email is down, I want "Email links are paused right now. Try again later.", so that I know it isn't my fault.
41. As someone requesting a link for an email with no journal, I want the same "Check your inbox" response, so that the link request never reveals who has an account.
42. As a migrated member, I want the link to open the activation variant of Set password, so that I can choose my first password here.
43. As a member who forgot my password, I want the link to open "Choose a new password" / "Save password", so that the wording fits a reset.
44. As anyone setting a password, I want a single password field plus a hidden username field holding my email, so that my password manager saves the new credential against the right account.
45. As anyone who opens an expired or used link, I want a "Link expired" state with a way to request a new one, so that I'm not stuck.
46. As anyone who just saved a password, I want to land on the card with "Password saved. Sign in with it now." and my email filled in, so that I sign in with my new password and my manager remembers it.
47. As a security-conscious member, I want a reset to sign out my other sessions, so that anyone using my old password is locked out. This is current behavior and is kept.
48. As a keyboard user, I want focus to move to the new heading on every recovery state change, so that I always know where I am.
49. As a recovery-state user, I want no rotating tagline, so that the screen stays calm while I fix access.

### Brand, themes and layout

50. As a visitor, I want a text-only "Kuuki" wordmark: "Ku" in my accent and "uki" in the text color, read aloud as "Kuuki", so that the brand is recognisable and follows my accent.
51. As a desktop visitor, I want a brand panel with a field of small planes angled along a flight path and a くうき watermark, so that the page feels like Kuuki and not a generic login.
52. As a visitor who prefers reduced motion, I want the planes frozen, the create step swapped in without a slide, and no press scale, so that nothing moves that I didn't ask for.
53. As a visitor on a slow device, I want the planes to pause when the panel is off screen or the tab is hidden, so that the page doesn't waste battery.
54. As a visitor, I want a short tagline under the form that changes between visits, so that the page has a little personality without demanding attention.
55. As a mobile visitor, I want the brand area on top and the form in a bottom sheet with 48px inputs and 16px text, so that it fits one hand and doesn't zoom on focus.
56. As a visitor in light or dark mode, I want the card in my theme, so that it matches my system.
57. As a visitor, I want language, theme and help controls in the card corner, each at least 44×44, so that I can adjust the page before signing in.
58. As a Russian-speaking visitor, I want every new message in Russian, so that the card is fully localised.
59. As a member who had chosen kincha or sumi, I want to land on terracotta automatically, so that I never see a broken or missing accent.
60. As a member, I want asagi as a new accent choice, so that I have a teal option that replaces the old ones.
61. As a touch user, I want every text link, including "Can't sign in?" and "Change", to have a 44px tall hit area that never overlaps the input below it, so that I don't mis-tap.

### Operator

62. As the operator, I want the new API path in the generated route inventory, so that CI doesn't fail on drift.
63. As the operator, I want the activation link to keep opening on the isolated activation origin, so that the token page still loads no app scripts and no session.
64. As the operator, I want the legacy Vite app and its activation page left untouched, so that rollback still works.
65. As the operator, I want DESIGN.md and the GLOSSARY to describe the new card, accents and recovery flow, so that future work doesn't regress to the old rules.

## Implementation Decisions

### Continue endpoint

- Add `POST /api/auth/continue`. It takes `{ email, password }`, requires same-origin, and returns no-store, like the existing sign-in handler.
- Outcomes:
  - **Account exists, password verifies:** a session exactly as sign-in issues it today. The response body has the same shape as sign-in's.
  - **Account exists, password does not verify:** 401 `INVALID_CREDENTIALS`. This includes migrated accounts on the RESET_REQUIRED sentinel.
  - **No account:** run `dummyVerify` so the timing matches the wrong-password path, then return 200 `{ next: 'create' }`. Nothing is created or stored.
  - **Malformed email or empty password:** 400 with the existing error codes.
- Password policy is `current`: any non-empty value. The 8-character rule applies only on the create step.
- Rate limits:
  - Every call consumes the existing per-IP sign-in bucket (`signin:<ip>`, 20 per 15 minutes).
  - A `create` answer also consumes the per-IP signup bucket (`signup:<ip>`, 10 per hour). This caps how fast someone can probe for unused emails.
  - Exhausting either bucket returns 429 with the existing code.
- **Account-existence leak, accepted:** `create` versus 401 tells a caller whether an email has an account. The current sign-up endpoint already leaks this through 409 `EMAIL_TAKEN`, an accepted LOW finding (security finding #8). This design keeps the same exposure, bounded by the buckets above, and hides nothing new. Record the acceptance in the handler comment. The user rejected email-first or email-verified sign-up because it forces an app switch, so that alternative is closed.
- The existing sign-in and sign-up endpoints stay. Create account calls sign-up unchanged; it already has no confirm-password field server-side. Sign-in stays for the legacy app and any existing callers.

### Get-back-in link endpoint

- Add `POST /api/auth/link/request` with `{ email }`. It always returns the generic `{ ok: true }`. In the background (`waitUntil`), it looks the account up:
  - **RESET_REQUIRED account:** send the activation email, using the existing activation helper and the isolated activation origin.
  - **Account with a usable password:** send the password-reset email, using the existing recovery helper.
  - **No account:** send nothing.
- The 503 check runs before any lookup. If either the activation origin and sender or the recovery origin and sender is unconfigured, return 503. The response then never depends on account state.
- Rate limits use their own buckets in the existing style: `link-ip:<ip>` at 10 per hour, then `link-email:<keyed email>` at 3 per hour, keyed with the existing HMAC email key. Error codes: 400 `INVALID_EMAIL`, 429 (existing code), 503.
- The existing activation-request and password-reset-request endpoints stay. Rollback uses them, and they may later become thin wrappers.
- Tokens, expiry, one-use semantics and session revocation on reset don't change.

### Client state machine

The card is one client component with explicit states. This shape comes from the prototype:

```ts
type CardState =
  | { step: 'form'; error?: 'invalid' | 'rate' | 'network'; notice?: 'password-saved' }
  | { step: 'checking' }
  | { step: 'create'; email: string; error?: 'short' | 'taken' | 'rate' | 'network' }
  | { step: 'creating'; email: string }
  | { step: 'request'; email: string; error?: 'invalid' | 'rate' | 'paused' }
  | { step: 'sending'; email: string }
  | { step: 'sent'; email: string; resendAt: number }
```

- Focus rules from the "4.1 Spec — build notes" board:
  - Moving to `create` focuses **Create account**. This is the one documented exception to focusing the heading.
  - **Change** returns to `form` with focus on the email field and its text selected.
  - Every other state change focuses the new heading, which has `tabindex=-1`.
- The create-step status line has `role=status`. The inbox body has `role=status`.
- Editing the email while in `create` returns to `form`. The create step is only valid for the email it was checked against.
- A 409 `EMAIL_TAKEN` from Create account returns to `form` with the message "This email just got a journal. Continue to sign in."
- On the create step the password input switches autocomplete from `current-password` to `new-password`. The email input keeps `username`.

### Set-password pages

- **Reset variant:** the existing Next reset-password route, restyled to board "2.3" (reset copy: "Choose a new password" / "Save password") and "2.4" for expired or used tokens.
- **Activation variant:** keep the isolated activation-origin contract. The origin gate runs before assets, API, rendering and session lookup, and serves only the activation page, its script and the completion API.
  - Next's build emits its own static activation page and script. They are styled to board "2.3", activation variant, and "2.4", and follow the same gate contract and emailed `/activate` URL.
  - Next stops copying the legacy app's activation files.
  - The legacy app's own activation page stays in place for rollback.
- **After saving, in both variants:** go to `/` on the main origin. The card shows the `password-saved` notice "Password saved. Sign in with it now.", with the email pre-filled where it can be passed safely. Never pass the token or the password. There is no automatic sign-in.
  - The existing password-updated route and the activation origin's GET redirect both resolve to this.
  - The legacy `mode=signin` query is accepted and ignored.

### Routes

- `/` renders the card for signed-out visitors and keeps the existing member redirect.
- `/signin` and `/signup` render the same card. Add a canonical link to `/`.
- `/forgot-password` and `/activation-request` render the card in the `request` state.
- Delete the landing hero, the sample flight cards and the FAQ. Delete their tests and any strings that only they use.
- Regenerate the API route inventory with the generator script for the two new paths. Never hand-edit it.

### Visual system

- **Visual values:** take every value from the boards via the Paper MCP. Tokens live only in the Next stylesheet. Map board colors to existing tokens. If a board value has no token, add a role-named token there rather than writing a raw value.
- **Wordmark:** one element with `aria-label="Kuuki"`. "Ku" uses the accent-text token and "uki" uses the text token, with −0.04em tracking. It replaces the tile logo on auth surfaces.
- **Plane field:**
  - 30 planes on desktop (12 small, 10 medium, 8 large) and 14 in the mobile sheet header.
  - Each plane is rotated −18.4° and moves along (+400, −800) using transform only.
  - The field pauses when it is off screen (IntersectionObserver) or the page is hidden. It freezes under reduced motion.
  - Planes stay clear of the wordmark.
  - The くうき watermark sits behind the planes.
- **Taglines:**
  - Shown only on the form and create steps. The rotation set lives in i18n.
  - The two strings on the boards are the seed: "Snap a boarding pass. We'll figure it out." and "Halfway to the Moon, apparently."
  - One is picked per page load. It never animates under reduced motion.
- **Mobile:** below the desktop breakpoint, use the bottom-sheet layout from boards "3.2" and "3.3". Inputs are 48px tall with 16px text.
- **Accents:**
  - The accent list becomes terracotta (default), ai, matcha, asagi and sakura. Use the exact light and dark values from board "4.2".
  - Accent is stored in the `kuuki_accent` cookie and applied by the bootstrap script, not D1. A stored `kincha` or `sumi` is rewritten to `terracotta` the first time it's read, in both the bootstrap script and the appearance client.
  - The bootstrap script also maps legacy localStorage color names to accents. Update that map so nothing resolves to a removed accent: yellow → terracotta, and teal and cyan → asagi.
  - Remove the kincha and sumi token blocks and add asagi. The accent swatch picker follows the list automatically.
- **Press and hover:**
  - Primary buttons scale 0.96 over 120ms on press.
  - Focus rings are 2px using the existing focus token, with a 2px offset.
  - Hover colors apply only on fine pointers.
  - Text links get 44px tall hit areas with equal negative margin. "Can't sign in?" grows up and sideways only.

### Copy and i18n

- Every new string ships in EN and RU through the existing i18n catalogue.
- The RU strings are drafted by the implementer and flagged for the user's review in the PR description.
- Remove these strings: "Moving an existing account? Continue to activation", the confirm-password label and the sign-in/sign-up mode switch.

### Documentation

- **DESIGN.md:**
  - D2 lists the five accents.
  - The logo mark becomes the text wordmark.
  - The brand panel allows the plane field and its paused, reduced-motion behavior. This replaces "at most 3 planes" and "ambient loops never animate".
  - The "Sign in ↔ sign up ↔ forgot password axis x" transition row becomes the in-place create-step swap.
- **GLOSSARY:**
  - Add **Get-back-in link**: the single "Can't sign in?" email link, which resolves to activation or reset depending on the account.
  - Add **Create step**: the in-place state after Continue finds no journal.
  - Update **Password reset** and **Login enablement** to say both are reached through the get-back-in link.
- Run the update-docs-after-feature skill for any runbook text that names the old routes.

## Testing Decisions

Good tests here check behavior a person or a client can see: status codes and bodies, emails sent or not, sessions issued, what is on screen, where focus lands, and what is announced. They don't assert component internals, state-machine variable names or CSS class names. No new test hooks or seams. Use the two existing seams below. Add a component test only for a state neither seam can reach.

### Seam 1: API handler integration

This seam uses the existing harness: an in-memory D1 database, a fake request context, a background task array and a fake mail sender. Prior art: the existing auth, password-recovery and activation-sender tests.

- **Continue:**
  - A correct password issues a session.
  - A wrong password returns 401.
  - A RESET_REQUIRED account returns 401.
  - An unknown email returns `{ next: 'create' }` and creates no rows.
  - A malformed body returns 400.
  - The signin bucket returns 429 after 20 calls.
  - The signup bucket returns 429 after 10 `create` answers.
  - Wrong-password and unknown-email calls both perform a password verification (the dummy verify), checked through a spy on the verify path or its effect, not timing.
- **Link request:**
  - Always returns `{ ok: true }`.
  - A RESET_REQUIRED account sends one activation email.
  - An active account sends one reset email.
  - An unknown email sends nothing.
  - 400 for a malformed email.
  - IP and email buckets return 429.
  - 503 before lookup when either sender or origin is unconfigured. The same 503 comes back for known and unknown emails.
- **Sign-up:** existing tests stay green. Add one test that sign-up succeeds with no confirm field and returns 409 for a taken email.
- **Route inventory:** the generator's drift check covers it.

### Seam 2: Playwright journeys against the built Next app

Prior art: the existing auth-entry journey tests. They sign in repeatedly with their own `CF-Connecting-IP` header, like the shell test.

- `/` shows the card for signed-out visitors and redirects members. `/signin` and `/signup` show the same card. `/forgot-password` opens the request state.
- **Continue with known credentials** lands in the journal.
- **Wrong password** shows the inline error and the "Email me a link to get back in" action, and keeps the email.
- **Unknown email:**
  - The create step shows the status line with the email.
  - The password is kept, the label reads "Create a password", and autocomplete is `new-password`.
  - Focus is on Create account.
  - Create account reaches onboarding.
- **Change** returns to the form with focus on the email field and its text selected.
- **Short password** on the create step shows the inline error.
- **Can't sign in?** with an empty email opens the request state without an error. Send shows "Check your inbox". The resend control is disabled and becomes enabled after the cooldown; use the clock API, not a real wait.
- **Reset link** through the set-password page lands on `/` with "Password saved. Sign in with it now." Get the token from the test's mail capture or a seeded token, as current recovery journeys do.
- **Expired token** shows "Link expired".
- **Accents:** a `kincha` cookie renders terracotta.
- **Visual coverage:** run one light, one dark and one mobile-viewport journey, each checking the key elements are visible. No pixel snapshots.
- Run the full navigation suite, not just the auth file. Shared controls break journeys in other files.

### Other checks

- **Activation origin:** the existing composed-Worker smoke and boundary smoke cover the activation-origin gate. Run both after the static activation page moves into Next's build.
- **Tokens:** the existing token test enforces the accent list against the stylesheet. Update its expectations to the five accents.

## Out of Scope

- The legacy Vite app, including its activation page and sign-in screens, beyond keeping rollback working.
- Carrying over legacy Supabase bcrypt passwords, or any design built around migrated users. Migrated accounts are served only by the get-back-in link, as today.
- Email-first, magic-link or email-verified sign-up. The user rejected these because they force an app switch.
- Passkeys and OAuth providers.
- A product demo, sample flights or any showcase on the card.
- Changes to token expiry, mail transport or the activation-origin hosting setup.
- Remote D1 writes. No schema change is needed: accents live in a cookie.

## Further Notes

- **Verified versus inferred:**
  - **Read from source:** the existing handlers' buckets and codes, the activation-origin gate, and the accent cookie contract.
  - **From the boards:** the visual values.
  - **Pending on the user:** the tagline rotation set beyond the two seeded strings, and the RU copy.
- **Order of work:** the API endpoints with Seam 1 tests can land before any UI. The card, routes, recovery pages and accents follow, then the docs update.
- **Hosted verification:** delivery and activation on the hosted activation origin still need the release runbook's evidence. Passing local tests doesn't establish hosted delivery.
- **No attribution:** commits and PRs carry no Claude or Anthropic attribution.
