# Kuuki — Application Flow

## Current Next routes

The current app is [apps/next](../apps/next/src/app/), with server gates in
[gates.ts](../apps/next/src/server/gates.ts). This is the current route and journey inventory.

| Routes                                                                   | Current behavior                                                                                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `/`, `/signin`, `/signup`                                                | One AuthCard: Continue signs in or opens the create step in place. Authenticated members continue to Overview or unfinished onboarding. |
| `/forgot-password`, `/activation-request`                                | The same in-place get-back-in request and inbox states, using `/api/auth/link/request`.                                                 |
| `/reset-password`                                                        | Single-new-password card with early token scrubbing; completion returns to `/?notice=password-saved` and requires explicit sign-in.     |
| `/password-updated`                                                      | Redirects to `/?notice=password-saved`.                                                                                                 |
| `/activate`, `/activate.html`                                            | Next-owned isolated one-use activation completion. Returns to the main-origin saved-password notice and requires explicit sign-in.      |
| `/account-deleted`                                                       | Signed-out deletion confirmation.                                                                                                       |
| `/welcome/name`, `/welcome/flights`, `/welcome/review`, `/welcome/ready` | Onboarding inside AuthCard: name, flight capture, review and saved-flight summary. Owned durable batches resume processing or review.   |
| `/onboarding`, `/onboarding?step=*`                                      | Compatibility redirect to the member's welcome resume step, Overview once onboarded, or sign-in for guests.                             |
| `/overview`                                                              | Period totals, insights, upcoming/awaiting journeys and missing-aircraft recovery.                                                      |
| `/journal`                                                               | Paged flight log; search/filter/sort/page state belongs to this URL.                                                                    |
| `/journal/[id]/edit`, `/add`, `/import`                                  | Own-flight editing, separate manual Capture and unified multi-file import/review; successful saves return to Journal.                   |
| `/passport`                                                              | Collection, region/detail sheets, claims/ground visits, awaiting arrivals and period-aware map.                                         |
| `/passport/manage`                                                       | Aircraft in journal: bulk aircraft assignment. `?countryCode=CC` redirects to `/passport?country=CC`.                                   |
| `/fly/[username]`                                                        | Public profile for visitors or private owner profile; live visibility gates protect private records.                                    |
| `/leaderboard`                                                           | Public eligible rankings; authenticated own rank/notifications follow the same eligibility policy.                                      |
| `/settings`                                                              | Dirty-state-protected profile, privacy, appearance, export and reauthenticated deletion.                                                |
| `/me`                                                                    | Resolves to the own profile or Settings when no address is set; unfinished onboarding resumes Welcome and guests go to sign-in.         |
| `/dashboard`, `/flights`, `/journey`, `/landing`                         | Compatibility redirects to Overview, Journal, Overview and `/`.                                                                         |

Member routes require an authenticated profile with completed onboarding. Public profile and
leaderboard pages use the member shell for authenticated viewers and the brand
shell for guests. Desktop navigation is Overview / Journal / Passport /
Leaderboard, plus Add and account controls. Mobile tabs are Overview / Journal /
Add / Passport / Me. Header titles follow the current route.

The [Worker](../apps/next/worker.ts), [API handlers](../functions/api/) and
[deploy procedure](skills/deploy-kuuki/SKILL.md) describe runtime,
authentication and host contracts. No hosted acceptance is implied by this map.

## Current journeys

Guests use one card, preserving their email and password into the create and recovery steps.
Onboarding runs inside AuthCard through Name, Flights, Review and Ready. Name
saves the profile before flight capture; manual and import saves feed the Ready
summary. Skipping or opening the journal records onboarding as complete before
continuing to Overview. On reload, [welcome.ts](../apps/next/src/server/welcome.ts)
selects the resume step from the profile, owned unexpired batches and saved
flights; the [welcome route](<../apps/next/src/app/(card)/welcome/[step]/page.tsx>)
checks the requested step and batch before rendering.

Import retains review rows and uncertain-save recovery. Published evidence
controls country stamps; pending publication is shown honestly. Journal Undo is
presented in the member shell's toast region, but the Journal owns the pending
deletion: leaving before its timer cancels it, nothing is sent, and the shell
shows a cancellation notice ("Delete cancelled"). The notice is suppressed when
the departure is an identity reset (sign-out or owner switch), and it is shown
only by a shell of the same owner. Bulk Undo restores rows without restoring
the prior selection.

Settings protects unsaved changes on links, history and unload. Deletion requires
password reauthentication and succeeds only after the server cascade. Activation
and recovery scrub tokens at the start of their early bootstrap; completion remains separate from
sign-in. Functional evidence and deferred visual/release gates are tracked in the
[redesign handoff](plans/2026-10-04-redesign-2.0-implementation-handoff.md).

## Historical reference

The [former Vite flow](archive/2026-10-12-vite-app-flow.md) preserves the retired screen inventory
and journey diagrams.
