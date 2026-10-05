# Journal filter drafts ignore an external URL change that lands while their own navigation is pending

Status: needs-triage
Owner task: T13
Source: fix round 3 (R2-N1); `apps/next/src/client/reads/journal-filters.tsx` (`sent`, `navigating`), `apps/next/src/client/reads/journal.tsx` (`startNavigation`)

## What differs
Round 2 inferred who changed the URL from field values and could swallow Back and Reset. Round 3 replaced that with an explicit signal: the page runs its own navigations in a router transition and tells the filters when it is pending. While it is pending, URL changes keep the drafts; once it settles, every URL change is external and replaces the drafts of the fields it touched.

The remaining gap is narrow: a Back or Reset that lands while one of the component's own navigations is still pending is treated as that navigation's response, so the drafts keep their text until the next external change.

## Decision needed
Whether this is acceptable. Telling those two cases apart needs the router to expose which navigation produced a URL (for example the history state key), which Next does not offer today.

## Acceptance check
If the router ever exposes the origin of a navigation: a Journal test that commits TK, delivers Back to the empty query before the response, and expects an empty Airline draft.
