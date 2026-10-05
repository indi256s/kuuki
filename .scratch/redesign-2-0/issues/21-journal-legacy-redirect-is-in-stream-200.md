# /journal legacy-parameter redirect is an in-stream 200, not a 307

Status: wontfix
Owner task: T13
Source: T13 minor M1 (UI re-review round 1); `apps/next/src/app/(member)/journal/page.tsx`, `journal/loading.tsx`; CODING_STANDARDS section 3

## What differs
`/journal?airlineIata=AA&status=bogus` is normalized and redirected before the Journal flight/count/publication batch (the member gate has already read the own profile from D1), but `journal/loading.tsx` makes Next flush the shell first, so the redirect arrives inside the stream with HTTP 200. CODING_STANDARDS section 3 asks for a redirect status for gate decisions. The legacy-parameter redirect is not a security gate (the user is already authenticated and no Journal data was read), so the tension is about URL hygiene, not exposure.

## Decision needed
Either (a) accept the in-stream redirect and amend the standard's wording for canonicalization redirects, or (b) normalize the query in middleware/proxy so a real 307 is sent before the route renders, leaving `loading.tsx` in place.

## Acceptance check
An HTTP-level Playwright check (`request.get('/journal?airlineIata=AA', { maxRedirects: 0 })`) asserts status 307 with the canonical `Location`, or the standard is amended and the page comment keeps pointing to this issue.

## Continuation disposition — 2026-10-05

The existing standard requires a redirect status for unauthenticated security gates, not authenticated query canonicalization. This normalization runs after the member gate and before Journal private reads. Its streamed canonical redirect remains intentional; a middleware rewrite is unnecessary for the stated safety contract.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.
