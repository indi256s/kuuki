# Complete airline color source coverage

Status: open
Type: research

The [source ledger](../../../docs/research/2026-10-09-airline-color-sources.csv) records 79 `legacy_unverified` and 57 `unresolved` rows after the 9 October color pass and six-carrier follow-up. Wikimedia returned HTTP 429 during sequential logo downloads; do not restart a parallel retry loop.

For each remaining row, match the catalog name as well as its codes, find an official logo or a clearly attributable logo/livery source, and record the selected color with provenance. Prefer identifiable tail colors when there is evidence, especially Cebu Pacific and Pegasus. Resolve reused/stale codes before associating a carrier's artwork. Mesa needs lettering/brand evidence rather than a sampled black background; Japan Transocean Air needs newer artwork than its 1993 logo.

Acceptance: every row has attributable evidence or an explicit unresolved reason; `null` remains the fallback for unknown colors. Change only `primaryColor` in this task. Identity/status repairs require a separate catalog change. Check the ledger against the JSON catalog and run affected Next checks after updates.
