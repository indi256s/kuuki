# Own-flight metric fields in the browser transport

Status: resolved in Task 12

Task 3 review confirmed that `packages/shared/src/types.ts` has the planned
camelCase fields, while the browser's `Flight` and `ApiFlight` types in
`packages/client/src/flights.ts` do not yet declare `duration_source` and
`zones_overflown`. Runtime DTOs already carry them. Add these read-only fields
when the first consumer needs them, before the design thread's UI handoff.
No UI changes belong to this data work.

Task 12 declares both optional read-only fields in Flight and ApiFlight.
The existing writable allowlist and runtime DTO mapping remain unchanged.
Client and Next typechecks pass; no UI consumer was added.
