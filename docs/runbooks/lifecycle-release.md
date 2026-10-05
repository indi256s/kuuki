# Flight lifecycle: preview enablement and production release (T09)

Status: instructions only. Nothing here has been run against a hosted environment, and no task changes any checked-in
config. Design and invariants: [ADR 0001](../adr/0001-flight-lifecycle-and-import-drafts.md) sections 2, 5, 7, 8 and 10.
This runbook adds to [the audit-remediation cutover order](audit-remediation-release.md); it does not replace its holds,
backup and isolation gates.

`MAINTENANCE_MODE` means two different things, and the checked-in values differ:

| Config | Value | Meaning of the flag there |
| --- | --- | --- |
| `workers/maintenance/wrangler.toml` (default and `preview`) | `"true"` | The cron returns before any DB access. This is the only config that holds the cron, and the only one T09's cron enablement concerns. |
| `wrangler.toml` (Pages, default and `preview`) | `"false"` | `"true"` would make API routes answer 503 `MAINTENANCE` before any session or database work (an application-wide hold). `"false"` is normal serving. |
| `apps/next/wrangler.toml` (default and `preview`) | `"false"` | `"true"` would block the member routes and the API at the Next worker. `"false"` is normal serving. |

The Pages/Next `"false"` is not an enablement of anything lifecycle-specific: the owner sync, queue, confirm and transit
review run whenever the application serves requests. A production application hold (`"true"` on Pages/Next) is applied by
the deployer at deploy time under the audit-remediation runbook, not by editing these files. T09 flips none of the three.

## What T09 changes at runtime

| Piece | Behaviour | Needs |
| --- | --- | --- |
| `GET /api/me/awaiting`, `POST /api/flights/confirm`, `GET`/`POST /api/me/transit-review` | Owner-scoped queue, atomic confirmation, optional transit cleanup | Migrations `0006` and `0007` |
| `POST /api/flights/sync-upcoming` | Upcoming to awaiting, awaiting to `automatic` logged, then inline repair; returns `{synced, awaited, autoConfirmed, more}` | Same |
| Next shell `ActivityBridge` | After identity is confirmed, calls sync at most once per 10 minutes per owner across all tabs (shared `localStorage` timestamp), with up to two follow-ups while `more` is true. Never for guests | Next worker build |
| Maintenance cron | Held while `MAINTENANCE_MODE = "true"`. When enabled: due transitions (50 users per direction, 100 flights per user), repair, leaderboards, cleanup | Maintenance worker deploy |

While the cron is held, the owner sync is the only path that advances flights. A member who never opens the app keeps
`upcoming` flights until the cron runs. Auto-confirm is therefore delayed, never lost: deadlines are stored and are not
recomputed, so a late pass catches up without moving eligibility.

## Gates that stay closed

Do not set `PREVIEW_ISOLATION_VERIFIED`, `GIT_DEPLOY_DISABLED`, `PRODUCTION_RELEASE_SHA` or `MAINTENANCE_DEPLOY_READY` from
this runbook. Each follows its own evidence in the audit-remediation runbook.

## 1. Preview (isolated D1 `kuuki-preview`, never production)

Pre-checks, from the repository root on the reviewed commit:

1. `pnpm test:api`, `pnpm typecheck`, `pnpm typecheck:api`, `pnpm typecheck:maintenance`, `pnpm --filter @kuuki/next test`,
   `pnpm next:build && pnpm --filter @kuuki/next typecheck:worker && pnpm test:next:navigation` are green.
2. Read back the preview bindings and confirm the database id is the preview one (`80e0c789-...`), not the production one.
3. Export the preview database and keep the export (`wrangler d1 export kuuki-preview --remote --output <file>`).
4. Run the read-only precheck `db/prechecks/0006_flight_lifecycle.sql` against preview and stop on any reported row.

Schema, then code, in this order:

5. Apply `0006` and `0007` together (`wrangler d1 migrations apply kuuki-preview --remote`, with the preview environment's
   `migrations_dir`). Applying only one breaks account deletion.
6. Deploy the Pages/Next preview build, then the maintenance worker with its `preview` environment. The maintenance worker
   still carries `MAINTENANCE_MODE = "true"` (cron held); Pages/Next serve normally.

Owner-sync proof (cron still held):

7. Sign in as a preview test member with flights dated yesterday and last week. Open Overview. Expected: the shell posts
   `sync-upcoming` once, the page refreshes, yesterday's flight is `awaiting` (counted as completed), last week's is `logged`
   with `confirmation_source = 'automatic'`. Reload, or open a second tab, within 10 minutes: no second request. A signed-out tab sends none.
8. `GET /api/me/awaiting` (read-only: repeat it and compare `revision`), then confirm one flight with
   `POST /api/flights/confirm` and replay the same `operationId`: the response is identical and `revision` does not move.

Cron proof, preview only (the cron setting is the maintenance worker's flag, not the Pages/Next one):

9. Enable the cron on the preview worker without editing the checked-in file, by overriding the variable at deploy time:
   `wrangler deploy --config workers/maintenance/wrangler.toml --env preview --var MAINTENANCE_MODE:false`
   (confirm the flag with `wrangler deploy --help` for the installed version). A dashboard-edited variable is overwritten by
   the next deploy, so prefer the flag.
10. Watch two cycles (5 minutes each). `maintenance_success` should show `dirty_count: 0`, `overdue_remaining: 0` and
    `rolled_over` / `auto_confirmed` counts. Any `maintenance_failure` while a backlog drains is expected: a cycle that leaves
    due transitions, dirty users or a failed user is deliberately a failure so it alerts and retries. It must clear on its own.
11. Return to the hold: redeploy from the checked-in config (no `--var`).

## 2. Production release

Only after the audit-remediation gates (source freshness, backup and restore proof, hold on every writer entrypoint) and
the preview proof above are accepted and recorded.

Gates before `0006` reaches production (ADR section 10 and the A1 release gate):

1. **Remote-D1 A1, all three checks**, on an isolated remote D1 (preview), recorded with the output:
   (a) trigger creation: `wrangler d1 migrations apply` applies `0006`, including every `CREATE TRIGGER ... BEGIN ... END;`,
   with no statement-splitting error and the six triggers present in `sqlite_master`;
   (b) batch rollback: a `db.batch` that violates a `RAISE(ABORT)` trigger or a CHECK leaves none of its other statements applied;
   (c) `meta.changes`: record what D1 reports for an UPDATE that fires adapter triggers (Miniflare counts trigger writes).
   Only pre-lifecycle writers' counts depend on (c); T09 counts with `RETURNING` and `changes()`. If (a) or (b) fails the
   invariants become application-only and the deploy order needs a short write hold, which is an owner decision (ADR risks).
2. **Pre-lifecycle bundle against a post-`0006` database** (the waiver in ADR section 10): build the last pre-lifecycle Pages
   bundle (`abe1d80`), run it against the isolated database after `0006`/`0007`, and exercise create, bulk create, edit, the old
   sync and the old cron rollover. Expected: the adapter triggers keep rows valid, old counters may read inflated, nothing
   errors, and a following lifecycle-aware repair publishes. Do this before step 3 below. Until it passes, `0006` does not go
   to production.

Release steps:

3. Keep the hold. Save a SQL export and a Time Travel bookmark.
4. Apply `0006` and `0007` together (additive, no drops). Run `db/prechecks/0006_flight_lifecycle.sql` first and stop on any row.
5. Deploy the Pages/Next build that contains T07 to T09, with the maintenance worker still held. This build is the rollback
   floor (ADR section 10): do not roll back below the post-T07 `functions/api` bundle once `0006` is applied.
6. Smoke as the existing owner and the approved verification account: ownership A/B (a foreign flight id answers exactly like
   a missing one on `confirm` and `transit-review`), CSRF on every write, sync, queue, confirm, replay, transit review read.
7. Decide separately whether to enable the cron. The owner sync already moves flights for active members, so enabling the cron
   is only needed for members who do not visit. If enabled, use the same two-cycle observation as in preview and keep the
   dashboard alerts: success older than 15 minutes or any failure that does not clear within three cycles.

## Rollback

- Hold again: redeploy the maintenance worker from the checked-in config (`MAINTENANCE_MODE = "true"`). This stops cron
  transitions only; the owner sync remains until the Next build is rolled back.
- Roll back the application only to a post-T07 build. Flights already auto-confirmed stay `logged` with
  `confirmation_source = 'automatic'` and keep their stored `arrival_transit`; nothing reverts them.
- Migrations are not rolled back. A pre-lifecycle writer keeps working through the adapter triggers, which is the
  documented fallback, not the target.

## Signals

`maintenance_success` fields: `rolled_over` (flights moved to awaiting), `auto_confirmed`, `overdue_remaining`, `dirty_count`,
`dirty_oldest_age_seconds`. `sync-upcoming` returns `more: true` while a bounded pass left due flights; the shell follows up
at most twice, then waits for the next 10-minute window.
