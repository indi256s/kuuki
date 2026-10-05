# /passport/manage is no longer linked from Passport; its bulk-aircraft form lost its entry point

Status: needs-triage
Owner task: T16 follow-up / product
Source: T16 self-review (2026-10-05), branch wip/redesign-T16.

## What is wrong
Before T16, `apps/next/src/client/reads/passport.tsx` linked to `/passport/manage` from its "Add" button, its empty state and the old country popup ("Edit"). T16 replaced all three with in-page flows: the add-country sheet, and the country sheet's add-visit, claim, delete-visit and remove-country actions. Nothing in `apps/next/src` links to `/passport/manage` now. The route still renders (`apps/next/src/app/(member)/passport/manage/page.tsx`), and `apps/next/tests/capture.test.ts:72,94` still opens it by URL.

The page has two parts:
- **Places.** It duplicates the country sheet.
- **"Aircraft in journal".** It assigns a type to up to 20 flights through `/api/flights/aircraft-batch`. Import's aircraft review covers only flights being imported. Assigning aircraft to flights already in the journal is now reachable only by typing the URL.

## Open question (why triage)
Choose one:
- Move bulk aircraft assignment to Journal batch actions (T13/T14 area), then redirect `/passport/manage?countryCode=CC` to `/passport?country=CC` and remove the page.
- Keep the page for aircraft only and link it from Journal or Settings.

## Acceptance check
A member can reach bulk aircraft assignment from the UI without typing a URL. `/passport/manage?countryCode=CC` either redirects to `/passport?country=CC` or no longer duplicates country management.
