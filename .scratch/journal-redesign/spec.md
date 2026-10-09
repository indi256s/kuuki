# Journal redesign

Status: implemented and locally verified, 2026-10-09. No Paper boards (by choice).

Reference: Paper file "Kuuki — Auth redesign", boards 12.1–12.8 (Arc components) as the baseline, with parts from 11.x (11.5 review sheet). The 11.1 interface audit in this folder still applies where it doesn't conflict with this spec.

Arc: use the locally adapted free items in `apps/next/src/client/ui/` (inventory: `docs/research/2026-10-08-arc-source-inventory.md`, notice: `ARC-LICENSE.txt`). Adapt any missing free item the same way. No Pro source.

## Jobs

The Journal is for **browsing** (scrolling the logbook) and **finding one flight**. Confirming pending flights and fixing data are secondary and must not take the hero spot.

## Rule precedence

On the Journal, the Arc skill rules win over the Paper boards and older DESIGN.md styling:

- Weights 400 and 500 only. Title and route codes get their hierarchy from size and mono, not from weight.
- No eyebrow: remove `<p className="eyebrow">Every journey</p>` from `journal/page.tsx`.
- Sentence case, no all caps, no em dashes in copy (EN and RU).
- A foreground action confirms in place. A toast is never the only confirmation.
- DESIGN.md still governs tokens, contrast, Shu accent, the no-divider-lines rule (10-07) and Sheet mechanics.

Record each deviation from DESIGN.md in DESIGN.md when building.

## Data and state

- **Full list in memory.** Fetch the owner's whole journal once, sized for up to 1,000 flights. Remove numbered paging (`JOURNAL_PAGE_SIZE` paging, Previous/Next).
- **Rendering.** All rows render as real DOM, with `content-visibility: auto` (plus `contain-intrinsic-size`) on row blocks. No JS virtualizer unless profiling above ~1k rows shows jank. This keeps ⌘F, screen readers and sticky table headers working.
- **Filters are client-side and instant.** An in-memory store drives the list. The URL mirrors it via `replaceState`, so links and reload restore it, and Back does not step through filter tweaks. The store is not shared with the Overview.
- **Connections** are computed over the whole list. This removes the per-page `ponytail` limitation in `journal.tsx`.
- **Offline**: the loaded list stays browsable, searchable and filterable. Edits, deletes and bulk actions are disabled with the existing "Offline. Connect to change flights." No IndexedDB persistence.

## Page structure (desktop)

1. **Title + live summary.** `Journal` h1. One line that follows the filters, e.g. "74 flights · 141,204 km · 9d 4h in the air", with distance and time labelled confirmed-only. Numbers roll with text-morph/slot-text. No page-level Add (the nav has it). Remove the current lead copy.
2. **Review pill** on the right of the title row, e.g. "3 to confirm". It opens the detail sheet in review mode and is hidden at zero.
3. **Next up.** A compact block with the next 1–3 upcoming flights and a countdown ("in 12 days"). Hidden entirely when nothing is upcoming.
4. **Toolbar** (Arc filter-toolbar / chip-group): search, then chips for **Period** (date-range-picker with year presets), **Place** (airport or country, either end, combobox), **Airline**, **Aircraft** (multi-select; aircraft accepts families). Then Clear all and a ⋯ menu (More filters drawer, Export all matching).
5. **More filters drawer**: Status (Flown, To confirm, Upcoming, with counts; see decision D1), Missing details, alliance, and any remaining facets from 11.x.
6. **Ledger** (adapted Arc sortable-data-table, no enclosing hairlines between rows).

### Default contents

Flown and awaiting flights only. Upcoming flights appear in Next up and under the Upcoming status. A "Did not fly" flight is deleted (D1), so it appears nowhere once its Undo window ends.

### Columns

Date (with the status badge underneath, e.g. "To confirm"), Route (codes in mono plus city names), Airline (logo or mono code with no tile, plus the flight number), Aircraft (category-colour dot, or "Add aircraft"), Duration, Distance. There is no Status column.

### Sorting and grouping

- No year chapters. One continuous ledger, with the year in each date.
- Sort by date (default, newest first), duration or distance, from the column headers. Non-date sorts are a flat global ranking.
- Connections render as separate leg rows joined by a connector band ("IST · 2h 45m transfer"), in date order only. They unlink under non-date sorts.

### Firsts

- Each row can carry a small Shu glyph for firsts: first visit to a country, first aircraft type, first airline.
- The tooltip names them. The detail sheet always spells them out, since tooltips aren't available on touch and aren't essential information.
- Firsts are computed over the whole journal, ignoring filters.
- Awaiting flights earn firsts, labelled "(pending confirmation)".
- Marking a flight "Did not fly" moves the first to the next qualifying flight: the delete commits after its Undo window and the refetched firsts no longer count it (D1, D2).

### Search

One field (`/` focuses it). It understands:

- places (city, airport code or name, country; EN and RU, with verified aliases)
- flight, airline and aircraft ("TK 381", "TK381", "A350", family aliases)
- dates ("2019", "march 2024", "май 2023"), which filter to that period
- route pairs ("TBS IST", "TBS-IST", "Tbilisi Istanbul"), in either direction by default

## Detail sheet

- Clicking a row opens a read-first sheet: route, times with UTC offsets, aircraft, airline, distance and duration, connection, firsts, and provenance (imported or added, and the confirmation source).
- **Layout.** At ≥1280px the sheet docks as a 460px split pane, and the ledger narrows (dropping Duration and Distance). The selected row stays highlighted, and j/k or a click on another row swaps the content. Below 1280px it is an Arc drawer overlay. On mobile it is the full-height bottom sheet (`.flight-full-sheet`).
- **Inline edits** (Arc inline-edit), one field at a time:
  - Enter or blur saves that field, and the field confirms in place (the value settles, then a check).
  - A toast offers Undo as a secondary signal.
  - When a change recomputes other fields (an airport change alters distance, duration and country), show a one-line consequence preview before saving.
  - There is no global Save button. The 12.2 dialog is retired as the edit path.
- **Review mode.** The pill and Status → To confirm open the same sheet with a "Did you take this flight? I flew / Did not fly" block on top, "Review 2 of 3" in the header and "Next to review" in the footer. The `JournalQueue` cards are removed.
- The deep link `?flight=<id>` opens the sheet.

## Selection and bulk actions

- No checkbox gutter by default. On desktop, a row's checkbox appears on hover or focus, and `x` toggles it. On mobile, selection starts from the menu (long-press or the swipe-actions menu path).
- The Arc floating action bar shows "N selected", with "Select all M matching".
- **Delete**: no confirm dialog at any count. Delete is deferred with a 6s Undo (the existing `useDeferredDelete`), and focus moves to Undo.
- **Set aircraft**: by default it fills only flights without an aircraft, e.g. "Set for 7 without aircraft (3 already set)". "Replace all 10" needs an explicit tick. This protects enriched data.
- **I flew / Did not fly**: resolves pending flights in the selection. Upcoming flights are skipped and counted in the label.
- **Export**: OpenFlights CSV, built client-side from the in-memory list. It covers the selection, or "all matching" from the ⋯ menu.
  - Verify the column spec against current OpenFlights docs before building.
  - Kuuki-only fields (status, confirmation source) go into Note or are dropped. Decide when building.

## Mobile (≤700px)

- Cards as in 12.6: date, route, airline, aircraft, km, badge, and the firsts glyph visible.
- Filters open in a bottom sheet (12.3).
- Arc swipe-actions: swipe left to Delete (with Undo), swipe right to "I flew" on pending cards. A menu path (context menu) always exists as well.
- The review pill sits beside the title, as in 12.6.

## Motion

- When the result set changes, it crossfades over ~150ms (opacity only).
- Summary counts morph.
- No row layout or FLIP animation.
- Under reduced motion, everything is instant.

## Keyboard (desktop)

| Key | Action |
| --- | --- |
| `/` | Search |
| ↑ ↓ or j k | Move row focus |
| Enter | Open the sheet |
| Esc | Close the sheet, or clear |
| `x` | Select |
| `e` | Edit the focused field in the sheet |

The shortcuts are listed in a `?` popover. There are no single-key destructive shortcuts.

## States

- **Empty journal**: one action, Add or Import.
- **No matches**: Clear filters.
- **Loading**: an Arc skeleton in the final ledger layout.
- **Background refresh failed**: keep the rows and show an alert.
- **Publication pending**: keep today's freshness behaviour.
- **Fix 12.4 copy before reuse**: no "Cloudflare D1" and no "all edits work offline" claim. The delete-confirm dialog and the 8s undo text are retired.

## Out of scope

- Shared filter scope with the Overview.
- Offline persistence.
- Re-import of exports.
- Narrator lines.
- Metric cards.

## Open risks

- Payload and memory for the whole journal at 1,000 rows on low-end phones: measure the gzipped size and the time to interactive on the 1k fixture.
- Firsts need a stable, filter-independent computation shared with Passport evidence. Decide server versus client before building.
- Dropping URL-authority filtering changes `getOwnJournal` / `normalizeJournalQuery` and the canonical-redirect logic, plus their tests.
- Inline per-field edits need per-field write endpoints, or a PATCH that recomputes derived fields. Check `functions/api` for what exists.

## Build decisions (2026-10-09)

These settle the open risks above. Where a decision narrows the spec, the spec text above is updated to match.

**D1. "Did not fly" stays a delete (user decision, 2026-10-09).** ADR 0001 §2 keeps "Did not fly" as a client-deferred `DELETE` with the 6s Undo, and its "Alternatives considered" rejects a stored `did_not_fly` state (C2). The Status facet therefore has Flown, To confirm and Upcoming only. Single, review-mode, swipe and bulk "Did not fly" all go through the shared Journal deferred-delete provider, and the label says it removes the flight. No migration. Unknown DELETE outcomes reconcile a fresh list before restoring any cached rows; if reconciliation fails, rows stay hidden with a read-only Refresh list action.

**D2. Firsts are computed on the server.** `readJournalAll` reads every owner flight with its airport countries (the `evidenceFlightsStatement` join) and runs a pure `journalFirsts` (`functions/api/_services/firsts.ts`). Country firsts reuse `countryContributions` from `countryEvidence.ts`, so transit suppression (D12) and the airport reference match Passport exactly. Order is `date, departure_utc, id` ascending; upcoming flights never earn a first; awaiting flights earn firsts marked `pending`. A flight earns a country first only when no earlier flight contributes that country and no ground visit or legacy evidence for it is dated on or before the flight (ground visits date to 1 January of their year), and no claim exists for it at all (`claimed_at` is when the claim was entered, not the visit, so claims count as undated); undated evidence blocks, so a first never contradicts the Passport. Airline firsts key on `airline_iata`, aircraft-type firsts on `aircraft_icao`. Why server: one authority with Passport, no 30 KB airport catalogue in the client bundle, and every write already refetches the list, so firsts never go stale while online. Offline the list is read-only, so they cannot go stale there either.

**D3. Payload and rendering.** The page sends one `JournalPayload` (`functions/api/_services/journalPayload.ts`): every flight in all lifecycle states, `firsts` by id, `refs` for the airports, airlines and aircraft in the journal, and revision metadata. `GET /api/flights/journal` serves the same payload for refetches. The initial full-mount measurement exceeded 1.5 s, so the ledger server-renders the first 60 ledger items and progressively mounts the rest in interruptible chunks, all as real DOM.

Remeasured on 9 October with the production-mode local Worker, a synthetic 1,000-flight owner (985 logged, 8 awaiting, 7 upcoming), 1280×800 Headless Chrome 151, and three fresh browser sessions at 4× CPU throttle. At the first observed hydrated sort/search controls, each run had 60 flight rows. Hydration plus the first Distance-sort feedback was **2.284 / 1.240 / 1.052 s**, median **1.240 s**; the two-frame paint opportunity was 2.332 / 1.282 / 1.090 s, median 1.282 s. The first run exceeded the target and had 953 ms TTFB versus 147 / 112 ms in subsequent runs. This is a local interaction proxy, not phone-hardware or Lighthouse TTI. All **993 default matching rows** were verified in the DOM by 3.932 / 2.455 / 2.236 s. Each run completed sorting, search (993→62) and clearing without probe or runtime errors; six unused-CSS-preload warnings remained per run.

The measured payload was **751,504 bytes raw / 41,366 gzip / 23,125 brotli**; the initial document was **1,043,402 raw / 58,780 gzip / 34,623 brotli**, with gzip level 9 and Brotli quality 11 applied to identity responses. Browser transfer compression differs (64,873 encoded document bytes). Full-list search feedback median was 412 ms and clear feedback 318 ms. The median initial interaction proxy meets 1.5 s; first-run and complete-DOM timings remain explicit limits. Raw, credential-free artifacts: [`runs-cpu4-progressive-chrome151.json`](../performance-audit/journal-1k/runs-cpu4-progressive-chrome151.json) and [`sizes-progressive.json`](../performance-audit/journal-1k/sizes-progressive.json). Earlier Chrome 149 runs are historical context, not a controlled browser-version comparison.

**Integrated remeasurement (10 October).** The final Journal + Overview + dependency integration (React 19.3, MapLibre 6.13, local airline marks, Radix Dropdown 2.1.16) was measured with the same custom synthetic fixture and method above: 1,000 flights, 985 logged / 8 awaiting / 7 upcoming, three fresh-cache Chrome 151 browser sessions at 4× CPU throttle, 1280×800, port 8816. The Worker stayed alive across runs; this is cold-browser measurement, not three cold-Worker boots. Two unrelated orphan Node processes were present at approximately 119% and 129% CPU in the pre-run host snapshot and were left untouched. Host contention prevents attributing timing differences solely to the integrated source.

Initial interaction proxy was **2.431 / 1.554 / 1.622 s**, median **1.622 s**; the two-frame paint opportunity was 2.504 / 1.602 / 1.667 s, median 1.667 s. All three proxy runs exceed 1.5 s, so the earlier median pass is historical and the integrated target is **not demonstrated**. Actual FCP was **1.140 / 0.464 / 0.508 s**, median 0.508 s; LCP was **1.472 / 0.756 / 0.840 s**, median 0.840 s. First-run TTFB was 606 ms versus 195 / 266 ms. Sixty flight rows were observed at hydration in each run; all 993 default matching rows were verified by **4.935 / 3.667 / 4.408 s**, median 4.408 s. Every probe completed without runtime errors, with seven unused-CSS-preload warnings per run. Search and clear feedback medians were 626 and 549 ms. The existing progressive-render fallback remains in place; a quieter-host retest is needed to establish the integrated 1.5-second target. No physical-phone or Lighthouse TTI claim follows from this probe.

Integrated payload: **751,504 raw / 41,444 gzip / 23,276 brotli bytes**; initial document: **1,056,660 raw / 58,887 gzip / 34,492 brotli bytes**, using the same compression settings. Current artifacts: [`runs-cpu4-integrated-chrome151.json`](../performance-audit/journal-1k/runs-cpu4-integrated-chrome151.json), [`sizes-integrated-chrome151.json`](../performance-audit/journal-1k/sizes-integrated-chrome151.json). The superseded, pre-Radix-fix attempt stayed outside the repository and is not acceptance evidence.

**D4. URL is a mirror, not an authority.** The server page stops reading filters, stops redirecting to a canonical query and stops paging. It passes the raw query string to the client, whose pure codec (`client/journal/url.ts`) parses it, including legacy aliases through `normalizeJournalQuery`, so the first render already matches the URL with no flash. Filter changes call `history.replaceState`. Opening the sheet from closed pushes one entry, switching flights inside it replaces it, and Back closes it. Defaults never appear in the URL, so `/journal` stays bare. Legacy `page` and `batch` are dropped. `queue=awaiting` (badge links) and `#arrival-<id>` (Passport) open review mode. `origin`/`destination` become either-end airport filters. Sort keys other than date, duration and distance fall back to date. `normalizeJournalQuery` and `journalHref` stay for `/flights` and Passport links. Tests that change: `url-state.test.ts` (page), `journal-interactions.test.tsx` (props), and `read-journeys.test.ts` (no 20-row page or `/api/flights/ids`; first load still makes no list request because the server sends the payload). The server list API and its tests stay for other clients.

**D5. Per-field writes use the existing `PATCH /api/flights/:id`.** It already merges a partial body, revalidates, recomputes distance, duration, timezones, zones and lifecycle, and guards the update with a compare-and-set. No new endpoint. The consequence preview is computed in the browser from the airport catalogue the airport editor already loads (`calculateFlightDistance`, `findAirport` country) and says that duration will be recalculated; the PATCH response is the truth. Inline saves request a signed, owner-bound Undo token that expires after five minutes. Undo sends that token to the same PATCH; the server checks the complete post-edit snapshot before restoring the previous field, metrics, lifecycle, confirmation provenance and transit decision atomically. A later edit rejects Undo instead of overwriting it. Bulk "Set aircraft" uses `aircraft-batch` in chunks of 20 with `replaceAll: false` by default; the server writes only missing values (or an identical replay), protecting aircraft assigned in another tab. The explicit Replace all tick sends `replaceAll: true`. Import acceptance sends true to preserve its existing replacement behavior. Bulk "I flew" uses `POST /api/flights/confirm` with candidate tokens from the awaiting queue, after filtering the selection to awaiting flights on the client.

**D6. Next up and the review pill ignore filters.** Next up shows the nearest 1–3 upcoming flights; the pill counts every awaiting flight. Open import batches that need review, formerly in `JournalQueue`, get one quiet link beside the pill ("1 import to review").

**D7. Arc sources.** All required items are free in the Arc registry (`sortable-data-table`, `filter-toolbar`, `chip-group`, `multi-select`, `tooltip`, `slot-text`, `text-morph`, `swipe-actions`, `checkbox`, `alert`, `empty-state`, `skeleton`, `drawer`). They are adapted into `apps/next/src/client/ui/` following the inventory rules: no `motion`, no `foundation.css`, Kuuki tokens, MIT header. The split pane is a plain `<aside>` in the page grid; the overlay and mobile sheet reuse `Sheet`.

**D8. Summary numbers morph** through an adapted Arc `slot-text`, which deviates from DESIGN.md's narrow Torph scope. Record it in DESIGN.md.
