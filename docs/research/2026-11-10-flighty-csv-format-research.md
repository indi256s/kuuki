# Flighty CSV: external format research

Inspected 2026-11-10. Research only; no importer implemented or compatibility certified. No passenger rows or booking references copied into this note or evidence files. Public CSV was processed in memory for header and shape aggregates only.

## Decision

Design a header-driven, loss-aware adapter. The strongest inspected evidence supports **ICAO airline codes, separate flight numbers, airport-local timestamps without offsets, and a 33-column export family**. The proposed 34th column, `Flighty Import Status`, remains unverified in the inspected source fixtures. Offset timestamps are accepted by one third-party parser, but that does not establish that Flighty exports them.

Two separately maintained open-source projects were inspected at pinned commits. They corroborate core header names but disagree on important semantics; neither is an authoritative Flighty specification. Their deployment compatibility with the current Flighty app was not tested.

## Provenance and evidence quality

| Source                                               | Inspected revision / date                                     | What it establishes                                                                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SSARCandy/flighty-web-viewer                         | `04216b6cfa54733315256e50f8189fb00d1fe969`; commit 2026-07-06 | Its parser, synthetic unit checks, README assumptions, and bundled CSV header/shapes. README calls the CSV a sample; real versus synthetic origin of bundled rows is not established. |
| thulasirajkomminar/flightlog                         | `850637bf79910173353124892a80ec2234661818`; commit 2026-10-27 | Its Go import adapter and duplicate lookup behavior; accepted formats are parser choices, not proof of emitted Flighty formats.                                                       |
| Flighty help and developer App Store version history | Live pages fetched 2026-11-10                                 | Official product capabilities and release statements, not CSV schema guarantees.                                                                                                      |
| My Flight Path importer documentation                | Live page fetched 2026-11-10                                  | Independent service's stated mapping and reimport policy; implementation not inspected.                                                                                               |
| RapidToolSet                                         | Live page and public repositories inspected 2026-11-10        | Product claims only; no Flighty parser source located.                                                                                                                                |

Pinned source links:

- [Viewer README](https://github.com/SSARCandy/flighty-web-viewer/blob/04216b6cfa54733315256e50f8189fb00d1fe969/README.md).
- [Viewer readable parser template, lines 370–434](https://github.com/SSARCandy/flighty-web-viewer/blob/04216b6cfa54733315256e50f8189fb00d1fe969/tools/index.template.html#L370).
- [Viewer synthetic checks](https://github.com/SSARCandy/flighty-web-viewer/blob/04216b6cfa54733315256e50f8189fb00d1fe969/tools/test.js).
- [Viewer bundled CSV](https://github.com/SSARCandy/flighty-web-viewer/blob/04216b6cfa54733315256e50f8189fb00d1fe969/demo.csv) (contains flight rows; only its header and aggregate shapes used here).
- [Flightlog adapter](https://github.com/thulasirajkomminar/flightlog/blob/850637bf79910173353124892a80ec2234661818/internal/importer/flighty.go).
- [Flightlog import service](https://github.com/thulasirajkomminar/flightlog/blob/850637bf79910173353124892a80ec2234661818/internal/importer/service.go).

## Official findings and release history

Flighty's [manual entry help](https://flighty.com/help/using-search) confirms manual flight entry exists. This alone does not define how missing flight numbers appear in CSV.

The developer's [App Store version history](https://apps.apple.com/us/app/flighty-live-flight-tracker/id1358823008) includes export in the 4.3.2 entry dated 2024-12-13, alongside manual entry, editing, notes, travel reason and Private Jet class. A later 4.5.0 entry dated 2025-04-04 reports the travel-reason display change from Leisure to Personal and a manual-flight arrival-day fix. **These are product changes, not evidence that CSV enum strings changed.** The fetched history's visible newest entry is 4.11.3, Oct 26 (year not displayed there); its recent notes do not disclose an export schema change. Do not infer schema stability or the latest installed app version from that page.

The [official help index](https://flighty.com/help) provides migration and manual-entry articles, but no export schema was located in the inspected resources. No first-party versioned CSV schema, timezone contract, ID-stability guarantee, duplicate contract, or exhaustive enum vocabulary was found. This is a search result boundary, not proof no such documentation exists.

## Headers and observed variants

The pinned viewer `demo.csv` has exactly these **33** columns, in this order:

```csv
Date,Airline,Flight,From,To,Dep Terminal,Dep Gate,Arr Terminal,Arr Gate,Canceled,Diverted To,Gate Departure (Scheduled),Gate Departure (Actual),Take off (Scheduled),Take off (Actual),Landing (Scheduled),Landing (Actual),Gate Arrival (Scheduled),Gate Arrival (Actual),Aircraft Type Name,Tail Number,PNR,Seat,Seat Type,Cabin Class,Flight Reason,Notes,Flight Flighty ID,Airline Flighty ID,Departure Airport Flighty ID,Arrival Airport Flighty ID,Diverted To Airport Flighty ID,Aircraft Type Flighty ID
```

The viewer README lists those same fields; its parser consumes only a subset. Both inspected parsers require the header names `Date`, `Airline`, `Flight`, `From`, `To`, resolve by name, and trim header whitespace. Neither supplies aliases for renamed headers. Neither requires all 33 columns. Neither inspected mapping uses `Flighty Import Status`.

The task's reported 34-column header is therefore a plausible additional-column variant, **not independently verified here**. Accepting unknown columns safely is preferable to rejecting by exact column count. No verified `Cancelled`, `Takeoff`, or other spelling variant was found; do not silently invent aliases.

## Field behavior: observation versus contract

| Topic          | Inspected evidence                                                                                                                                                                                      | Import design implication (proposal)                                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Date           | Viewer requires shape `YYYY-MM-DD`; Flightlog additionally accepts US slash dates and timestamp forms.                                                                                                  | Validate calendar dates strictly. Do not infer ambiguous slash-date locale from Flightlog's fallback.                                                                                   |
| Airline        | Viewer names its property `airlineIcao`; README describes a three-letter ICAO code. Flightlog concatenates airline + flight number, labels the result IATA, and stores airline in an IATA slot.         | ICAO is the better-supported baseline; resolve by namespace, not blind concatenation. Airline names/IATA variants remain unverified.                                                    |
| Flight         | Viewer allows blank values; Flightlog drops them. README describes a number without prefix.                                                                                                             | Preserve string/leading zeros; blank number must not silently delete an otherwise valid manual row. Prefixed and suffixed values need explicit validation rather than numeric coercion. |
| Times          | All 66 bundled scheduled-departure values match `YYYY-MM-DDTHH:MM`, none ends in `Z` or a numeric offset. Viewer explicitly documents airport-local values. Flightlog accepts RFC3339 plus naive forms. | Support naive local timestamps deliberately. Offset acceptance is robustness, not evidence of export emission. Preserve source form and explicit offsets when present.                  |
| Canceled       | Bundled values are lowercase `false`; viewer synthetic test uses `True`. Viewer accepts case-insensitive true; Flightlog also accepts `1`. Both default other values to non-canceled.                   | Parse explicit true/false case-insensitively; blank is unknown, malformed values need a warning. Numeric booleans are unverified export behavior.                                       |
| Diversion      | Viewer retains `To`, records `Diverted To`, and uses diverted airport as effective destination. Flightlog does not map diversion.                                                                       | Keep booked and actual destination separately; never overwrite booked destination or count a canceled row as flown.                                                                     |
| Missing values | Viewer converts trimmed blanks to null; Flightlog uses empty strings and ignores invalid optional times.                                                                                                | Blank optional cells mean absent; literal `null`, `NULL`, `N/A` are not verified sentinels. Report invalid supplied values rather than silently dropping them.                          |
| Notes / CSV    | Viewer parser handles comma quoting, doubled quotes and embedded newlines; synthetic tests explicitly cover these.                                                                                      | Use a real CSV parser; splitting on lines corrupts notes. Retain notes whitespace rather than copying the viewer's blanket trimming.                                                    |
| BOM            | Viewer trims JS header strings and separately strips a leading BOM in default-file loading. Flightlog has no explicit BOM strip.                                                                        | Strip one UTF-8 BOM before CSV parsing, including before a quoted first header. Test it explicitly; actual Flighty BOM emission is unverified.                                          |
| IDs            | Viewer README describes six internal UUID columns, but its normalized object ignores them. Flightlog also ignores them.                                                                                 | Treat as opaque source references; stability, uniqueness scope, and presence for manual rows remain unverified. Never use a source ID as authorization.                                 |

Sources for the table: pinned viewer README, template and tests, and Flightlog adapter above. The viewer's timestamp regex is not end-anchored and ignores a trailing offset when computing times; its duration helper uses airport offsets. Do not borrow that arithmetic for historical DST-aware conversion. Flightlog parses naive timestamps through `time.Parse` and places resulting values in a UTC field in `createFromImport`; that implementation is not proof that Flighty naive timestamps are UTC.

[My Flight Path's mapping](https://myflightpath.club/docs/import/flighty) independently describes ICAO airlines, unprefixed flight numbers, IATA airports, and separate booked/diverted destinations. Its documented enums include WINDOW/AISLE/MIDDLE, FIRST/BUSINESS/ECONOMY, and LEISURE/BUSINESS. These are that importer's stated supported values, **not an exhaustive current Flighty vocabulary**. It reports preview warnings for unreadable optional data and skipping repeat imports; its matching algorithm is not disclosed.

## Duplicate and reimport evidence

Viewer loading replaces the current in-memory dataset and optionally its local-storage CSV. `normalizeFlights` appends each accepted row; there is no source-ID merge or duplicate-row elimination there.

Flightlog's `findCached` first matches number/date/departure/arrival, then falls back to **date + route only** to bridge ICAO/IATA differences. Already-linked flights increment skipped counts. This is its policy, not Flighty's. The fallback can conflate two same-day flights on the same route; do not adopt it as deterministic identity. It does not establish what should happen when an existing row changes notes, seat, cancellation or diversion.

## RapidToolSet lead: bounded negative result

The [Flighty Export Viewer page](https://rapidtoolset.com/en/tool/flighty-export-viewer) claims cancellation exclusion, diverted routing and full-field parsing. The [public organization](https://github.com/rapidtoolset) and recursive GitHub trees for desktop-app (`c55fefdf83aa7586f555299f5551bb6bb6fc6adb`, 2026-11-03) and browser-extension (`b17538f7476a207a0959827d0ca7dd5efe1a0cbd`, 2026-10-25) yielded no Flighty-named source. Those wrappers do not provide the requested parser evidence. Do not cite the marketing page as source verification or claim its site implementation is open source.

## Deterministic importer plan inputs and remaining gates

These are recommendations for the parent plan, not settled Kuuki product rules:

1. Parse UTF-8 CSV with BOM handling, quoting, multiline cells and bounded size/row limits. Reject duplicate headers and inconsistent row width with record diagnostics; tolerate column reordering and extra columns. Keep source row numbers distinct from physical line numbers.
2. Separate parsing, semantic validation, lookup and persistence. Preview every accepted, rejected, duplicate and ambiguous row; do not silently discard cancellations or missing-number rows.
3. Preserve local calendar date/time separately from instants. Resolve naive departure/arrival against each endpoint's historical IANA timezone only when unambiguous; DST gaps/folds require a diagnostic. Cross-midnight and date-line arrivals retain their supplied calendar dates. Keep scheduled/actual gate and runway events distinct.
4. Scope source references and idempotency to the authenticated owner. Use source IDs as candidates only after uniqueness validation. Detect exact repeated records separately from possible existing-flight matches; same date/route is insufficient. Decide update versus skip explicitly; never overwrite user edits implicitly.
5. Keep unknown enum values and unknown import-status text available for review. Do not derive booking status, flown status or identity from an undocumented status column. Keep PNR/notes out of diagnostics and logs.
6. Create synthetic fixtures for the 33-column family and proposed extra-column variant, reordered headers, quoted notes with newlines/quotes, BOM before quoted Date, blank number/manual row, cancellation, diversion, unknown enum, offset/naive times, invalid calendar date, DST ambiguity and duplicate/reimport conflicts. These establish chosen parser behavior, not latest Flighty compatibility.
7. Before claiming real export compatibility, verify a consented current export's header and non-sensitive shape summary, app version/export date, airline namespace, blank-number/manual rows, boolean/null spelling, local-versus-offset timestamps, and status/ID semantics. No need to block planning while awaiting it. A user export is also needed to distinguish 33/34 columns across versions or export options.

## Reuse constraints and checks

Flightlog has an [Apache-2.0 license](https://github.com/thulasirajkomminar/flightlog/blob/850637bf79910173353124892a80ec2234661818/LICENSE); code reuse requires checking its applicable license/notice obligations. No LICENSE file was found in the viewer's inspected tree, and its package metadata does not grant a license. Public visibility alone is insufficient permission to copy its implementation or fixtures. Reimplement from format facts with independently authored synthetic data. No upstream code or rows were copied into Kuuki.

Verification performed: fetched pinned source files, inspected parser/service logic and synthetic checks, compared header names, counted bundled timestamp shapes in memory, checked repository trees and license metadata, and reviewed first-party help/release notes. No upstream test suite, app export, or Kuuki application tests were run; this is prose-only research. Open links above identify the inspected evidence; mutable pages are dated observations.
