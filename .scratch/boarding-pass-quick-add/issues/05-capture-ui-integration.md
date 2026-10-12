# 05 — Quick Add capture and integration

Status: resolved
Type: task
Blocked by: 02, 03, 04
Requirements: QA-01, QA-02, QA-03, QA-05, QA-07, QA-09, QA-13

## Outcome

- **Entry.** `AddActions` gains a first action `pass`: "Add boarding pass" / «Добавить посадочный» → `/import?source=pass` (desktop menu and mobile sheet share the list). The existing upload action stays for general document import, relabelled "Upload a booking or PDF" / «Загрузить бронь или PDF» so the two are distinguishable; paste and manual stay. `normalizeImportQuery` accepts `source=pass`.
- **Source.** In `ImportClient`, `sourceMode === 'pass'` renders a new `QuickAddSource` instead of `SourceStep`; the rest of the batch → review → save flow is the existing one. `QuickAddSource` shows two equally weighted secondary Buttons: **Take photo** (hidden `<input type="file" accept="image/jpeg,image/png" capture="environment">`) and **Choose screenshot or PDF** (hidden input with the existing PDF/PNG/JPEG accept). The selected file is shown with the existing `FileDropzone` (thumbnail, removal, drop/paste on desktop). Links to manual entry and to general import remain.
- **Local read.** On a valid file (existing `checkFile` type/size errors shown before any read), start `readBoardingPass(file, { signal })` with a per-source revision and `AbortController`; removal, replacement, unmount or leaving aborts and stale results are ignored. Status text "Reading the barcode…" (role=status, no percentage). Prefetch the wasm when the component mounts.
- **Admission.** Legs → `onSubmit({ type: 'boarding_pass', source, sourceLabel, legs, incomplete }, operationId)` through the existing `ImportClient.start`/`use-import-batch` path (extend the `ImportSource` union; `submitSource` already spreads it). The response is a snapshot, so review opens directly. The body never contains file content or decoded text.
- **Fallback.** `kind: 'none'` shows a reason-specific explanation and, before any upload, the disclosure that the document will be uploaded for online recognition and is not stored. **Upload for recognition** sends the existing `{ type: 'pdf'|'image', content, sourceLabel }` plus `requireFlownConfirmation: true`; **Choose another file** resets. An `incomplete` admitted batch shows the existing partial notice and offers the same upload action while the file is still in memory.
- Failures (offline, limits, rate limit) reuse `import-errors.ts` classification and the existing failure panel; nothing claims a saved draft or flight on failure.

## Owned paths

`apps/next/src/client/add-actions.tsx`, `apps/next/src/lib/url-state.ts` (+ its test if one covers import query), `apps/next/src/client/import/import-client.tsx`, `apps/next/src/client/import/import-api.ts`, `apps/next/src/client/import/use-import-batch.ts` (only if the union needs it), new `apps/next/src/client/import/quick-add-source.tsx` (+ CSS in `apps/next/src/app/(member)/import/import.css`), `apps/next/src/client/import/copy.ts` (Quick Add keys only, after 04 accepted), `apps/next/tests/import.test.ts`.

## Acceptance

Browser journeys in `apps/next/tests/import.test.ts`, reusing `FakeImport` (teach it to answer a `boarding_pass` job with a 201 snapshot and to honour `flownConfirmed`). Barcode images are generated at test time with the `zxing-wasm` writer, so the real reader runs in Chromium:

1. Local success: both actions visible with equal weight; a generated PDF417 PNG chosen via the screenshot input → the jobs body is `boarding_pass` with the expected legs and no `content`; review shows the route and year question; choosing a year and "I flew" leads to a confirm.
2. Unreadable: a blank PNG → the upload disclosure is visible and no jobs request has been sent; Upload sends `image` content with `requireFlownConfirmation: true`.
3. Same-day preflight: a `flown_required` row dated today → "Not yet" sends no confirm; reload → the flown question is back; "I flew" → confirm.

A PDF journey uses a generated PDF only if one can be produced within bounded effort (e.g. barcode rectangles drawn as PDF vector ops); otherwise record the PDF path as covered only by unit seams and the pilot.

Checks: `pnpm --filter @kuuki/next typecheck`, `pnpm --filter @kuuki/next lint`, focused vitest, then (primary) `pnpm next:build` → full `pnpm test:next:navigation`.

## Comments
- 2026-10-12 (final review repair): partial-pass upload is fenced against reset/unmount (ref token); no unit seam, covered by inspection. Final gates: next:build 0, full navigation 44 passed.
