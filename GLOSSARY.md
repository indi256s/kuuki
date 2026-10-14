# Kuuki — Domain Context (Glossary)

Ubiquitous language for the Kuuki project. Glossary only — no implementation
details, no plans. Started 2026-06-23 during the Phase 8 prod-login grilling.

## Auth & migration vocabulary

### Login enablement

Establishing a usable password credential in a migrated or Google-only account after its owner proves email ownership through a get-back-in link, preserving the original journal identity. Distinct from replacing an already usable credential through password reset.

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

A deliberately _structurally-invalid_ value for `password_hash` (it contains no
`$`, so `verifyPassword` bails before any crypto). Marks an account as
intentionally **unable to sign in with a password** until a real credential is
seeded. The default state of every migrated account; a verified authoritative
Google identity can enable sign-in to the existing journal without a password.

### Pepper (AUTH_SECRET coupling)

Every password hash is `HMAC-SHA256(AUTH_SECRET, password)` _before_ PBKDF2.
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

### Owner confirmation

The journal owner's explicit statement that a journey occurred and which
countries were visited, conveyed directly or through an agent acting on their
instruction. A ticket, elapsed date or an agent's inference is not owner
confirmation.

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

Filling missing details of a saved flight from reference data or evidence tied
to that flight. Enrichment preserves recorded values and leaves a detail
unknown when the available evidence does not support it.

### Scheduled times

Departure and arrival times published for the dated flight, distinct from
times observed when it was performed. Accepted scheduled times remain
identified as scheduled rather than becoming evidence of actual timing.

### Flight time event

The event to which a departure or arrival time refers: departure from or
arrival at the gate, takeoff, or landing. Its planned or observed timing is
distinct from the first or last recorded observation of an aircraft.

### Flight occurrence

A specific performance of an airline service on a dated directional leg,
which may appear in several travelers' journals. Matching a date and marketed
flight number alone does not establish the same occurrence.

### Independent flight sources

Sources of flight evidence with demonstrably separate primary data origins.
Different websites reproducing the same upstream data do not constitute
independent confirmation; an unknown origin does not establish independence.

## Ground travel vocabulary

### Rail journey

A journey between cities by train, including suburban rail between cities.
It contains one or more rail legs deliberately grouped by the traveler; urban
rail and routine commuting are outside this concept.

### Rail leg

The part of a rail journey traveled on one train between boarding and alighting
stations. Changing trains starts another leg; return travel is a separate leg.

### Ground border crossing

Actual entry into a country by land during a rail journey or road trip. It
counts as a country visit even in transit without a stop; a planned crossing
does not establish a visit.

### Road trip

A travel itinerary by car to one or more cities, including its stops and any
return travel. The traveler decides which itineraries qualify, with no minimum
distance or duration.
_Avoid_: Any car ride — ordinary car travel does not by itself constitute a road trip.

## Flight metrics vocabulary

### Duration source

The provenance of a flight's duration: `times` (the flight's own local times),
`route_median` (observed durations on its directional route), `schedule`
(accepted scheduled times), or `estimate` (a model or retained historical value).
Absent when duration is unknown.

### Zones overflown

The approximate count of UTC-offset changes along 50 km samples of the shortest spherical airport arc at the departure
instant. Returning to an earlier offset counts another change. Unknown when
either endpoint lacks coordinates. _Avoid_: number of distinct IANA zones.

### Clock shift

The difference between the destination and origin UTC offsets, accounting for
daylight saving at the departure instant. Separate from zones overflown.

### Geographic crossings

Internal side changes of the shortest spherical arc
between airport coordinates: equator, polar circles at ±66.5634°, and the
antimeridian. Boundary contacts, tangencies, coincident boundaries and longitude
changes at a pole are excluded. Antipodes retain the deterministic arc fallback.
These are estimates, not evidence of actual aircraft trajectories. Missing
coordinates reduce weighted `locatedFlights` coverage; they do not establish zero.
The internal `dateLine` name denotes the antimeridian, not the International Date Line.

## Profile vocabulary

### Passport

The one page that shows where a traveler has been: identity, the visited
total, the stamp collection (cards or atlas), pending countries, achievements,
rankings and a small flight block. `/passport` is the owner view; `/fly/[username]`
is the public view of the same structure, and `/passport?as=visitor` previews it.
Countries come from flights, ground journeys and manual marks; one country is
one stamp whatever its sources. Travel is still entered in its own journal.
_Avoid_: separate Profile page, Stamps page

### Profile

The identity part of the Passport (name, handle, avatar, visibility) and the
settings behind it. Since the unified Passport (ADR 0007) the profile has no
page of its own: `/me` and "My profile" lead to `/passport`. Analysis belongs
to Overview.
_Avoid_: Flight profile, account page

### Profile visibility

Whether a profile is **public** (readable by anyone with its link) or
**private** (others see only that it is hidden). Public Records are a separate
consent on top of a public profile.

### Passport publication

Which countries a public Passport shows (`profiles.passport_publication`).
**Flights** (the default, and every pre-existing profile) publishes flight
countries only, as the profile did before ADR 0007. **All** publishes every
pressed country from any source, never pending ones. The owner opts in from
Settings after a preview, and opting out restores the flight-only set. In both
modes the public Passport carries country codes only: no dates, counts,
sources, notes or routes.

### Hidden country

A pressed country the owner removed from their Passport presentation
(`passport_hidden_countries`). It leaves the cards, the atlas and both public
publication modes, but its records, evidence and statistics stay, and the
owner's visited total still counts it, with the hidden number shown beside it.
Hiding is reversible (Undo, or Restore from Hidden) and does not remove the
country from other public surfaces such as the flight Overview.
The preference counts only while the country is pressed: if it loses its
last support or falls back to pending, the owner sees it as usual (pending
block), while the public projection keeps leaving it out.
_Avoid_: deleted country, removed stamp

### Achievement ladder

One fact (flights, distance, time aloft, countries, airports, continents,
airlines, aircraft types) drawn as one object whose rungs are its states. A
member holds a ladder at its highest earned rung; the cabinet shows one tile
per ladder.
_Avoid_: Badge, medal, tier

### Rung

One step of an achievement ladder: a threshold, a localized rung name and a
state of the ladder's object, shown as "Rung N of M". Earned, next or later;
there are no metals.
_Avoid_: Level, tier, badge

### Founding crew

The rare milestone for members who joined before launch. It is not a ladder, is
never "next up", and keeps its English name in both locales.
_Avoid_: Early adopter badge

## Overview vocabulary

### Maker slot

An aircraft manufacturer category from the reference catalog, or Other or
Unknown. All models of a named manufacturer share its slot; A220 counts as
Airbus. Other covers recognized aircraft whose manufacturer has no named slot;
Unknown covers absent or unrecognized aircraft. Only slots with flights appear
as chart rows.

### Alliance at date

The operating carrier’s verified alliance participation on the flight date.
The membership start is inclusive and its end exclusive. Unknown, unaffiliated
or former carriers have no assumed membership outside a verified active span;
current membership, parent ownership and successor identity do not establish
historical membership.

### Travel patterns

Complete compositions of scoped flights by aircraft manufacturer, haul and
local departure schedule. Every flight contributes to the denominator, including
unknown evidence. Day means 06:00–21:59 and night means 22:00–05:59 in the
departure airport's local time; night departure does not imply overnight travel.
Expanded filtered evidence compares against the entire lifetime journal.

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
