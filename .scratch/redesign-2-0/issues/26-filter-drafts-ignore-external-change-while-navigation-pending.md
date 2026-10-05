# Journal filter drafts ignore a link to /journal from outside the Journal while a filter navigation is pending

Status: needs-triage
Owner task: T13
Source: fix rounds 3–4 (R2-N1); `apps/next/src/client/reads/journal-filters.tsx` (`sent`, `external`), `apps/next/src/client/reads/journal.tsx` (`navigateExternally`, `startNavigation`)

## What differs
The filter drafts settle on the page's navigation transition: while a navigation started by `apply` is pending, URL changes count as its own responses. Explicit navigations by the member are announced as they start and are adopted at once, even while such a navigation is pending:
- both Reset links, through next/link `onNavigate`;
- Back and Forward, through a `popstate` listener.

Links to `/journal` that live outside the Journal component get no such announcement. These are the shell Journal tab (`apps/next/src/client/nav.tsx`), the queue summary (`apps/next/src/client/queue-summary.tsx`) and the Awaiting action link (`apps/next/src/client/add-actions.tsx`). If the member follows one within the server round trip of a filter commit, it supersedes that navigation. Its URL arrives while `sent` is still set, so the drafts keep the superseded value after the transition settles. If the destination equals the rendered query (for example the Journal tab on an unfiltered Journal), the page's `requested` base also keeps the superseded target. The next Search can then send the superseded filter again.

The window is one server round trip, and only a chrome link to the page the member is already on triggers it. Back, Forward and Reset (the cases the T13 acceptance names) are covered.

## Decision needed
Whether to close this window, and how:
- (a) Accept it.
- (b) Export `onRouterTransitionStart(url, navigationType)` from a new `apps/next/src/instrumentation-client.ts` (a public, non-experimental hook in Next 16.3.8, `next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md`). It runs synchronously inside every App Router push, replace and traverse (`next/dist/client/components/router-transition.js`). Re-dispatching it as a window event lets the Journal treat any `/journal` navigation that `apply` did not start as external. That would subsume the local `onNavigate` and `popstate` discriminators. It is a global module, and it also needs a check that the OpenNext build loads it.

## Acceptance check
With (b): a Journal test commits AA, holds it pending, fires the router-transition event for `/journal`, settles, and expects an empty Airline draft and a following Search of `q=x` only.
