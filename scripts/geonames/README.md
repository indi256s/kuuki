# GeoNames city catalog

Generates the global city catalog behind the ground-travel place picker
(`ground_places`, `ground_place_names`; schema in `db/migrations/0011_ground_travel.sql`).
Contract: `.scratch/ground-travel/places-contract.md`.

## Attribution

Contains data from [GeoNames](https://www.geonames.org), licensed under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The product must show this
attribution wherever catalog places are offered (about/credits screen at minimum).

## Regenerate

```sh
pnpm exec tsx scripts/generate-geonames-places.ts                 # download (cached), generate
pnpm exec tsx scripts/generate-geonames-places.ts --load-local    # ...and apply to the LOCAL D1
```

- Sources (`cities500.zip`, `alternateNamesV2.zip` ~195 MB, `admin1CodesASCII.txt`) are cached in
  `.wrangler/geonames/cache/` (gitignored). The ZIPs are streamed through `unzip -p`; the alias file is
  never held in memory.
- SQL goes to `.wrangler/geonames/out/`: `000-reset.sql` (empties both tables), then
  `NNN-catalog.sql` chunks of ~10 MiB (multi-row INSERTs of at most 100 rows and 64 KB, places first,
  then name keys). Output is deterministic: a second run produced identical chunk SHA-256 values.
- `manifest.json` records source URL, bytes, SHA-256, HTTP Last-Modified, the filter rules, row counts,
  chunk hashes and run timings. GeoNames republishes daily and URLs are not versioned, so the pin is the
  cached snapshot: if a cached file no longer matches the manifest the run fails. To take a new snapshot
  delete the cache and rerun with `--update-pins`, then review the manifest diff.
- `catalog_version` is `geonames-cities500-YYYYMMDD` from the cities500 Last-Modified date
  (`--catalog-date` overrides). Places store it so selected snapshots stay traceable.
- `--load-local` applies pending migrations and the chunks with `wrangler d1 execute <db> --local`
  (database name read from the root `wrangler.toml`). It never passes `--remote`. `--persist-to <dir>`
  keeps that local D1 in a separate state directory instead of `.wrangler/state`.
- `--ids 1,2,3 --no-manifest --out-dir <dir>` builds a subset. `db/seed/ground_places_fixture.sql`
  (11 real cities used by `functions/test/ground-places.test.ts`) was made this way; its header comment
  lists the exact command.

## Rules

See `rules` in `manifest.json`. In short: `cities500` rows of feature class P; RU/EN display names only
from `alternateNamesV2` rows tagged `ru`/`en` (current, preferred first), never from the ASCII name;
search keys come from the name, ASCII name and all RU/EN aliases (historic and colloquial included, e.g.
"Kazbegi" finds Stepantsminda). Keys use `placeNameKey` (`functions/api/_services/groundPlaces.ts`):
`foldSearchText` plus punctuation/hyphens to single spaces. Aliases without a language tag and other
languages are not searchable (a Georgian-script query will not match).

## Measured (2026-10-13 snapshot, Node 24, macOS)

|                                                      |                                                                          |
| ---------------------------------------------------- | ------------------------------------------------------------------------ |
| `ground_places` rows                                 | 236,112 (all cities500 rows kept, none skipped)                          |
| `ground_place_names` rows                            | 327,696 (largest bucket `san`: 7,583 keys)                               |
| places with a RU/EN alias                            | 93,736 of 19,220,706 alias rows scanned                                  |
| SQL                                                  | 47.6 MB in 5 chunks (5,639 statements)                                   |
| generate (download cached)                           | ~80 s                                                                    |
| local D1 load                                        | 92 s; local state ~50 MB                                                 |
| search `rows_read` (Miniflare D1 meta, real catalog) | typical 1–250 per keystroke; 3 chars: ≤ 50; 4 chars worst ("sant") 4,667 |

## Remote load is a separate release gate

Nothing here touches remote D1. Loading production needs the runbook gates in
`docs/runbooks/audit-remediation-release.md` (explicit target, writer hold, backup/restore proof,
schema admission, separate authorization). Until it is loaded, search returns only the owner's manual
places.
