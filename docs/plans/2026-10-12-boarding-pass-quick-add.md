# Boarding-pass Quick Add

Status: Product direction accepted on 2026-10-12 and consolidated in the [final spec](../../.scratch/boarding-pass-quick-add/spec.md). The spec selects reuse of the existing UI controls; decoder/admission feasibility and the local-decoder pilot remain pending. The T3 concept uses simulated recognition; the feature is not implemented.

## Purpose

Make adding a boarding pass a small interruption on a phone. The user gives equal priority to paper-pass photos and screenshots/PDFs, and to capture before takeoff and logging after landing.

The accepted addition is to read the boarding pass's structured barcode on the phone before sending the document for recognition. Faster capture could produce a more complete journal, improving route history, statistics and passport evidence. That benefit remains a hypothesis to test.

## Accepted experience

1. Enter through **Add boarding pass**, with equally visible **Take photo** and **Choose screenshot/PDF** actions.
2. Try local barcode decoding for either source. The member does not choose or learn a separate scanner mode.
3. Show a compact review with route, flight number and date as soon as usable details are available. Ask only for unresolved details; retain access to correction and the existing full review.
4. If the barcode is unreadable, continue through the existing document-recognition path. Explain when the document will be uploaded. Both recognition paths lead to the same review and save rules.
5. Let the member finish immediately or keep the extracted rows in the existing review queue and return later.

Support all legs supplied by a pass, rather than treating every barcode as exactly one flight. The concept's single flight is example data.

## Before and after the flight

| Situation                                 | Result                                                                                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Same-day capture before takeoff           | Keep an import draft row for review. Do not convert it into a logged flight or count it as flown.        |
| Future-dated pass                         | A reviewed flight can use the existing `upcoming` lifecycle. It does not immediately count as completed. |
| After landing or adding a historical pass | After resolving required details, the member explicitly confirms they flew and saves to the journal.     |
| Interrupted review                        | Keep unresolved extracted details for later through the existing import queue.                           |

A draft is an extracted candidate, not a flight lifecycle state. Current flight creation logs today/past dates immediately, so Quick Add must not send same-day preflight captures to conversion merely because decoding succeeded. Existing upcoming/awaiting/automatic-confirmation rules remain governed by [ADR 0001](../adr/0001-flight-lifecycle-and-import-drafts.md).

The T3 controls for “before takeoff / after landing” and “readable / unreadable / saved” are demonstration controls. They are not an accepted production settings panel or extra mandatory step.

## Correctness and trust

- A readable barcode does not prove that the member flew.
- A barcode's flight day does not reliably establish the full year. Ask the member to confirm an unresolved year; do not silently select the current year. Derive a complete calendar date only after resolving that ambiguity.
- Keep uncertain or incomplete fields correctable. Do not treat a successful decode as independent verification of every flight detail.
- Preserve the existing required-field validation, duplicate acknowledgement and transactional duplicate recheck. Offer access to a matching saved flight. A date-and-route match is a duplicate candidate, not proof that two passes describe the same flight occurrence.
- On successful local recognition, extracting the fields need not upload the original document. Saving the reviewed flight and durable review-queue persistence still require connectivity.
- Persist extracted fields through the existing draft/save authorities. The current privacy contract does not store original pass bytes or provider responses. Keeping original passes as souvenirs remains undecided.
- Preserve EN/RU, keyboard access, visible focus, labelled touch targets and truthful recognition/save status. Follow [DESIGN.md](../../DESIGN.md), including Commissioner, Paper Mono and Kuuki's semantic tokens.

## Reuse and remaining implementation questions

Reuse the current Add entry, import file selection, review questions, review queue and save authority. The [Arc UI research](../research/2026-10-12-boarding-pass-arc-ui.md) recommends existing Sheet, Button, FileDropzone, ReviewRow/Ticket, QuestionDeck, RowForm and Disclosure. These are component recommendations; the accepted behavior above remains the product decision.

The implementation still needs a bounded feasibility check for admitting locally decoded fields into owned, validated import drafts. The existing recognition endpoint takes a document or text; this plan does not claim it already accepts local barcode results.

The decoder, PDF rasterization, phone-image formats/orientation, first-load cost and device support are not selected or verified. Avoid promising a universal built-in browser decoder, offline launch or durable offline capture. The local-reading pilot decides whether this path deserves priority.

## Cheapest pilot and rejection criteria

Try an existing local decoder on 30 representative passes: 15 ordinary paper-pass photos and 15 screenshots/PDFs, including both saved-file formats. Run the same corpus on target iPhone and Android devices.

Compare time to a **correct, reviewable flight card** against the upload-recognition path, including first load, PDF handling and necessary year confirmation. Record results separately for paper photos and saved files, and by device.

Reconsider this as the next priority if either source group decodes fewer than 80% successfully or median time to a correct review card is not reduced by at least half. Any silently wrong flight identity stops advancement until understood. These are pilot decision thresholds, not measured accuracy or speed claims.

## Deferred alternatives

Share to Kuuki could save an entry step but does not improve paper-pass capture and needs a separate platform-support decision. An offline inbox could protect interruptions but would add persistence work before proving the recognition benefit. Souvenir storage could deepen attachment but its value and privacy/storage requirements remain unresolved.

## Evidence and concept

- [IATA BCBP implementation guide](https://www.iata.org/contentassets/1dccc9ed041b4f3bbdcf8ee8682e75c4/2021_03_02-bcbp-implementation-guide-version-7-.pdf): structured boarding-pass fields, paper/mobile formats and multiple legs; flight-year ambiguity remains a review concern.
- [Flight lifecycle creation](../../functions/api/_services/lifecycle.ts): today/past creates are `logged`; future creates are `upcoming`.
- [Domain vocabulary](../../GLOSSARY.md) and [ADR 0001, import drafts](../adr/0001-flight-lifecycle-and-import-drafts.md#6-import-drafts-migration-0007_import_draftssql): draft retention, year confirmation, validation, duplicate safeguards and original-source storage restrictions.
- [Current import recognition evaluation](../research/2026-10-07-import-recognition.md): existing document recognition; its small sample does not establish general accuracy.
- [Existing Arc adoption inventory](../research/2026-10-08-arc-source-inventory.md): installed adaptations and retained local behavior.
- [Interactive concept source](../../.scratch/boarding-pass-quick-add/visuals/kuuki-quick-add.html): simulated photo/file reading, online fallback, missing-year review, preflight deferral and saved-flight matching. Example data and timings are not decoder evidence.
