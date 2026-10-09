# 08 Ledger, title, live summary, review pill, Next up

Status: done
Type: task
Owner: Sonnet
Blocked by: 03, 05, 06
Spec: Page structure 1–3, 6; Columns; Firsts (glyph); Sorting

## What

`client/journal/ledger.tsx` + `ledger.css` (adapted Arc `sortable-data-table` presentation; sorting comes from the store, the table never sorts itself), `header.tsx` (h1, summary with slot-text, review pill), `next-up.tsx`. Columns: Date with status badge, Route (mono codes + cities), Airline (mono code + flight number), Aircraft (maker dot or "Add aircraft"), Duration, Distance. Connector band rows. Firsts glyph with tooltip. Rows are real DOM with `content-visibility: auto` + `contain-intrinsic-size`. Sticky header. No hairlines between rows. Weights 400/500, sentence case, no em dashes, EN and RU.

## Done

- Component test: renders rows, connector band, sort header changes store sort, firsts tooltip text.
- typecheck, lint, test green.
