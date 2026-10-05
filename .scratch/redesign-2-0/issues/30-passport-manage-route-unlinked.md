# Consolidate /passport/manage now that Passport manages countries in its sheets

Status: needs-triage
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
