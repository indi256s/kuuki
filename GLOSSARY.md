# Kuuki — Domain Context (Glossary)

Ubiquitous language for the Kuuki project. Glossary only — no implementation
details, no plans. Started 2026-06-23 during the Phase 8 prod-login grilling.

## Auth & migration vocabulary

### Login enablement
Establishing a usable credential in a migrated account after its owner proves email ownership through a get-back-in link, preserving the original journal identity. Distinct from replacing an already usable credential through password reset.

### Password reset (flow)
Replacing an activated account's password after its owner proves identity through an expiring, one-use get-back-in link. Completing the change revokes existing sessions.

### Get-back-in link
An email link that proves ownership and permits choosing a password, whether the journal needs login enablement or password reset. The owner does not need to know which account state applies.
_Avoid_: Magic sign-in link — saving the password does not sign the owner in automatically.

### Create step
The account-creation confirmation shown when the entered email has no Kuuki journal. It retains the entered email and password while the person confirms that they want to start a journal.

### Migrated account
One of the 26 `users` rows ported from the old Supabase backend. Owns
flights / visits / stats / badges keyed by `user_id`. Its original Supabase
password is **unrecoverable** (bcrypt hashes were not in the export).

### RESET_REQUIRED sentinel
A deliberately *structurally-invalid* value for `password_hash` (it contains no
`$`, so `verifyPassword` bails before any crypto). Marks an account as
intentionally **un-loginnable** until a real credential is seeded. The default
state of every migrated account.

### Pepper (AUTH_SECRET coupling)
Every password hash is `HMAC-SHA256(AUTH_SECRET, password)` *before* PBKDF2.
Consequence: a stored hash only verifies under the **same** AUTH_SECRET that
made it. A hash made with a different secret silently fails at sign-in.

### Verification account
A disposable account used to verify activation and sign-in. Staging checks use
synthetic accounts and personal test credentials. Production legacy accounts
remain on the RESET_REQUIRED sentinel until their owners activate them.

## Flight lifecycle & evidence vocabulary

### Flight lifecycle
The state of a flight: **upcoming** (departure date is after today in the
captured timezone), **awaiting** (departure date has passed, arrival not yet
confirmed; counts in completed totals), **logged** (confirmed or saved as
past/today). _Avoid_: "draft" as a flight state.

### Confirmation source
How a logged flight became logged: `save` (past/today save), `user` (explicit
confirmation), `automatic` (seven-day auto-confirm), `legacy` (migration
provenance for pre-existing flights, not an explicit confirmation).

### Import batch
One import run (document or text) that yields draft rows for review before any
flight is created.

### Draft
An import draft row: an extracted, unreviewed candidate flight. Not a flight and
not a lifecycle state. Drafts and awaiting flights are counted separately.
_Avoid_: "draft flight".

### Connection / transit (`arrival_transit`)
A connection is a chain of legs where arrival airport equals the next departure
airport, 0–24 hours apart, with a unique next leg. Transit means the traveler did
not leave the airport, so the connection endpoint adds airport evidence but no
country evidence. Date-only same/next-day matches are _estimated_; ambiguous
branches are review-only. _Avoid_: "layover trip", "stopover".

### Claim
A manually claimed country (`country_claims`) with no flights. Immediately
pressed; shown with a text and shape cue.

### Ground visit
A recorded land or sea visit to a country (`ground_visits`). Immediately pressed.

### Stamp
A country's mark in the passport. **Pressed** when supported by logged, legacy,
claim or ground-visit evidence; **pending** when its only evidence is awaiting
flights. Pending does not increase the pressed-stamp total.

### Country evidence
The recomputable per-country record of why a country counts (flights, legacy
evidence, claims, ground visits, with dates and counts). Separate from `visits`,
which remains the airport aggregate.

### Derived publication / revision
Derived data (stats, visits, country evidence, leaderboards) is recomputed from
canonical records and published under a revision. A mutation can be committed
while publication is still pending; clients refetch status instead of replaying
the mutation.

### Enrichment
Background filling of flight details (aircraft, distance, duration) from
reference data after a flight is saved; tracked by `enrichment_status`.

## Flight metrics vocabulary

### Duration source
The provenance of a flight's duration: `times` (the flight's own local times),
`route_median` (observed durations on its directional route), `schedule`
(accepted scheduled times), or `estimate` (a model or retained historical value).
Absent when duration is unknown.

### Zones overflown
The count of UTC-offset changes along the great-circle route at the departure
instant. Returning to an earlier offset counts another change. Unknown when
either endpoint lacks coordinates. _Avoid_: number of distinct IANA zones.

### Clock shift
The difference between the destination and origin UTC offsets, accounting for
daylight saving at the departure instant. Separate from zones overflown.

## Overview vocabulary

### Maker slot
One of six fixed aircraft categories: Airbus, Boeing, Embraer, ATR, Other or
Unknown. Other covers recognized aircraft families outside the four named
slots; Unknown means aircraft information is absent or unrecognized. Slots
follow the current type designation: A220 is Airbus; the Embraer slot covers
E-Jets, while its other recognized families belong to Other.

### Alliance at date
The operating carrier’s verified alliance participation on the flight date.
The membership start is inclusive and its end exclusive. Unknown, unaffiliated
or former carriers have no assumed membership outside a verified active span;
current membership, parent ownership and successor identity do not establish
historical membership.

### Head to head
A comparison of actual flight counts: Airbus versus Boeing, shorter-haul
versus long-haul, or daytime versus night departures. Each pair reports excluded
flights whose evidence does not fit either side; untimed flights are excluded
from the day/night comparison.

### Record cabinet
A collection of actual journal records with the witnessing flight’s date,
route, value and provenance where applicable. Aggregate records retain the
witness evidence without a private flight identifier. A record is an observed
fact, not a fitted trend or an invented representative flight.

### Ghost layer
The all-completed-flight baseline shown behind the current filtered view for
context. Ghosts do not add extra matching flights or increase scoped totals.

### Narrator
A deterministic, data-backed English or Russian line that comments dryly on
the journal’s evidence. It remains secondary to facts, coverage and instructions;
Russian addresses the owner as «вы».

### Bento
The reorderable Overview arrangement of full-width sections and narrow/wide
sections in a responsive grid. On mobile, sections become tiles that open their
full content in sheets; hidden sections can be restored.
