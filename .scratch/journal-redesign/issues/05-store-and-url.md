# 05 In-memory store, URL mirror and server page

Status: done
Type: task
Owner: Opus
Blocked by: 01, 03
Spec: Data and state; D4

## What

- `client/journal/url.ts`: `parseJournalUrl(search: string): JournalViewState` (legacy aliases via `normalizeJournalQuery`, `queue=awaiting` and `#arrival-<id>` → review, drop `page`/`batch`) and `journalSearch(state): string` (defaults omitted, stable order). Round-trip tests.
- `client/journal/store.tsx`: a React store (context + `useSyncExternalStore` or reducer) holding payload (TanStack Query key `['journal', ownerId]`, initial data from the server, refetch on `LIFECYCLE_CHANGED_EVENT`, focus and after writes), filters, sort, open flight, review mode, selection. URL mirroring by `history.replaceState`; opening the sheet from closed pushes one entry, swaps replace, Back (popstate) closes; `ROUTE_LINK_EVENT` and popstate reset state from the URL. Selectors for the filter engine (`selectJournal`) memoised.
- `app/(member)/journal/page.tsx`: no canonical redirect, no `normalizeJournalQuery`, no paging. Reads the payload with `getOwnJournalAll`, passes the raw query string, keeps `ReadFreshness`/`IdentitySnapshot`. Remove the eyebrow, lead and page-level Add.
- `lib/url-state.ts`: drop `page` handling from `normalizeJournalQuery`; keep `journalHref` and `/flights` behaviour. Update `url-state.test.ts`.

## Done

- Unit tests for the codec and store (replaceState not pushState on filter change; sheet push and Back).
- `pnpm --filter @kuuki/next typecheck`, `pnpm --filter @kuuki/next test` green.
