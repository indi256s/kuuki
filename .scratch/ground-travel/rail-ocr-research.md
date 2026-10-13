# Rail ticket OCR: local seams and proposed contract

Date: 2026-10-13. Scope: triage only; no provider calls, private corpus reads,
tests, deployment checks or application changes. Hosted configuration is unverified.
Accepted scope: quick input from a ticket, without storing originals or raw source;
the owner groups rail legs and explicitly confirms completed travel and countries.
Owner requires selecting/uploading multiple files together and explicitly adding
to or replacing legs in an existing journey. Numeric caps below are proposals.

## Existing runtime facts

- Default extractor is `gemini-3.5-flash-lite`; optional `GEMINI_IMPORT_MODEL`
  overrides it separately in each Worker. Current hosted override is unknown.
  Sources: [provider](../../functions/api/import/_provider.ts), [job Worker](../../workers/import/ImportJob.ts).
- Next binds `IMPORT_JOBS` to the separate import Worker's `ImportJob` DO.
  The DO streams structured Gemini JSON, persists complete normalized rows before
  notification, and fences writes with owner/batch/generation. Without that binding,
  the API runs synchronous `generateContent`; it does not stream provider rows.
  Sources: [bindings](../../apps/next/wrangler.toml), [submitter](../../functions/api/_services/importJob.ts),
  [DO](../../workers/import/ImportJob.ts), [extractor](../../functions/api/import/_extract.ts).
- Extraction and full Clef source checking share a 90-second provider deadline.
  Processing recovery uses a 120-second deadline. Clef runs through native `AI`
  binding at `@cf/cloudflare/clef`, variant `clef`.
  Sources: [provider](../../functions/api/import/_provider.ts), [checker](../../functions/api/import/_verify.ts), [DO](../../workers/import/ImportJob.ts).
- The ingest handoff records adoption on 11 October; corpus labels are provisional.
  Those flight results establish neither rail accuracy nor current hosted state.
  Sources: [handoff](../../docs/plans/2026-10-11-ingest-evaluation-handoff.md), [ingest spec](../ingest-models-and-performance/spec.md),
  [ADR source verification](../../docs/adr/0001-flight-lifecycle-and-import-drafts.md#source-verification-owner-11-october-2026).

## Admission and source lifetime

- Current browser chooser admits one PDF, PNG or JPEG file; no `multiple` attribute.
  [source step](../../apps/next/src/client/import/source-step.tsx).
- Server admits one `type/content` source: PDF, image or text. Binary content is
  base64, limited to 10 MiB decoded; JSON request limited to 14 MiB. Text is capped
  at 100,000 characters. [limits](../../packages/shared/src/constants.ts),
  [validation](../../functions/api/import/_extract.ts), [base64 checks](../../functions/api/import/_body.ts).
- Extractor MIME detection recognizes JPEG/PNG/GIF/WebP prefixes but defaults
  unknown input to JPEG. This is not strict format validation; do not reuse that
  fallback as a promise of supported rail formats. [MIME helper](../../functions/api/import/_shared.ts).
- Clef supports PNG/JPEG/WebP only within 4 MiB and 16 million pixels; PDF and GIF
  checking is unsupported. Context budget is 32 KiB; no silent source truncation.
  Unsupported/failed/disagreed checking retains candidates for unchecked review.
  [checker](../../functions/api/import/_verify.ts).
- Browser source encoding and API/DO transfer are in memory. DO durable storage
  holds a fence only, never source/provider output. A restart cannot recover the
  source: existing drafts survive, while processing becomes interrupted.
  [browser](../../apps/next/src/client/import/source-step.tsx), [runtime](../../functions/api/_services/importRuntime.ts), [DO](../../workers/import/ImportJob.ts).
- D1 stores extracted bounded fields and confidence/status metadata, not original
  bytes, pasted text, provider response or `raw_text`. Batch TTL is 30 days;
  conversion receipts are separate tombstones, documented for 37 days.
  [migration](../../db/migrations/0007_import_drafts.sql), [draft service](../../functions/api/_services/importDrafts.ts),
  [conversion](../../functions/api/_services/importConversion.ts).
- No-original retention and no-derived-draft retention are different contracts.
  Existing flight fields persist for review; the proposed rail flow instead keeps
  structured OCR/local drafts before ordinary save. Application nonstorage does not
  establish the external model provider's data-retention policy.

## Flight-specific boundaries and reusable mechanisms

- Prompt/schema normalize IATA airports, airline codes, flight numbers and aircraft;
  unknown year yields empty date plus explicit-year metadata. Conflict/uncertain
  ownership/mode remains reviewable. This schema/parser/converter cannot be reused
  unchanged for rail. [prompt](../../functions/api/import/_shared.ts), [schema/normalization](../../functions/api/import/_extract.ts).
- Submission dedupes by `(user_id, submission_operation_id)` and returns the old
  batch without another provider call; it does not compare source payload digests.
  Do not imply same key with different ticket is rejected today.
  [submission](../../functions/api/_services/importJob.ts), [batch writer](../../functions/api/_services/importDrafts.ts).
- Draft editing checks owner and expected version, then CAS increments version;
  conflict returns 409 and current draft. Conversion checks durable receipts before
  batch existence/expiry, detects mismatched keys, atomically creates canonical
  data and receipt, and returns gone when the converted flight was deleted.
  [editing](../../functions/api/_services/importDrafts.ts), [conversion](../../functions/api/_services/importConversion.ts).
- Cancel commits status/generation fencing before best-effort abort. Discard
  removes owner drafts/batch; disconnected event streams do not cancel recognition.
  SSE sequence events are notifications; persisted snapshots are authoritative.
  [cancel/discard](../../functions/api/_services/importDrafts.ts), [runtime](../../functions/api/_services/importRuntime.ts), [DO](../../workers/import/ImportJob.ts).
- Stable errors cover service unavailable, invalid response, quota, unavailable
  model and timeout without exposing source/provider bodies. Keep manual input
  usable after failure. [provider errors](../../functions/api/import/_provider.ts).

## Proposed minimum rail contract — parent architecture decision

- Owner requirement: choose/upload several files together, with one combined
  review, and explicit add/replace when targeting an existing journey.
- Parent proposal: up to 10 PDF/PNG/JPEG/WebP files, each at most 10 MiB decoded,
  sent as separate requests limited to 14 MiB, concurrency 2. These numeric caps
  are technical proposals, not owner requirements. Existing UI needs WebP admission;
  signature validation must reject unsupported types instead of guessing JPEG.
- Preserve per-file identity/ordinal across combined review; a file may yield
  several legs. Retain successful results while showing failed files and allowing
  per-file retry. Owner chooses journey grouping/order, not the extractor.
- Extract source ordinal, boarding/alighting station text, city text when explicit,
  dates with explicit-year provenance, printed local times, operator/train number
  when present, and bounded uncertainty per field. Omit passenger/booking/seat
  identifiers and raw excerpts. Unknowns remain unknown; never infer years,
  coordinates, actual travel, borders or journey grouping from a ticket.
- Resolve explicit city names against accepted GeoNames cities500 separately;
  ambiguous station/city mappings require owner choice or manual city entry.
  OCR never invents a GeoNames ID; absent coordinates remain absent.
- Proposed rail flow keeps bounded structured candidates/provenance in local draft
  only until ordinary journey save; no original retention or server async source
  queue. Closing/reloading before uploads finish requires source reselection.
  Do not promise flight-style server resume or extend flight `import_drafts` silently.
- Add to an existing journey only after owner-scoped review with expected journey
  version plus stable selected local content. Commit legs, version and receipt
  atomically; digest target/version/selected content, replay same operation, reject
  changed payload and stale target, preserve tombstones after deletion. A completed
  target additionally needs the agreed country recheck flow; OCR is never completion.
- PDF checking is currently unavailable. For rail, keep all OCR candidates in
  explicit review unless a separately designed rail checker succeeds; flight Clef
  questions do not verify rail facts. No automatic save or stamp from extraction.
- Reuse bounded body validation, provider deadline/error mapping and normalized
  structured responses behind a rail-specific prompt/schema; streaming DO/SSE,
  flight draft conversion and flight checker are optional mechanisms, not parity
  requirements. No evaluated rail quality or speed claim exists in local evidence.
