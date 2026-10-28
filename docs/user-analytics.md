# User statistics

The private dashboard lives at `/admin/users`. The account menu links to it only
for the configured owner. Set server-only `ADMIN_USER_ID` to that account's exact
`users.id`, separately in each environment. An absent or malformed value disables
access. Guests go to sign-in; other accounts get 404. Both the route and the data
service check access before aggregate reads. No account list, names, email
addresses, travel routes or session details reach the dashboard.

For local development, use `ADMIN_USER_ID` in the ignored `apps/next/.dev.vars`
beside the Next Worker configuration. For hosted environments, use a server
Worker setting; never expose it through `NEXT_PUBLIC_*`. This feature does not
configure a hosted owner or deploy anything.

## Metrics

All counts describe accounts and records currently retained in D1. Deleted
accounts and entries disappear from both current counts and historical series.
Migration `0016_user_activity.sql` adds a daily presence ledger and its collection
start. It leaves existing journals, profiles and historical records unchanged.

| Metric                        | Definition                                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Total users                   | Rows in `users`                                                                                                                 |
| New users / registrations     | Retained accounts by `users.created_at`, normalized to UTC                                                                      |
| Active users: DAU / WAU / MAU | Distinct retained accounts with a recorded visible, signed-in visit today / over 7 / over 30 UTC calendar days, including today |
| Added flights or journeys     | Distinct current users who added at least one retained flight or nondeleted ground journey in the period                        |
| Entries added                 | Retained flights and nondeleted rail/road journeys by creation timestamp, including planned travel                              |
| Finished welcome              | Profiles with `onboarded_at`; includes choosing to add entries later and migration backfills                                    |
| Have journal entries          | Accounts with a flight, nondeleted ground journey, country claim or manual ground visit                                         |
| Public passports              | Public profiles with a nonblank username                                                                                        |
| Imported flights              | Accounts with at least one retained flight whose source is `ai_import`                                                          |
| Journal entries               | All retained flights and nondeleted rail/road journeys, including planned travel                                                |

The 7/30/90-day selector affects registrations, contributors, added entries and
the daily table. Adoption percentages and journal totals always describe all
retained accounts and records. Periods start at UTC midnight and include today
through the displayed snapshot time. The comparison uses the preceding equally
long calendar period; today's incomplete day can affect the comparison.

DAU/WAU/MAU use fixed windows independent of the period selector. The existing
identity bridge reports presence after confirming the signed-in user, only while
the page is visible: on initial load, account changes, focus, visibility changes and the existing
15-minute check. Successful reports are deduplicated per UTC day in the tab;
the database enforces one row per account/day across tabs and devices. A tab
that remains visible across midnight reports on its next check. Background tabs
and failed/offline reports are not counted; collection errors do not block Kuuki.

The UI shows the first collection date and an em dash before any visits are
recorded. Early WAU/MAU counts cover only the elapsed collection period; no visits
are backfilled from sessions, import batches, account ages or journal timestamps.
The ledger stores only account ID, UTC day and first observation timestamp,
without URLs, IP addresses or device information. Account deletion explicitly
removes its activity rows; the collection start remains.

Retention and import success rates remain unavailable. Manual country records
affect journal adoption, but are excluded from the flight/journey creation metrics.

## Release requirement

The dashboard and collection endpoint require migration `0016_user_activity.sql`
before deploying this version. Verify it through the normal local migration and
restore checks. Remote migration still requires the target, writer hold,
backup/restore, schema admission and separate authorization in the
[release runbook](runbooks/audit-remediation-release.md). No remote migration or
deployment is performed by implementing this feature.

## Ownership and checks

- [Server admission](../apps/next/src/server/user-analytics.ts) and
  [access predicate](../functions/api/_lib/userAnalyticsAccess.ts)
- [D1 aggregates and DTO](../functions/api/_services/userAnalytics.ts)
- [Dashboard](../apps/next/src/client/admin/user-analytics.tsx)
- [Presence endpoint](../functions/api/me/activity.ts) and
  [visible-tab reporter](../apps/next/src/client/user-activity.ts)
- [Calculation/access tests](../functions/test/user-analytics.test.ts) and
  [route-data gate tests](../apps/next/src/server/user-analytics.test.ts)

Reads use one D1 batch and return aggregates only. `POST /api/me/activity` requires
authentication and CSRF, uses the server's account and clock, ignores client
identity/date fields, and returns only the recorded UTC day.
Check with `pnpm typecheck:api`, `pnpm test:api`, the Next unit tests,
`pnpm next:build`, `pnpm --filter @kuuki/next typecheck:worker`,
`pnpm next:smoke` and `pnpm test:next:navigation`.
