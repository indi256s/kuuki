# Import recognition evaluation — 7 October 2026

Local changes and measurements; no deployment acceptance. Evaluation sources, labels, provider predictions and the three original boarding-pass photos stay in ignored `.scratch/import-eval/`. Credentials stay in ignored `.dev.vars` and are never written to reports.

## Routing and safeguards

Supported pipe-delimited travel lists use a conservative local parser. Unknown prose goes intact to the existing Gemini extraction. Image/PDF recognition remains model-backed. Both API and Durable Object paths share normalization and review defaults.

Confirmed canceled/refunded, unpaid, superseded and other-passenger bookings are excluded. Uncertain refunds/cancellations, conflicting details, ambiguous cities, unavailable years and missing reference codes remain for correction. Multiple passes in a photo are separate legs; detachable stubs are duplicates. Boarding time is not departure time.

The audit fixed low-confidence default selection, losing partial routes, optional year provenance in model output, and duplicate conversion within one request or concurrent requests. Duplicate protection executes inside the existing D1 transaction after shared validation; an invalid first row cannot block a valid later row.

## Evidence

The supplied text has **122 records**: 25 excluded, 95 route-reconstructible candidates and two records without a reconstructible route. The local parser retains **96 candidates**: all 95 route-reconstructible records plus one dated, destination-only ambiguous record. It reports the remaining bare-date entry as incomplete. Compared fields match **665/665**, with no excluded booking returned and no review-labeled candidate preselected. Reference-catalog gaps reduce automatic selection; this measures recognition, not confirmation readiness.

Three real-photo checks recognize **4/4 legs** and **28/28 compared fields** with no invented years, arrivals or departure times. Each photo lacks a visible year, so all four legs wait for review. Runs after the schema change took approximately **2.8–3.6 seconds per photo**. These small samples do not establish general recognition accuracy.

Live text samples exposed a concrete schema bug: eight written years were initially blanked because Gemini omitted the optional explicit-year flag. Requiring the flag and its containing confidence object recovered **8/8 keys and 56/56 compared fields** on the same core sample (4.5 seconds). Harder samples still omit uncertain and partial records.

The final provider-only full-list retry completed in **45.4 seconds**, with the first complete streamed row at 1.7 seconds, 22,876 reported total tokens and a `STOP` finish reason. It retained **90/95** reconstructible records, including six with incorrect airline/flight identities; **80** had all date/route/airline/number keys correct, and **619/630** compared fields matched. Five partial destination-only/undated records were missing. No excluded booking returned. **68 rows were initially selected, including two with incorrect flight numbers**; confidence-based selection alone remains insufficient for provider-backed text. The local route initially selects 60 rows with no observed field errors. Earlier full runs timed out at the application's 90-second deadline; this single completed retry does not establish reliability across runs. The local route avoids that call entirely.

## Reproduce

From the workspace root, with the private fixtures and independently labeled `expected.json` present:

```sh
pnpm exec tsx scripts/evaluate-import.ts --text-only --output .scratch/import-eval/offline.json
pnpm exec tsx scripts/evaluate-import.ts --real-provider --output .scratch/import-eval/live.json
pnpm exec tsx scripts/evaluate-import.ts --real-provider --provider-only --file travel-log.txt --output .scratch/import-eval/model-text.json
```

`--text-only` is offline and needs no key. Live calls require explicit `--real-provider`; the evaluator reads `GEMINI_API_KEY` from the environment or `.dev.vars` without printing it. `--file` selects a private text/photo fixture; `--repeat` accepts 1–5. Reports retain complete streamed rows on timeout and distinguish missing candidates, extra candidates, excluded bookings, unsupported fields and unsafe preselection. Model runs are diagnostic, never ground truth.

## Research decision

Two Luna 6 agents at max reasoning reviewed primary sources. Keep deterministic parsing for clear records; evaluate contextual chunks only for unsupported long text before changing the runtime. Preserve headings and original record boundaries. Avoid per-row calls as the default because they repeat context and can lose booking ownership/status. A future provenance experiment should require source spans and validate them against the imported document; self-reported confidence alone cannot establish correctness.

Google documents that [structured output guarantees schema shape, not semantic correctness](https://ai.google.dev/gemini-api/docs/generate-content/structured-output). [IATA location codes](https://www.iata.org/en/iata-repository/pressroom/fact-sheets/fact-sheet-iata-location-codes/) distinguish individual airports and metropolitan areas. [Confidence calibration research](https://arxiv.org/abs/2305.14975) concerns other models and tasks; its results cannot establish calibration for this import feature.

Remaining ceilings: the local parser deliberately handles a narrow list grammar and uses the checked-in reference catalog. Unsupported prose still makes one provider call; reliable recognition of long, uncertain prose is not demonstrated. Keep a separate untouched import as a holdout before claiming broad accuracy.

## Local verification

The full API suite passed **555 tests across 48 files**. API, import-worker and scripts typechecks passed; both API compilation and import-worker dry-run bundling passed. Focused regressions reproduced uncertain-status loss, false airport resolution and duplicate-save failures before the fixes. Independent read-only review found no remaining actionable issue in the revised runtime/parser/transaction paths. No push or deployment was performed during the evaluation.
