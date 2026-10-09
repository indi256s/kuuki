# 10 OpenFlights CSV export

Status: open
Type: task
Owner: Sonnet
Blocked by: —
Spec: Selection and bulk actions → Export

## What

Pure `client/journal/export-csv.ts` (+ test): `openFlightsCsv(flights, refs): string` and `downloadCsv(name, text)`. Verify the column spec against current OpenFlights documentation first and cite it in a comment. Kuuki-only fields: put status "awaiting confirmation" into Note; drop confirmation source. RFC 4180 quoting; dates and times as OpenFlights expects.

## Done

- Unit tests: header row, quoting, null fields, awaiting note.
- typecheck, test green.
