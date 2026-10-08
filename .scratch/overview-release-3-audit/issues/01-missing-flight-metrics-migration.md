# Release 3 deployment requires the separately gated metrics migration

Status: blocked
Type: task

Read-only ledger inspection on 8 October 2026 found exactly migrations 0001–0007 on both targets. `0008_flight_metrics.sql` is absent from both; there were no extra migration names. The audit fix also adds `0009_schedule_time_provenance.sql`; both files now require separate admission and authorization on each target.

| Target | Database ID | Missing migration |
| --- | --- | --- |
| Production `kuuki-db` | `2a8e3895-6a98-4473-8d7b-a43ca0c0026f` | `0008_flight_metrics.sql`, `0009_schedule_time_provenance.sql` |
| Preview `kuuki-preview` | `80e0c789-c1ab-4aa5-a6fe-e65c6e6cb74c` | `0008_flight_metrics.sql`, `0009_schedule_time_provenance.sql` |

Account: `5cadcff0282e54f3ff1d7062d4dbb97a`. The inspection used only `SELECT name FROM d1_migrations ORDER BY id`, through the existing Next Wrangler configuration; it did not use `migrations list` or perform remote writes.

The candidate reads `flights.duration_source`, `flights.zones_overflown` and `profiles.overview_prefs` and uses `idx_flights_route_times`. Migration 0008 supplies those nullable columns and that index. Migration 0009 adds the server-owned `times_from_schedule` marker so accepted schedule clocks cannot become shared measured evidence after edits or backfill. The ledger gate must pass before either preview or production application deployment.

The owner's authorization for this release explicitly excludes remote D1 writes. Follow [the Release 1 production sequence](../../../docs/runbooks/overview-release-1.md#production-sequence) and [audit remediation release](../../../docs/runbooks/audit-remediation-release.md#cutover-order): explicit target, separately authorized writer hold, fresh backup and restore proof, schema admission, then separately authorized migration, backfill and publication. Production and preview require their own admission. Do not run migration application from the Release 3 checkout, waive guards, or treat CI/promotion as schema admission.

Complete independent audit fixes and promotion/CI while this gate is blocked. No preview/production deployment or remote D1 mutation has been performed by this audit thread.
