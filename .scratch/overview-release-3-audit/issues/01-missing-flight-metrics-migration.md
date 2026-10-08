# Release 3 schema applied; backfill and publication approval pending

Status: blocked
Type: task

The owner approved migration0008+0009 on production and preview. On8October, standard Wrangler applied exactly those two files from admitted clean main `e37dc10200d30b1eac354cb329e7a3088fec557b`, preview first, then production. Both ledgers now contain exactly0001–0009.

| Target | Database ID | Schema status |
| --- | --- | --- |
| Production `kuuki-db` | `2a8e3895-6a98-4473-8d7b-a43ca0c0026f` | 0008+0009 applied and verified |
| Preview `kuuki-preview` | `80e0c789-c1ab-4aa5-a6fe-e65c6e6cb74c` | 0008+0009 applied and verified |

Account: `5cadcff0282e54f3ff1d7062d4dbb97a`. No initial schema was rerun and no later migration exists. Exact SHA-256:

- `0008_flight_metrics.sql`: `bc8b724bb7eaadd0b4f8efa138a582763cad2aaf58a6daeb9a7d9496852c2428`.
- `0009_schedule_time_provenance.sql`: `7d0fe21021eaba3ddd6d569183df0a683507c6e90e67ef856ff7a1bb05d78535`.

Writer hold is active on both production Workers and both preview app Workers. Code, runtime and every other binding/value are unchanged. All568discovered app/Pages deployment/custom/alias HTTP entrypoints reject or block writes; full raw before/after snapshots show zero changes. Existing Pages wildcard Access denies everyone with no exceptions; Pages Git deployment is disabled. Preview version URLs are disabled. Production maintenance Worker is absent; existing preview maintenance remains guarded before DB access. Current held versions: production next `0bc3863f-5e2d-4769-a65d-a421cdf6d79a`, activation `63dd4493-406c-49be-b8e1-c5859ef32f35`; preview app `894284b2-4aac-480f-85ce-ad5951644eaa`, preview activation `ac1a34a4-be64-4a9f-9215-1e4c641dcd15`.

Fresh held exports and Time Travel bookmarks are private. Exact35-table restoration including all original values and sequences passed in NodeSQLite3.53.3, with integrity and zeroFKviolations. Historical Python3.39.4 coordinate-literal parser differences were rejected; no tolerance/data rewrite was used. Seven-dimension pre-schema admission and localD1 rehearsals passed. Remote post-migration snapshots preserve every old row/column and match the rehearsed80-object schema; new nullable values and marker defaults are correct.

The separately prepared remote backfill proposal changes411production flights/18users. Affected-journal distance773,324→832,292km and duration82,909→84,379minutes; one previously empty distance journal gains128,414km. Preview changes2flights/2users to4,114km/422minutes. SQL hashes:

- Production: `0449acadef4d09e5ec56e4e98d18f38d6125ee401cfafcd35addfb87dd329c71`.
- Preview: `61302de69c7157413772ab90e658d047bf6defd176faf2757374cd3b918544f7`.

Fresh local rehearsal applied each guarded flight UPDATE with exactlyone matched row, repaired18production users, left dirty/metricsNull0, published25rows for5eligible users, preserved all135historical badges and added4awards. Preview repaired2users, with0eligible leaderboard users. Both proposals independently regenerate byte-for-byte; applied flight values match, replanning returns zero changes, all24canonical/non-metric tables and non-metric flight fields remain intact. Independent GPT‑6.1 Sol high review found no open correctness defect.

Private migration evidence: `/private/tmp/kuuki-r3-d1-cutover-rZBTsHTx`. Exact SQL/manifests/operator dry-run/rehearsal: `/var/folders/hy/6ftrhvk16w942tqtvgsxy6pc0000gn/T/kuuki-r3-backfill-bg4nm6`. Retain these private artifacts; no journal records or credentials belong in Git.

Next approval: execute these guarded backfills, temporary authenticated operator creation/secret setup/deploy, repair/leaderboard publication and deletion on both targets, plus the isolated remote batch/CAS rollback proof required by the [Release1 production sequence](../../../docs/runbooks/overview-release-1.md#production-sequence). Operator names prepared: `kuuki-overview-release-operator` and `kuuki-overview-release-operator-preview`. The request is pending; no remote backfill/operator operation or R3 application deployment has run. Full-source freshness must be rechecked under hold immediately before application; CAS does not pin coordinates or median-donor rows. Preserve the hold through admission and application, then complete the already-authorized preview/production deployment and health verification.

[PR47](https://github.com/indi256s/kuuki/pull/47) is merged as code SHA `6cc8f8ff93664667637696a6b95d2395ebce1f78`. [Main CI/CD37747939613](https://github.com/indi256s/kuuki/actions/runs/37747939613) and React Doctor37747939621 passed; the admitted main candidate differs only in four documentation records and reuses those checks. Dirty MAIN and unrelated worktrees are preserved.
