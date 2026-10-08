# Release 3 schema, publication and deployment completed

Status: resolved
Type: task

The owner approved migration0008+0009 on production and preview. On8October, standard Wrangler applied exactly those two files from admitted clean main `e37dc10200d30b1eac354cb329e7a3088fec557b`, preview first, then production. Both ledgers now contain exactly0001–0009.

| Target | Database ID | Schema status |
| --- | --- | --- |
| Production `kuuki-db` | `2a8e3895-6a98-4473-8d7b-a43ca0c0026f` | 0008+0009 applied and verified |
| Preview `kuuki-preview` | `80e0c789-c1ab-4aa5-a6fe-e65c6e6cb74c` | 0008+0009 applied and verified |

Account: `5cadcff0282e54f3ff1d7062d4dbb97a`. No initial schema was rerun and no later migration exists. Exact SHA-256:

- `0008_flight_metrics.sql`: `bc8b724bb7eaadd0b4f8efa138a582763cad2aaf58a6daeb9a7d9496852c2428`.
- `0009_schedule_time_provenance.sql`: `7d0fe21021eaba3ddd6d569183df0a683507c6e90e67ef856ff7a1bb05d78535`.

The approved migration hold preserved all four app Workers' code, runtime and other binding values. All568discovered HTTP entrypoints rejected/blocked writes and raw snapshots proved no drift. Existing Pages wildcard Access denies everyone and Pages Git deployment is disabled. Preview immutable version URLs were disabled during the hold; the accepted preview deployment restores its source configuration. Production maintenance Worker remains absent and preview maintenance remains guarded before DB access. The temporary app holds are now released as recorded below.

Fresh held exports and Time Travel bookmarks are private. Exact35-table restoration including all original values and sequences passed in NodeSQLite3.53.3, with integrity and zero FK violations. Historical Python3.39.4 coordinate-literal parser differences were rejected; no tolerance/data rewrite was used. Seven-dimension pre-schema admission and localD1 rehearsals passed. Remote post-migration snapshots preserve every old row/column and match the rehearsed80-object schema; new nullable values and marker defaults are correct.

The separately prepared remote backfill proposal changes411production flights/18users. Affected-journal distance773,324→832,292km and duration82,909→84,379minutes; one previously empty distance journal gains128,414km. Preview changes2flights/2users to4,114km/422minutes. SQL hashes:

- Production: `0449acadef4d09e5ec56e4e98d18f38d6125ee401cfafcd35addfb87dd329c71`.
- Preview: `61302de69c7157413772ab90e658d047bf6defd176faf2757374cd3b918544f7`.

Fresh local rehearsal applied each guarded flight UPDATE with exactlyone matched row, repaired18production users, left dirty/metricsNull0, published25rows for5eligible users, preserved all135historical badges and added4awards. Preview repaired2users, with0eligible leaderboard users. Both proposals independently regenerate byte-for-byte; applied flight values match, replanning returns zero changes, all24canonical/non-metric tables and non-metric flight fields remain intact. Independent GPT‑6.1 Sol high review found no open correctness defect.

Private migration evidence: `/private/tmp/kuuki-r3-d1-cutover-rZBTsHTx`. Exact SQL/manifests/operator dry-run/rehearsal: `/var/folders/hy/6ftrhvk16w942tqtvgsxy6pc0000gn/T/kuuki-r3-backfill-bg4nm6`. Retain these private artifacts; no journal records or credentials belong in Git.

The owner approved the exact remote backfill, stats publication, temporary authenticated operators and isolated remote protocol proof. Fresh full-source snapshots matched every held table, including coordinates and median donors; both regenerated proposals matched the approved SQL hashes. The isolated remote D1 proof verified ordered per-statement results, CAS match 1/miss 0 and rollback on a failing CHECK, then the fixture was deleted. One-request batches applied exactly 2 preview and 411 production guarded flight updates, every UPDATE matching one row. Publication repaired 2 preview and 18 production journals, with dirty/metricsNull 0 on both; production has 25 leaderboard rows for 5 eligible users. Fresh snapshots confirm exact metric values, canonical and non-metric flight preservation, all 135 historical badges retained plus 4 new awards, correct journal totals and zero FK violations. Official new-file proposals return zero changes on both targets. Both temporary operators were deleted and their local tokens removed; all private proof/artifacts remain outside Git.

Release 3 deployed from clean main `bbb88414476ac9e571b8c729aaefe9cd44a199d7`, whose only differences from successful code CI `6cc8f8ff93664667637696a6b95d2395ebce1f78` are the four reviewed documentation records. The same accepted build was deployed with `--no-autoconfig --strict`, tag `bbb8841` and the exact commit subject. Interactive confirmation acknowledged replacing the temporary API writer hold with the admitted source config. Preview HTML/session passed before production; canonical HTML 200, session 200/`null` and activation `/activate` 200 passed after both production deploys. Each production Worker had a connected error tail for 300 seconds with zero error events. Writers are reopened; Task34 release is complete. No rollback was needed.

| Worker | Previous held rollback version | Release3 version |
| --- | --- | --- |
| `kuuki-next` | `0bc3863f-5e2d-4769-a65d-a421cdf6d79a` | `d91b1cb4-22bf-4147-b510-989594a433de` |
| `kuuki-activation` | `63dd4493-406c-49be-b8e1-c5859ef32f35` | `f8e53b74-f761-484c-a639-0ee137274826` |
| `kuuki-next-preview` | `894284b2-4aac-480f-85ce-ad5951644eaa` | `fa26ff19-964e-4588-9431-a2b832bc1f49` |

The existing preview activation code/bindings were preserved and its temporary hold released as version `9fccd8b7-e325-429d-b4dd-545daef9504a`; preview activation HTTP 200 passed. Historical Pages remains denied/held with Git deployments disabled. Existing preview maintenance stays held before DB access; no production maintenance Worker, cron, import provider, Pages frontend or framework experiment was deployed. Dirty MAIN, unrelated worktrees and port8800 remain preserved.

[PR47](https://github.com/indi256s/kuuki/pull/47) is merged as code SHA `6cc8f8ff93664667637696a6b95d2395ebce1f78`. [Main CI/CD37747939613](https://github.com/indi256s/kuuki/actions/runs/37747939613) and React Doctor37747939621 passed; the admitted main candidate differs only in four documentation records and reuses those checks. Dirty MAIN and unrelated worktrees are preserved.
