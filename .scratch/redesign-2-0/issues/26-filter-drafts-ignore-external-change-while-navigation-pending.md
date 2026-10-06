# Journal filter drafts ignore an external navigation that supersedes a pending filter navigation

Status: resolved
Owner task: T13
Source: fix rounds 3–5 and authorized continuation (R2-N1, R4-N1, R5-I1, R5-I2); `apps/next/src/client/reads/journal-filters.tsx` (`sent`, `known`, `external`), `apps/next/src/client/reads/journal.tsx` (`navigateExternally`), `apps/next/src/client/navigation-link.tsx`

## What differed
The filter drafts settle on the page's navigation transition: while a navigation started by `apply` is pending, URL changes count as its own responses. Suppose the member navigated elsewhere while one was pending (Reset, Back/Forward, or a shell link to `/journal`). That navigation superseded the pending one, but its URL was taken as the pending one's response. The drafts kept the superseded value after the transition settled, and the next Search sent it again. If the destination equalled the rendered query, the page's `requested` base kept the superseded target too.

## Answer
Explicit navigations are announced as they start. The page's `navigateExternally` then does three things:
- it sets `requested` to the destination;
- it replaces the text drafts with the destination's values and drops `sent`;
- it makes the destination the filters' `known` URL, so later field and select changes are compared with it until the rendered URL catches up (R4-N1). When an owned navigation settles, `known` reconciles with the accepted rendered query even if it equals the previously rendered query; text drafts remain intact (R5-I1).

The announcements come from these sources:
- **Journal-owned links.** Both Reset links (toolbar and empty result) and the empty-page first-page link use next/link `onNavigate` with `navigateExternally`.
- **Back/Forward.** A `popstate` listener on `/journal`.
- **Shell links.** Shell links render `NavigationLink`, whose `onNavigate` dispatches `kuuki:route-link` (`ROUTE_LINK_EVENT`) on `window` with the href; the mounted Journal acts only when its pathname is `/journal`. (Until the PR #42 review this was a separate `kuuki:journal-link` event from `journal-links.ts`.) These are the desktop and mobile Journal tabs (`nav.tsx`), both queue-summary links (`queue-summary.tsx`), and the Awaiting action link in the add menu and sheet (`add-actions.tsx`).

next/link calls `onNavigate` only for a plain, local click that no `onClick` cancelled. A modified click (new tab) therefore leaves the page alone.

Coverage:
- **Journal regressions.** `apps/next/src/client/reads/journal.test.tsx` holds the filter navigation pending for Reset (both links), Back to the rendered URL, Forward to another filter, a commit after a pending Reset followed by untouched mobile Apply, same-query Status restoration, first-page then Search, the Journal tab, the queue link and an announced `airline=LH`. The continuation regressions use void router methods and suspended router state, settling only the newest destination while superseded responses remain unresolved. They assert desktop/mobile values, unchanged Apply behavior, and the next Search URL as applicable.
- **Link guard.** `apps/next/src/client/journal-route-links.test.tsx` fails if any of those shell links stops announcing.

## Limits (not open gaps)
- **New links.** A new next/link to `/journal` that renders while the Journal is mounted must use `NavigationLink`. The guard covers the components listed above, not links added elsewhere later.
- **Plain anchors.** Plain `<a href="/journal…">` anchors (flight form outside the Journal, import done step, Overview edit links) cause a full document load, so no filter state survives them.
- **Programmatic pushes.** `router.push('/journal')` in `capture/flight-panels.tsx` and `capture/flight-form.tsx` runs only on pages without the Journal; inside the Journal those components receive callbacks instead.
- **Separate caveat.** The handled-navigation-failure retry caveat from the round-3 review (`requested` keeps a failed target when the query does not change) was separate from this issue; resolved 2026-10-06 (see Resolution below).

## Continuation disposition — 2026-10-05

Authorized continuation ec7e614 closes both round-five navigation/filter defects, with independent acceptance. The distinct identical-Search retry after a handled navigation failure remains a carried Minor caveat; it is not claimed fixed by this issue.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.

## Resolution — 2026-10-06
The carried Minor (R5-M1: identical Search retry suppressed after a handled navigation failure) is resolved. `journal.tsx` now records that `requested` holds a target started by `apply` (`ownRequest`). When the navigation transition settles and that flag is still set, `requested` is reset to the rendered query, so an identical retry navigates again. Explicit navigations (`navigateExternally`: Reset, Back/Forward, shell links) clear the flag and keep owning `requested`; successful navigations are unchanged because the rendered query already equals the target.
- Regression: `journal.test.tsx` "navigates again when the same Search is pressed after a handled navigation failure left the rendered query unchanged" (void router resolving to the unchanged empty query). It failed before the change (one `airline=TK` navigation) and passes now; desktop and mobile drafts stay TK.
- The earlier test "builds on the last requested URL while the previous navigation has not arrived yet" used a router whose push returned at once, which is indistinguishable from a handled failure. It now uses the pending slow router, as in Next.
- Checks: Next units (94 files, 984 tests), lint, typecheck, `pnpm next:build`, Playwright `read-journeys` and `navigation` (29 passed, port 8807).
