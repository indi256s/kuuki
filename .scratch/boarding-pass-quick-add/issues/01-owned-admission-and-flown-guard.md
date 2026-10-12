# 01 — Owned local-leg admission and flown-confirmation guard

Status: resolved
Type: task
Requirements: QA-02, QA-04, QA-06 (storage), QA-07, QA-08, QA-11, QA-12
Contract: [spec § Engineering resolution, OQ2/OQ3](../spec.md#engineering-resolution-implementation-thread-2026-10-12)
Review: independent read-only review required (new untrusted API contract, data-mutating).

## Outcome

`POST /api/import/jobs` admits `type: 'boarding_pass'` legs into an owned review batch exactly as the contract says; PDF/image job bodies accept `requireFlownConfirmation: true` and every resulting draft (sync writer and `ImportJob` Durable Object) carries `flown_required`; the draft patch accepts `flownConfirmed`; `confirmBatch` refuses today/past `flown_required` rows without `flown_confirmed` with `FLIGHT_NOT_CONFIRMED`.

## Owned paths

`functions/api/import/jobs.ts`, `functions/api/import/drafts/[id].ts` (only if the patch parser needs it), `functions/api/_services/importJob.ts`, `functions/api/_services/importDrafts.ts`, `functions/api/_services/importConversion.ts`, `functions/api/_services/importRuntime.ts`, `workers/import/ImportJob.ts`, `functions/test/import-drafts.test.ts`, `functions/test/import-conversion.test.ts`, `functions/test/import-stream.test.ts` (marker pass-through only).

## Acceptance

- Valid admission → 201 snapshot; replay of the same operation id → 200 with the stored batch, no second batch. Works with no provider key and with `IMPORT_JOBS` bound (never dispatches).
- Strict validation: unknown body/leg keys, 0 or >8 legs, bad codes, non-integer or out-of-range `dayOfYear`, non-boolean `incomplete`/`requireFlownConfirmation` → 400; nothing persisted.
- Auth/CSRF/rate limit/open-batch limits reuse the existing gates (extend the existing table-driven cases, do not duplicate them).
- Stored drafts hold only allowlisted fields; confidence/field confidence null; `year_explicit` 0; `selected` 0; `incomplete` → `partial`/`ROWS_REJECTED`.
- `flownConfirmed` patch: set/clear, 400 on rows without `flown_required`, version bump, `edited` unchanged.
- Conversion: today/past `flown_required` unconfirmed → 400 `FLIGHT_NOT_CONFIRMED`, nothing written; confirmed → created `logged`; future unconfirmed → created `upcoming`; general import rows unaffected.
- Checks: `pnpm typecheck:api`, `pnpm test:api`, `pnpm exec tsc --noEmit -p workers/import/tsconfig.json`.

## Comments

- 2026-10-12 orchestrator: implementation `bpqa-01-impl-r1` inspected (diff OK; test:api 731 pass). Independent review `bpqa-01-review-r1` (Sonnet 5.5, read-only by prompt): no critical/major. Repairs required before acceptance: (1) a `fields.date` change clears `flown_confirmed` unless the same patch sets `flownConfirmed`; (2) `requireFlownConfirmation: false` is accepted on text bodies, only `true` is refused. Declined: midnight `now` vs fresh `Date` window in `bulkCreate` (milliseconds; residual risk), `__proto__` pin test (behavior already correct), present-`undefined` optional (unreachable from JSON).
