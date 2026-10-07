# Own-flight metric fields in the browser transport

Status: open

Task 3 review confirmed that `packages/shared/src/types.ts` has the planned
camelCase fields, while the browser's `Flight` and `ApiFlight` types in
`packages/client/src/flights.ts` do not yet declare `duration_source` and
`zones_overflown`. Runtime DTOs already carry them. Add these read-only fields
when the first consumer needs them, before the design thread's UI handoff.
No UI changes belong to this data work.
