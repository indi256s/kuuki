# Consolidate /passport/manage now that Passport manages countries in its sheets

Status: resolved
Owner task: product / a later Remember or Journal task
Source: T16 self-review and Sol review ruling (2026-10-05), branch wip/redesign-T16.

## Context
T16 moved country management into Passport: the add-country sheet, plus the country sheet's add-visit, claim, delete-visit and remove-country actions.

The reachability regression is fixed in T16 fix round 1. The Passport cover has a secondary link, "Manage places and aircraft" («Места и самолёты»), to `/passport/manage`; `apps/next/src/client/passport/collection.test.tsx` covers it.

## Open question (why triage)
`/passport/manage` (`apps/next/src/client/capture/passport-manage.tsx`) still has two parts:
- **Places.** These duplicate the country sheet.
- **"Aircraft in journal".** This assigns a type to up to 20 journal flights through `/api/flights/aircraft-batch`.

Should the places half be retired, with `/passport/manage?countryCode=CC` redirecting to `/passport?country=CC`? And where should bulk aircraft assignment for journal flights live in the long run: Journal batch actions, or T17's Overview aircraft panel?

## Acceptance check
Countries are managed in one place. Bulk aircraft assignment for journal flights stays reachable from the UI. Any retired route redirects to its replacement and keeps the country.

## Continuation disposition — 2026-10-05

The reachability regression is closed by T16: Manage places and aircraft remains linked and tested. Places consolidation and long-term bulk-aircraft placement remain a product/architecture dependency; the live helper is preserved.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.

## Resolution — 2026-10-06

Countries are now managed only in Passport.
- `/passport/manage` lost its Countries section (claim/unclaim, ground visits, confirm dialog, country loading) and the unused `.capture-confirm` styles. It is now the "Aircraft in journal" page («Самолёты в журнале»): same `/api/flights/aircraft-batch` assignment, same 20-item limit and result handling.
- `/passport/manage?countryCode=CC` with a catalogue code issues a server `redirect()` to `/passport?country=CC`. An invalid or absent code renders the aircraft page.
- The Passport cover link is relabelled "Aircraft in journal" and still points to `/passport/manage`. `docs/SITEMAP.md` and `docs/APP_FLOW.md` are updated.
- Country journeys (claim, visit with year/method/note, delete visit, remove country) are covered by `apps/next/tests/passport.test.ts` through the Passport sheets; a note assertion was added there. `capture.test.ts` now covers the redirect and the aircraft page.
- Long-term placement of bulk aircraft assignment (Journal batch actions vs Overview panel) remains a product question; the page is the reachable home for now.
- Tests: Next units 983 passed; lint and typecheck clean; `pnpm next:build`; capture.test.ts and passport.test.ts 6 passed (port 8806).
