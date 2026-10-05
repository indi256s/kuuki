# Journal filter drafts keep sent values when a superseded navigation never arrives

Status: needs-triage
Owner task: T13
Source: fix round 2 (I1); `apps/next/src/client/reads/journal-filters.tsx` (`sent`)

## What differs
Each field remembers the values it sent until the URL shows one of them. If the router drops an intermediate navigation and the final URL equals the pre-commit value (for example TK then cleared), the URL never changes, the list is never settled, and the stale entries remain. A later external change to exactly one of those values (a link or Back to `airline=TK`) is then treated as this component's own navigation and does not replace the draft.

## Decision needed
Settle the list on a signal that the navigation finished (for example `useTransition`/pending state from the router, or clearing when the component sees the URL equal to the last sent value with no navigation in flight).

## Acceptance check
A Journal test: commit TK, clear, deliver only the final empty URL, then an external `airline=TK` URL; the Airline input shows TK.
