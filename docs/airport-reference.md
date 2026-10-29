# Airport reference coverage

The offline catalog is [airports.json](../packages/data/src/airports.json).
Capture, import extraction and timezone lookup read it; server validation and
reference queries read D1's `airports_reference`. Update both projections when
admitting airports.

[import-openflights.ts](../scripts/import-openflights.ts) reads downloaded
[OpenFlights snapshots](https://openflights.org/data.php). New rows need a three-letter
IATA code, finite coordinates in range, a timezone, and a country admitted by
`COUNTRY_TO_CODE` and `TARGET_COUNTRIES`. Airport popularity is not an admission
rule. Existing catalog rows retain their manual fields even outside these
regions. The airline priority filter is separate and unchanged.

This snapshot is not a complete or current worldwide airport directory.
Missing countries, missing timezones and airports absent from the snapshot
remain coverage gaps. Historical airports are retained for past journeys;
a reference entry does not assert that an airport currently operates.
See the [OpenFlights data documentation](https://openflights.org/data.php).

The eight pinned [reference supplements](../db/reference-supplements.json)
override raw metadata for newly imported airport rows. Existing manual catalog
rows still take precedence. The supplement seed generator permits matching
base rows and rejects divergent metadata.

Before regenerating, download `airports.dat` and `airlines.dat` from the
[OpenFlights data page](https://openflights.org/data.php) to
`scripts/airports-raw.dat` and `scripts/airlines-raw.dat`. These downloaded inputs
are ignored by Git; regression tests keep their representative source rows inline.
The expansion migration records the airport input SHA-256 used for this change.

Regenerate locally from the workspace root:

```sh
pnpm exec tsx scripts/import-openflights.ts
pnpm exec tsx db/scripts/generate-seed.ts --airports-only
pnpm exec tsx db/scripts/generate-seed.ts --supplement-only
```

The first command also regenerates airlines; review that diff separately.
`--airports-only` writes the full airport seed, whose DELETE preamble is for
empty databases. Do not apply it to a populated database.

[0017_airport_catalog_coverage.sql](../db/migrations/0017_airport_catalog_coverage.sql)
admits the additional airport references, including prior JSON additions absent
from the original seed. Matching existing rows are no-ops; divergent metadata
raises a primary-key conflict. It leaves existing reference rows and travel
records intact and does not recompute derived statistics. Test atomic admission,
replay and conflicts with
[airport-catalog-migration.test.ts](../functions/test/airport-catalog-migration.test.ts).

Production needs both the D1 addition and the updated application catalog.
Remote D1 application requires separate authorization and the writer-hold,
backup/restore and admission gates in the
[release runbook](runbooks/audit-remediation-release.md); application deployment
follows the [deploy procedure](skills/deploy-kuuki/SKILL.md).
