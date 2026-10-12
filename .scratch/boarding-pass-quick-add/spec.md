# Boarding-pass Quick Add

Status: ready-for-agent

Product decisions accepted: 2026-10-12. Implementation is authorized by the owner. Technical questions OQ1–OQ3 were resolved in the implementation thread on 2026-10-12 (see Engineering resolution); they did not reopen the agreed experience. Hardware evidence OQ4 remains a feature-acceptance gate.

## Problem Statement

Adding a boarding pass to Kuuki on a phone interrupts the traveler at the moment they have the pass available. A paper pass requires taking a photo; a pass on the same phone usually means selecting a screenshot or PDF. Uploading and waiting for document recognition makes either source more effort than a small journal entry should require.

Travelers need capture to work equally well before takeoff and after landing. Before takeoff, they need to keep the details without claiming they have flown. After landing, they need to review the details and add the flight to their journal. An unresolved year, unreadable barcode, duplicate, interrupted review or uncertain save must not turn into a silently wrong flight.

## Solution

Provide **Add boarding pass**, with equally visible **Take photo** and **Choose screenshot/PDF** actions. For both sources, try reading the structured boarding-pass barcode on the phone first, without a separate scanner mode. Show the usable route, flight number and date in a compact review, with questions only for unresolved facts and access to the existing full editor.

If local reading cannot produce usable boarding-pass details, continue through Kuuki's existing online document-recognition flow and explain that the document will be uploaded. Both routes enter the same owned import-draft review, correction, duplicate handling and save authority.

Let the traveler finish now or keep the extracted rows in the existing review queue. Same-day preflight capture stays an import draft row. Today/past flights require the traveler to explicitly confirm they flew; reviewed future flights use the existing upcoming lifecycle. Successful decoding alone creates no flight or flight evidence.

## User Stories

1. **QA-01 — As a traveler on a phone, I want equally accessible photo and saved-file capture, so that either kind of boarding pass takes little effort.**
   - Add boarding pass exposes Take photo and Choose screenshot/PDF with equal prominence. The camera action requests photo acquisition; the file action supports the existing PDF, PNG and JPEG inputs.
   - Canceling acquisition creates no batch or flight. Unsupported or oversized inputs receive an actionable error before submission. Removing or replacing a file prevents its stale asynchronous read from submitting it.
   - The shared Add entry continues to work on desktop. Existing manual flight entry and general document/text import remain reachable.

2. **QA-02 — As a traveler, I want Kuuki to read the barcode first for either source, so that a readable pass can reach review without uploading its image.**
   - Both photo and screenshot/PDF input try local barcode reading before online document recognition. The member does not choose a recognition technology.
   - A successful local read displays the extracted route and flight number when available, and the resolved date or a clear unresolved-date cue. It never fabricates a date to render the card.
   - Successful local reading sends neither original document bytes nor the raw barcode payload to document recognition. Structured draft persistence may require a network request; local reading is not described as a saved entry.

3. **QA-03 — As a traveler with an unreadable or unsupported pass, I want an understandable fallback, so that capture can still lead to review.**
   - A missing/unreadable barcode, unsupported local decoder capability or bounded decode failure leads to the existing document-recognition path with visible upload information before transmission.
   - The source remains available in memory for fallback or retry while the capture is open. Cancellation, source replacement or leaving the flow prevents stale results from changing the current review.
   - Offline fallback or failed admission says what could not finish and offers the appropriate retry/correction path. It does not report an empty journal, a saved draft or a saved flight as a substitute for failure.

4. **QA-04 — As a traveler with a connecting itinerary, I want every leg encoded in my pass represented separately, so that my journal records the whole itinerary.**
   - A valid multi-leg barcode produces a distinct candidate row for each encoded leg, in source order, within existing batch limits. A second rendering of the same barcode is not itself another flight.
   - Malformed or partially parsed data is not represented as a completely decoded itinerary. Known usable candidates remain correctable, with truthful partial/error status and access to fallback.

5. **QA-05 — As a traveler reviewing extracted details, I want a compact card and access to corrections, so that I can confirm a simple pass quickly and repair an incomplete one.**
   - The compact review leads with route, flight number when present, and date/date question. Optional pass preview and extra details are disclosed on demand.
   - Existing full review/edit controls remain available. Missing airport/carrier/date fields and invalid catalog references remain correctable drafts and cannot enter flights until valid.
   - No boarding time becomes a departure time. No aircraft, travel status, confidence percentage or other detail is invented to complete the display.

6. **QA-06 — As a traveler whose pass lacks a reliable full year, I want to choose the year explicitly, so that Kuuki records the actual calendar date.**
   - Neither the current year nor a suggested year is silently accepted or preselected. A member can choose a suggestion or enter another valid year; the decision survives persisted review reloads.
   - An ordinal flight day is retained as unresolved date evidence until the year is chosen. The implementation derives the calendar date using the chosen year and rejects impossible combinations, including ordinal day 366 in a non-leap year.
   - A printed month/day without a year follows the existing explicit-year question. Source-explicit year and user-confirmed year remain distinct; changing the date invalidates any inconsistent prior decision.

7. **QA-07 — As a traveler capturing a pass before takeoff, I want to keep its details for later, so that I do not claim a flight I have not flown.**
   - For a today/past candidate entering Quick Add, saving as flown requires an explicit member confirmation. A barcode, date, recognition result or default row selection cannot supply that confirmation.
   - A same-day candidate the member has not yet flown remains a review draft and survives acknowledged online persistence. It does not invoke conversion, create a logged flight, enter completed statistics, or contribute passport evidence.
   - After landing or for a historical flight, explicit flew confirmation plus resolved required details permits normal journal saving. Refusing or deferring confirmation creates no flight.
   - The demo's before-takeoff/after-landing switch is not a mandatory production setup step. The question is part of relevant review.

8. **QA-08 — As a traveler with a future-dated pass, I want to add the reviewed future flight, so that it appears in my upcoming travel without counting as completed.**
   - A valid reviewed future date uses the existing upcoming create/conversion behavior in the captured timezone.
   - It initially stays outside completed totals and pressed flight-based passport evidence. Existing upcoming → awaiting → logged and automatic-confirmation rules remain unchanged.

9. **QA-09 — As an interrupted traveler, I want to finish reviewing later, so that capture is useful even when I cannot complete it at the gate.**
   - Once structured rows are acknowledged as persisted, Finish later leaves them in the existing owned import review queue; reopening or reloading restores saved corrections and unresolved questions.
   - Draft expiry remains the existing 30-day policy, with the existing deadline/expired-state behavior. Component-local deferral alone is not durable persistence.
   - Without acknowledged online persistence, the UI does not promise recovery after closing or reloading. Original bytes are not written to browser storage as a workaround.

10. **QA-10 — As a traveler re-adding a pass, I want to see a possible saved match, so that I can open it or deliberately keep a separate flight.**
    - Duplicate candidates use the existing full owned date/route history and provide access to the matching saved flight. A match is a candidate, not proof of the same flight occurrence.
    - Saving a duplicate candidate requires the existing acknowledgement. Concurrent saves still receive the transactional duplicate recheck; Quick Add cannot bypass it.

11. **QA-11 — As a traveler saving reviewed legs, I want truthful per-row results and safe retries, so that interruptions do not duplicate or lose flights.**
    - Reviewed changes must be acknowledged before conversion; an unsaved correction blocks saving with a visible reason.
    - Existing version checks, operation keys and conversion receipts govern saves. A lost response is shown as uncertain and retried under the same operation; successful rows are not resent as new flights.
    - Partial failures remain beside their rows, and retry targets the unresolved rows. Committed-but-pending derived publication follows the existing finishing-save behavior rather than repeating the mutation.

12. **QA-12 — As a member, I want capture and review to respect my account and the pass's private contents, so that convenience does not expose my travel documents.**
    - Admission, read, edit and conversion enforce the existing authentication, CSRF, owner isolation, rate limiting, bounds and retention contracts. Locally decoded client fields are untrusted input, not airline-verified records.
    - Only allowlisted normalized flight fields and justified review metadata enter drafts. Original file/base64/raw barcode/provider response, passenger name, booking reference and unrelated pass contents are not persisted or logged.
    - Recognition failure or unsupported input never grants access to another member's batch or flight.

13. **QA-13 — As a member using English or Russian, keyboard access or assistive technology, I want capture states and actions to remain understandable, so that I can complete the same flow.**
    - All new visible copy is EN/RU, with Russian «вы» and real plural forms. Capture/privacy/errors are calm and direct.
    - Sheet focus entry/return, Escape, keyboard activation, labelled controls, visible focus, announcements and 44px touch targets follow the existing controls. Light/dark, reduced motion, 320px width and 200% text size remain usable.
    - Reading, unresolved review, online persistence, partial failure, uncertain save and completion have distinct truthful status. No invented percentage appears when there is no known total; a draft is not styled or labelled as proof of a flown flight.

## Implementation Decisions

- **Responsibilities:** the existing Add entry routes into capture; the source-acquisition boundary validates and owns the transient file; local decoding projects structured flight candidates; the server admission boundary validates and persists owned drafts; the existing review/save authorities own corrections and flight conversion. There is one flight-save path.
- **Contracts:** preserve general document/text submission. The current jobs endpoint accepts PDF/image/text content, not locally decoded field objects. Add a bounded admission contract for normalized local results rather than pretending those fields are already supported or uploading a raw barcode as pasted text. Exact request/response shape and endpoint placement are OQ2.
- **Date evidence:** retain only the validated date evidence necessary to resolve the year. A barcode's ordinal flight day cannot be converted to month/day using an assumed year. Existing `date_month_day` represents a printed month/day and must not be repurposed to encode ordinal days. The minimal durable representation and its validation are OQ3.
- **Review authority:** successful local decoding does not imply the member flew and does not bypass required fields, explicit-year confirmation, duplicates or version guards. Quick Add today/past candidates need explicit flew confirmation in either recognition path. Preserve this requirement through reloads; OQ3 includes how it is carried into the existing review and conversion contracts.
- **Lifecycle:** use existing upcoming behavior for reviewed future flights. Keep same-day preflight data as import drafts. Do not add a new flight lifecycle state or change awaiting/automatic-confirmation policy.
- **UI reuse:** compose Kuuki's installed Sheet, Button, FileDropzone, ReviewRow/Ticket, QuestionDeck, RowForm and Disclosure. Use explicit source-action variants, caller-selected sheet placement, current semantic tokens, Commissioner and Paper Mono. Camera acquisition belongs to the caller; the current FileDropzone does not expose a capture prop. No additional overlay or duplicate save controller is required.
- **Evidence/copy:** a decoded barcode can supply structured fields; it does not establish real-world accuracy or completion. Do not manufacture model confidence for locally decoded fields or label them as AI-verified. Preserve flight-number/carrier normalization and unknown values as correctable fields.
- **Privacy/connectivity:** local success avoids original-document upload. Online draft admission and save still require connectivity. Keep original source bytes transient and retain current server/browser storage exclusions. Souvenir storage and durable offline capture are excluded.
- **Schema:** no schema migration is agreed. Prefer validated additions within the existing draft metadata/storage contract when sufficient; justify any additive schema change against the existing invariants before assigning downstream work.
- **Artifacts:** the linked T3 concept is simulated visual evidence, not a working decoder or save implementation. Its scenario/moment controls and synthetic timings are not production requirements. Module paths, task ownership and work waves belong in the implementation thread's execution map.

## Testing Decisions

- **Existing coverage to reuse:** API draft tests already exercise auth/CSRF/ownership, operation replay, validation, retention, privacy and limits. Conversion tests cover year decisions, duplicate acknowledgement/races, stale versions, receipts, rollback and partial saves. Source-selection tests cover removal/replacement during asynchronous reads. Existing review/confirmation/reload tests and the import browser journey cover unsaved corrections, uncertain outcomes, review recovery and row-specific retries. Preserve these contracts; do not duplicate their entire scenarios for another extraction source.
- **Missing owner-boundary proof:** add focused cases for local barcode decoding/projection (valid formats, malformed/truncated and multi-leg data), yearless ordinal-day resolution including leap boundaries, validated/idempotent owned local-result admission, and persisted today/past flew-confirmation gating. Extend existing table-driven boundaries where they can catch the new failure. Real decoder fixtures must exercise the actual decoder; mocks alone do not establish barcode/image support.
- **Distinct composed-flow proof:** exercise equal acquisition choices, local success without source upload, unreadable input leading to the disclosed online fallback, and same-day preflight persistence followed by resumed explicit confirmation. Use the existing import browser fixtures and acquisition stubs for orchestration; distinguish these from actual phone-camera evidence. Include source replacement/cancel while decoding only where the current source-read regression cannot catch the new decoder's asynchronous result.
- **Required gates:** implementation follows the live `CODING_STANDARDS.md` commands: affected format/lint/typechecks and focused tests; API changes require `pnpm typecheck:api` and `pnpm test:api`; Next UI changes require `pnpm next:build` followed by the full `pnpm test:next:navigation`; Worker dispatch changes also require worker typecheck and `pnpm next:smoke`. Refresh generated API inventory if exported routes/methods change. Serialize builds and shared runtime/browser fixtures.
- **UI acceptance:** focused checks cover EN/RU, light/dark, missing date, multiple legs, file errors, partial/offline/uncertain states, 320px width, 200% text size, keyboard/focus and reduced motion. Use the project's `agent-browser` policy when interface inspection is necessary.
- **Phone pilot:** evaluate 30 representative passes: 15 paper-pass photos and 15 screenshots/PDFs including both saved formats, on target iPhone and Android devices. Report success by source and device. Compare time to a correct reviewable card against online recognition, including first load, PDF handling and necessary year confirmation.
- **Pilot decision gate:** reconsider priority if either source group succeeds on fewer than 80% or median time to a correct reviewable card is not reduced by at least half. Any silently wrong flight identity stops advancement until understood. These thresholds are decisions to test, not accuracy/speed claims. OQ4 covers corpus/device access; absent evidence remains a tracked acceptance blocker.
- **Test economy:** add coverage only for a distinct failure the existing checks cannot establish. No new tests for documentation wording, static component inventories or copies of implementation branches. New test authors apply the project's test-authoring gate before adding cases.

## Out of Scope

- Share-to-Kuuki integration, email ingestion, wallet integration and a new standalone scanner mode.
- Durable offline inbox, offline launch guarantees or raw pass storage as a fallback.
- Original-pass souvenir storage and its undecided privacy/retention model.
- Gate/seat/boarding-time operational assistance, flight tracking, schedule inference and automatic proof of travel.
- General import redesign, new foundation components, a second save path or a broader design-system refresh.
- The T3 demo's scenario switches, injected sample data and simulated timings.
- Changing existing future-flight lifecycle, awaiting totals, passport derivation or automatic-confirmation policy.
- Production deployment, remote D1 writes, merging or external publication. The owner authorized specification and implementation in a new thread.

## Further Notes

**Material technical questions for the implementation orchestrator; these are not requests to repeat product discovery:**

- **OQ1 — Decoder and input feasibility.** Select and verify a browser-local decoder with appropriate boarding-pass symbology support. Resolve PDF rasterization, acquisition/orientation and phone image-format behavior, resource bounds, first-load cost and device fallback from installed source and current primary documentation. Existing supported file inputs are PDF/PNG/JPEG; HEIC support is not promised. Do not claim universal built-in browser support. Close the technical selection before dependent capture work; retain real-device acceptance separately under OQ4.
- **OQ2 — Owned admission.** Decide the smallest validated server request/response contract and persistence path for locally decoded flight fields. Preserve source-type semantics, idempotent submissions, owner/batch limits, correctable invalid references, privacy and conversion authority. Verify that local capture works without a provider credential when decoding succeeds. A new transport must not authorize local client fields as verified airline data.
- **OQ3 — Durable review evidence.** Choose the minimal allowlisted metadata and review/convert contract for ordinal-day/year ambiguity and explicit today/past flew confirmation. Preserve these through generic batch reopening, corrections and retries. Inspect downstream normalization, field merging and conversion guards before consumers implement the contract. Do not silently weaken general import behavior to make Quick Add work.
- **OQ4 — Pilot evidence.** Locate representative, authorized pass samples and target iPhone/Android access; neither is established by the simulated prototype. Choose capture/read timestamps and report a repeatable comparison. If unavailable, record the missing hardware/corpus proof in a dedicated local issue and do not claim the feature has passed its pilot or is release-ready. Continue independent authorized implementation and checks.

**Readiness:** observable product behavior is settled. Technical selection/admission/review contracts require initial investigation, so this publication is `needs-triage`, not `ready-for-agent`. The authorized implementation thread resolves and records OQ1–OQ3, creates the execution map and individual local tickets, and then advances readiness. OQ4 remains explicit in final acceptance rather than being erased by code completion.

**Source decisions and evidence:**

- [Accepted product plan](../../docs/plans/2026-10-12-boarding-pass-quick-add.md).
- [Arc UI reuse research](../../docs/research/2026-10-12-boarding-pass-arc-ui.md) and [Arc checklist accounting](arc-checklist.md).
- [Simulated T3 concept](visuals/kuuki-quick-add.html).
- [Project glossary](../../GLOSSARY.md), [design system](../../DESIGN.md), [coding standards](../../CODING_STANDARDS.md), [local tracker conventions](../../docs/agents/issue-tracker.md), and [ADR 0001 §6 / §11](../../docs/adr/0001-flight-lifecycle-and-import-drafts.md).
- [IATA BCBP implementation guide](https://www.iata.org/contentassets/1dccc9ed041b4f3bbdcf8ee8682e75c4/2021_03_02-bcbp-implementation-guide-version-7-.pdf), especially pp. 6–7 and 15–16 for formats, multiple legs and flight-date encoding. It establishes source-format context, not Kuuki decoder performance.

**Existing test seams for the execution map:** `functions/test/import-drafts.test.ts`, `functions/test/import-conversion.test.ts`, `apps/next/src/client/import/source-step.test.tsx`, `apps/next/src/client/import/confirm-runner.test.ts`, `apps/next/src/client/import/import-client.test.tsx`, `apps/next/src/client/import/import-client-reload.test.tsx`, and `apps/next/tests/import.test.ts`.

## Engineering resolution (implementation thread, 2026-10-12)

Recorded by the implementation orchestrator against baseline `776f3c12`. Product sections above are unchanged. Tickets live in [issues/](issues/).

**OQ2 — Owned admission (resolved).** Extend `POST /api/import/jobs` with a discriminated body `type: 'boarding_pass'` instead of a new route, so CSRF, authentication, the shared `import-parse:` rate limit, `submissionOperationId` replay, open-batch/processing limits, 30-day TTL and the route inventory stay unchanged. Body keys are strict: `source` (`'image' | 'pdf'`, the acquired file's kind, stored as the existing `source_type`; no migration), optional `sourceLabel` (existing sanitizer), `submissionOperationId`, `legs` (1–8) and optional boolean `incomplete`. Each leg is strict: `origin`/`destination` required `^[A-Z]{3}$`; optional `airline` `^[A-Z0-9]{2}$` (absent → existing `ZZ` placeholder with `airline_was_placeholder`); optional `flightNumber` `^[0-9]{1,4}[A-Z]?$`; optional integer `dayOfYear` 1–366. Catalog existence is not checked at admission: unknown codes stay correctable drafts and conversion still refuses them. The handler persists synchronously through the existing `createProcessingBatch` → `persistDraftRows` fence, never calls the provider or the import Durable Object, and therefore works without `GEMINI_API_KEY`/`IMPORT_JOBS`. It answers with the snapshot (201 created, 200 replay). `incomplete: true` finalizes as `partial` with `ROWS_REJECTED`. The client sends only these normalized fields: raw barcode text, passenger name, PNR, seat, sequence and file bytes never leave the browser on this path. Local fields are untrusted input with `confidence`/`field_confidence` null, `year_explicit` 0 and `selected` 0.

The existing PDF/image job body accepts optional `requireFlownConfirmation: true` for the Quick Add online fallback; it travels through the synchronous writer and `StartImportJob` to the Durable Object so both recognition paths persist the same marker.

**OQ3 — Durable review evidence (resolved).** Three allowlisted `fields_json` metadata keys, never part of `FlightInput`, not patchable through `fields`, and preserved by `mergeFields`:

- `date_ordinal_day` (integer 1–366): the barcode's flight day, kept while `date` is empty. `date_month_day` is not repurposed. The client derives `YYYY-MM-DD` only from a member-chosen year and rejects day 366 in a non-leap year; the answer is the existing `{fields:{date}, yearConfirmed:true}` patch, so source-explicit and member-confirmed years stay distinct.
- `flown_required: true`: written at admission for Quick Add rows (local and fallback).
- `flown_confirmed: true`: written only by the new draft patch key `flownConfirmed` (boolean; `false` removes it). Accepted only on `flown_required` rows (otherwise 400 `INVALID_DRAFT`). It bumps `version` but does not mark the row `edited`.

`confirmBatch` refuses a `flown_required` row without `flown_confirmed` whose date is on or before the request timezone's local today (the same boundary `lifecycleForCreate` uses) with per-item 400 `FLIGHT_NOT_CONFIRMED`. Future rows are unaffected and convert as `upcoming`. Row selection, decoding or recognition cannot satisfy the guard. General import rows have no marker, so their behavior is unchanged. A same-day "not yet" answer writes nothing: the row stays a review draft in the existing queue.

**OQ1 — Decoder and input feasibility (resolved).** `zxing-wasm` 3.1.5 reader build with a self-hosted wasm, `pdfjs-dist` 6.4.299 for the first two PDF pages, bounded rasterization (≤ 2000 px / 4 MP, one 3000 px retry), lazy loading after file choice, existing PDF/PNG/JPEG and 10 MiB limits, no HEIC promise and no `BarcodeDetector` path. Evidence and bounds: [issue 03](issues/03-local-barcode-reader.md). Real-device performance stays under OQ4.

**OQ4 — Pilot evidence (open).** Tracked in [issue 06](issues/06-phone-pilot-evidence.md). No representative corpus or target devices are available to this thread; feature acceptance stays blocked on it.
