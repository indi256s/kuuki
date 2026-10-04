# Transit-only country validation: read-only proposal

Status: proposal. **Nothing here has been executed.** Running any query against production requires separate, explicit authorization from the owner. Do not run these against production, and do not run them from this repository's tooling without that authorization.

## Goal

Estimate how many accounts and countries are "transit-only" under the plan's C3 connection rule: a country whose only flight evidence is a connection endpoint. Result informs the prospective-default and cleanup-banner scope; it does not replace the owner's scope decision.

## Rule under test (C3)

- Order each account's flights by reliable UTC instants (`departure_utc`, `arrival_utc`), stable `id` ties.
- Leg A links to leg B when `A.destination = B.origin`, gap `B.departure_utc - A.arrival_utc` is 0 to 24 hours, and B is the unique plausible next leg.
- Missing times: same or next calendar-day (`date`) matches with the same airport are candidates labelled **estimated**.
- Ambiguous branches (more than one equally plausible next leg) are **review-only**, never counted as transit.
- A maximal chain contributes its start and final country; other endpoint countries inside the chain are the transit candidates (the incoming destination country and the matched outgoing origin country).

## Source tables

From `db/migrations/0001_init.sql`..`0005`: `flights` (`user_id`, `date`, `origin`, `destination`, `departure_utc`, `arrival_utc`, `is_upcoming`), `airports_reference` (`iata`, `country_code`), `country_claims` (`user_id`, `country_code`), `ground_visits` (`user_id`, `country_code`), `legacy_visit_evidence` (`user_id`, `country_code`, `airport_iata`, `contributes`), `visits` (airport aggregate). Excluded: `is_upcoming = 1` flights.

## Proposed SQL (SQLite/D1, read-only SELECTs)

### 0. Denominators

```sql
-- Accounts with at least one completed flight
SELECT COUNT(DISTINCT user_id) AS accounts_with_flights
FROM flights WHERE is_upcoming = 0;

-- Account/country pairs with any flight evidence (both endpoints)
WITH ends AS (
  SELECT f.user_id, a.country_code
  FROM flights f JOIN airports_reference a ON a.iata = f.origin
  WHERE f.is_upcoming = 0
  UNION
  SELECT f.user_id, a.country_code
  FROM flights f JOIN airports_reference a ON a.iata = f.destination
  WHERE f.is_upcoming = 0
)
SELECT COUNT(*) AS account_country_pairs, COUNT(DISTINCT user_id) AS accounts
FROM ends;
```

### 1. Candidate links (exact-time, estimated, ambiguous)

```sql
WITH legs AS (
  SELECT f.id, f.user_id, f.date, f.origin, f.destination,
         f.departure_utc, f.arrival_utc
  FROM flights f WHERE f.is_upcoming = 0
),
cand AS (
  SELECT a.user_id, a.id AS in_id, b.id AS out_id,
         a.destination AS hub,
         CASE
           WHEN a.arrival_utc IS NOT NULL AND b.departure_utc IS NOT NULL
             THEN 'exact'
           ELSE 'estimated'
         END AS bucket
  FROM legs a JOIN legs b
    ON b.user_id = a.user_id AND b.id <> a.id AND b.origin = a.destination
  WHERE
    (a.arrival_utc IS NOT NULL AND b.departure_utc IS NOT NULL
      AND (julianday(b.departure_utc) - julianday(a.arrival_utc)) BETWEEN 0 AND 1.0)
    OR
    ((a.arrival_utc IS NULL OR b.departure_utc IS NULL)
      AND julianday(b.date) - julianday(a.date) BETWEEN 0 AND 1)
),
counted AS (
  SELECT *, COUNT(*) OVER (PARTITION BY in_id) AS next_options
  FROM cand
)
SELECT user_id, in_id, out_id, hub,
       CASE WHEN next_options > 1 THEN 'ambiguous' ELSE bucket END AS bucket
FROM counted;
```

Uniqueness here is per incoming leg; the final implementation should also reject a competing equally plausible predecessor. Sanity-check the date-only `BETWEEN` arithmetic on a sample before relying on counts.

### 2. Transit-only countries

A country is transit-only for an account when every flight endpoint touching it is a candidate transit endpoint (bucketed above), and the account has **no** other evidence for it. Never count a country with any of the following as transit-only:

```sql
-- Preserved evidence: claims, ground visits, contributing legacy evidence
SELECT user_id, country_code FROM country_claims
UNION SELECT user_id, country_code FROM ground_visits
UNION SELECT l.user_id, COALESCE(l.country_code, a.country_code)
  FROM legacy_visit_evidence l
  LEFT JOIN airports_reference a ON a.iata = l.airport_iata
  WHERE l.contributes = 1
    AND COALESCE(l.country_code, a.country_code) IS NOT NULL;
-- legacy rows may carry only airport_iata (country_code is nullable), so resolve via airports_reference
```

Compute per `(user_id, country_code)`: `total_endpoints` (all completed flight endpoints in that country) versus `transit_endpoints` (endpoints that are a linked chain's interior hub from query 1). Transit-only iff `transit_endpoints = total_endpoints`, the country is not the chain start or final country, and the pair is absent from the preserved-evidence set. Report the three buckets separately: **exact-time**, **estimated (date-only)**, **ambiguous (review-only, excluded from the headline)**. A country mixing buckets is classified by its weakest bucket.

### 3. Report

- Accounts with at least one transit-only country, over `accounts_with_flights`.
- Transit-only account/country pairs, over `account_country_pairs`, by bucket.
- Distribution of transit-only countries per account (0, 1, 2, 3+).
- Pairs excluded because of claims, ground visits or legacy evidence (to show preservation).
- Aggregate counts only; do not output user ids, emails, or flight rows.

## Limits

- **Deleted flights and edit history cannot be recovered from current tables.** `flights` has no history and deleted rows are gone, so past connections that were edited or removed are invisible; counts are a lower-bound snapshot of current data, not a measure of post-date edit/delete frequency.
- `is_upcoming` is the only lifecycle signal today (no awaiting/logged split yet); all `is_upcoming = 0` flights are treated as completed.
- Date-only legs lack timezone context; estimates can over- or under-match.
- Airports missing from `airports_reference` have no country and must be reported as an unknown bucket.

## Authorization

Executing any of this against production needs separate authorization. Until then it may only be reviewed, or run against a local or synthetic fixture database.
