# Daily Overview aggregate payload cost

Status: measured performance risk; exact-day semantics accepted, no smaller-payload claim.

The existing local-D1 `bulkFlights(db, 5001)` fixture generates one canonical flight per day from 2020. Reading the actual day-resolution service payload and regrouping those same rows by month yields:

| Resolution | Rows | Serialized row bytes |
|---|---:|---:|
| Month | 165 | 155,447 |
| Day | 5,001 | 4,701,514 |

Both retain 5,001 weighted flights and 500,100 km. These are uncompressed JSON rows, not a network measurement or a representative personal account. The source board fixture has 71 rows under both resolutions (88,380 bytes), because its other aggregate dimensions differ.

Day grouping is necessary for exact ranges, actual daily activity and previous-period comparisons. Grouping remains owner-scoped and cannot exceed the canonical source row count, but the existing compact-mode threshold does not guarantee fewer than 5,000 groups. Monthly rows cannot supply the missing daily evidence. Do not truncate groups or fabricate daily counts to reduce size.

Reconsider transport compaction only with measured real-account volume and an explicit contract preserving per-day facets, precomputed distributions, records, baselines and suppression. No speculative transport redesign was added during Arc integration.

Evidence: `/tmp/kuuki-arc-aggregate-volume-measurement.json`; final service and engine tests retain the weighted invariants.
