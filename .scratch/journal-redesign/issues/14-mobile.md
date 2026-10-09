# 14 Mobile cards, swipe and filter sheet

Status: done
Type: task
Owner: Sonnet
Blocked by: 07, 08, 09, 13
Spec: Mobile (≤700px)

## What

Cards (date, route, airline, aircraft, km, badge, firsts glyph). Filters open in a bottom sheet. Swipe left Delete (deferred, Undo), swipe right "I flew" on pending cards; context menu path always present; long-press or menu starts selection. Review pill beside the title.

## Done

- Test: card menu offers the same actions as swipe. typecheck, lint, test green.

## Implementation (2026-10-09)

Mobile cards reuse the ledger content and Arc SwipeActionsRow. Left swipe and the accessible menu use the page's shared 6s deferred delete/Undo; right swipe and the same menu confirm awaiting flights through confirmFlights with queue tokens and inline outcome feedback. Menus also start or clear selection; writes are blocked offline with a visible explanation. The filter button opens one bottom Sheet containing primary and secondary facets; Reset clears all its filters. The review pill remains beside the title, with the import link below on narrow screens. Historical transit reconciliation remains available beneath the header.

Checks: Next typecheck and affected ESLint pass; 65 focused tests pass across page integration, ledger, toolbar, keyboard and header. Mobile page integration confirms the server-token request, lifecycle refresh and shared Undo (including focus). Card coverage exercises both swipe directions and equivalent menu actions. No browser/layout inspection or build in this agent; the orchestrator owns serial build/navigation checks.
