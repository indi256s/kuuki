# Arc W3 enrichment baseline gap

Status: unresolved domain-contract prerequisite; no production change authorized here beyond the bound Arc baseline.

Execution base: 4b4fe54e1df31c486fb2de8b47970e82bc824ded. The Arc plan anticipated source-date/operator/registration and operated-versus-scheduled aircraft proposals present only in uncommitted work in the root checkout. This worktree has `EnrichResult` in `client/import/aircraft-review.ts` with flight ID, aircraft name, ICAO, confidence, evidence and uncertainty. Import review retains its existing validated choices, confidence defaults, selection, cancellation and partial-write outcomes.

Missing contract: structured source context and a canonical operated/scheduled classification with selection defaults. It cannot be reconstructed reliably from free text. No dirty-root enrichment files were copied and no speculative classifier was added.

Admission for subsequent work: accept the enrichment DTO/authority from its owning implementation; then preserve its source fields, visibly distinguish scheduled proposals, keep scheduled proposals unchecked, and verify this with the relevant existing import/API scenarios plus a focused selection regression. Arc presentation alone does not implement that missing domain authority.

Tracked also in docs/plans/2026-10-08-arc-integration-handoff.md. This file satisfies CODING_STANDARDS.md's carried-gap requirement.
