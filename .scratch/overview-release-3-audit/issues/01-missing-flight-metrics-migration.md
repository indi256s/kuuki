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

All eight code findings and bounded CI diagnostics are resolved. All eight PR checks passed on `ad17e99`, and [PR47](https://github.com/indi256s/kuuki/pull/47) merged as `6cc8f8ff93664667637696a6b95d2395ebce1f78`, tree-identical to the audited head. The separate clean main checkout is `/private/tmp/kuuki-r3-release-6cc8f8f`; [post-merge CI/CD37747939613](https://github.com/indi256s/kuuki/actions/runs/37747939613) and React Doctor37747939621 passed. Frozen-lockfile install, package build and Next production build also passed from that clean checkout. Fresh sequential ledger reads after promotion confirmed the same missing0008+0009 on both explicit targets. No preview/production deployment or remote D1 mutation has been performed by this audit thread.

Reviewed migration hashes (SHA-256):

- `0008_flight_metrics.sql`: `bc8b724bb7eaadd0b4f8efa138a582763cad2aaf58a6daeb9a7d9496852c2428`.
- `0009_schedule_time_provenance.sql`: `7d0fe21021eaba3ddd6d569183df0a683507c6e90e67ef856ff7a1bb05d78535`.

Read-only pre-hold production deployment observation on8October: `kuuki-next` version `f8a09476-76aa-4d32-a321-946e30382846`; `kuuki-activation` version `c85e28e9-998a-4b18-ad37-cca3396790c8`, each100%. These are existing deployments, not Release3 deployments by this thread. Refresh both before any approved hold/deploy; the runbook requires complete writer inventory and proof, not just these two versions.

The next permission boundary is the separately scoped writer-hold and backup/restore preparation for the two explicit targets. Applying migrations or generated backfill/publication SQL requires subsequent admission and exact reviewed artifacts; broad app deployment approval supplies none of those gates.
