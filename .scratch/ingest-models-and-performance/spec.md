# Ingest model evaluation and performance

Status: production released and verified at 15528c0d. Flash-Lite extraction plus full Clef source checking is live; failed/disagreed/unsupported checks stay unchecked. Ponytail and Thermos findings are fixed and reviewed. Native CI, preview and production gates passed. Awaiting owner spot-check of provisional corpus labels; C01–C03 remain uncertain.
Updated: 2026-10-11 — Q1–Q6 answered by the owner
Created: 2026-10-11
Scope: fresh text-ingest comparison and measured optimization; production selection remains open.

## Problem Statement

Members need pasted flight records and documents converted into accurate, reviewable import drafts without long waits or confidently wrong defaults. The existing photo benchmark does not establish which pipeline works best for free-form text. A narrow local parser is fast on its supported fixture, but its age or success on that fixture does not prove broader coverage.

The owner needs a defensible model recommendation and evidence about speed, cost and parallelization before changing ingest. Earlier recommendations mixed photo evidence, different historical text runs and simulated pipelines; those must be distinguished in the next comparison.

## Solution

Compare current Gemini extraction, Gemini with Clef checking, and Cloudflare Gemma on the same text fixtures with consistent scoring and recorded configurations. Retain the existing supported structured-list fast path while testing free-form text through the provider path explicitly.

Measure time to the first reviewable draft as well as completion, errors, token usage and cost. Evaluate a smaller provider response and bounded parallel work only where they preserve source context and existing import behavior. Publish the comparison and a concrete recommendation before choosing production changes.

The conversation supports this evaluation direction. A particular model switch, checker threshold, output schema or concurrency setting has not been approved as a production decision.

## User Stories

1. **ING-01.** As the journal owner, I want a fresh comparison on free-form text, so that I can choose ingest using text evidence rather than photo results. Acceptance: the current configured Gemini baseline, Gemini with Clef checking, and Cloudflare Gemma are attempted on the same frozen input set; unsupported or unavailable configurations are reported explicitly; parser bypass is recorded for every run; prompt/schema versions, settings, repetitions, successes and failures are retained with results.
2. **ING-02.** As a member, I want extracted facts and review defaults to reflect my source, so that incorrect or uncertain candidates are not treated as ready to save. Acceptance: scoring separately reports field accuracy, fully correct rows, missing and extra candidates, invented facts, confirmed exclusions, uncertain candidates, wrong preselected rows and correct rows left unselected. A checker disagreement retains the candidate for review rather than deleting it or inventing a correction.
3. **ING-03.** As a member, I want supported structured lists to remain fast and unsupported prose to be understood in context, so that optimization does not silently lose records. Acceptance: a fully recognized list bypasses the provider; unsupported content falls back intact; ambiguous airports, missing years and uncertain booking status retain the existing review behavior. The structured fixture is reported separately from free-form coverage.
4. **ING-04.** As a member, I want to see complete draft rows while recognition continues, so that I can begin reviewing without waiting for the entire response. Acceptance: any adopted optimization preserves complete-row streaming, persistence before notification, stable source ordinals and user edits. First provider token/chunk, first complete row and first persisted reviewable draft are distinct measurements.
5. **ING-05.** As the journal owner, I want measured latency and cost improvements, so that a cheaper model or parallel calls are not mistaken for a faster, better import. Acceptance: report per-input duration, applicable upload/dispatch/persistence/checking timings, first-row latency, token usage including reasoning, and estimated cost at stated prices. Summaries state sample size and use p50/p95 only when repetitions support them. Every optimization is compared with the current baseline on identical inputs and configurations except the variable under test.
6. **ING-06.** As a member, I want an interrupted or failed import to remain recoverable, so that faster processing does not lose drafts or create duplicate flights. Acceptance: any adopted runtime change preserves cancellation fencing, idempotent submission, partial drafts after invalid/truncated output, review before conversion and existing structured errors. Checker failure is reported separately from extraction failure; whether it prevents preselection remains an open production policy.

## Implementation Decisions

- **Existing architecture remains the baseline.** Supported text lists parse locally. Other text, images and PDFs use the configured Gemini model, currently defaulting to Gemini 3.5 Flash-Lite. The live implementation is a single-model extractor; the two-Gemini agreement pipeline exists in saved evaluation simulations.
- **Extraction and checking have different contracts.** An extractor produces candidate fields for shared normalization and draft projection. Clef evaluates claims or status evidence; it does not replace free-form extraction. Candidate loss, corrections and preselection changes must be scored independently.
- **Shared behavior stays shared.** Evaluation must use the production extraction helpers, normalizer and draft projection where compatible. Provider adapters may translate transport/schema representation, but must not silently change the task. Record every intentional difference.
- **Parser scope stays narrow during evaluation.** Retain the supported-format fast path and intact fallback. Do not add heuristic prose parsing or remove the parser based on its age. Any replacement requires a separately recorded decision and evidence.
- **Runtime and persistence contracts are constraints.** ADR 0001 sections 6 and 9 define one processing batch per member, bounded output/drafts, a shared provider deadline, generation fencing and persistence before notification. Uploaded content and provider responses remain absent from production storage and logs. Drafts remain distinct from flights; extraction never creates flights automatically.
- **Parallelization is an experiment, not a settled setting.** Independent extraction calls may overlap. Verification requires extracted claims and cannot fully run before those claims exist. Test within-batch work only if source relationships, cancellation, deadlines and ordinal reconciliation can be preserved. No unbounded fan-out or multiple competing processing batches.
- **Performance candidates are proposals.** A smaller response schema, selective checks of preselection-eligible rows, low/minimal reasoning and bounded parallel sections require their own baseline comparison. Current Gemini 3.5 already defaults to minimal thinking; explicitly setting it is not evidence of a speedup.
- **No interface or database change is agreed.** Keep the existing submission, event, draft-edit and confirmation contracts. An adopted optimization that requires changing them must document the change and resolve the applicable ADR decision before implementation.

## Testing Decisions

- Reuse the existing import evaluation harness and fixed expectations for local-parser and provider-only runs. Extend its adapters/scoring only where needed to establish ING-01, ING-02 and ING-05; keep historical results intact.
- Preserve the existing travel-log fixture as regression evidence. It is not an independent holdout and cannot alone establish free-form generalization. Corpus composition, independent labels and repetitions remain open questions.
- Reuse import provider, scanner, stream, runtime and draft tests for input validation, explicit-year evidence, complete rows, deadlines, partial output, stable ordinals, edits, idempotency and cancellation. Add a regression only for a new failure mode that these seams do not cover.
- A proposed compact schema must round-trip to the same normalized fields, review flags and draft metadata. Measure tokens and latency; verify that missing fields, explicit-year evidence and partial candidates are not lost. Schema and prompt remain identical across models where supported; document deviations.
- If selective checking is tested, distinguish checked, unchecked, failed and disagreed rows. Report retained correct selections and wrong selections together. Do not equate zero observed wrong selections on a small sample with proven safety.
- If parallel sections are tested, include evidence spanning section boundaries: cancellations and replacement bookings, other-passenger context, corrections, duplicate legs and partial dates. A strategy that loses these relationships does not satisfy ING-02/ING-03 even if it is faster.
- Runtime changes use the existing focused API/Worker checks required by coding standards. Documentation and benchmark publication alone do not require an application build or browser inspection.
- No fixed latency SLA, cost ceiling, accuracy margin or sample count was agreed. Resolve these before using benchmark results as a production admission gate.

## Out of Scope

Production deployment, remote database writes, automatic flight creation, changes to flight conversion or lifecycle semantics, multi-file UI, a general handwritten prose parser, broad UI redesign, saved-flight enrichment, and collecting production uploads without a separately defined scope.

A Gemma replacement, universal second extractor, stronger-model escalation, specific checker threshold, and production concurrency configuration are not selected by this spec. Photo evidence remains useful context, but is not a substitute for the missing text comparison.

## Further Notes

### Evidence and existing seams

- [Current local-parser result](../import-eval/text-local-current.json): rerun in this conversation; 93 ms on the existing structured travel log, 95 matched reconstructible records, 665/665 compared fields, 96 retained candidates, one rejected record and zero unsafe preselected rows. This demonstrates fixture behavior, not arbitrary-text coverage.
- [Earlier text evaluation report](../import-eval/report.md) and [saved Clef benchmark](../import-eval/clef-bench.json): different historical runs. One Gemini run took 71.010 seconds, produced its first row at 836 ms and cost approximately $0.05667. Clef caught 20/26 wrong rows with three correct rows flagged, adding 1.734 seconds and approximately $0.00578. The separate revised-schema report records a 45.4-second provider run. Do not combine these as one fresh benchmark or claim a proven improvement between them.
- [Gemma photo evaluation](../import-eval/commons/GEMMA-EVAL.md): 184 images attempted; thinking-disabled Gemma returned 74/131 correct labeled legs, compared with 104/131 for saved Gemini 3.5 predictions. Its agreement pairing retained 14 preselected rows with two wrong, versus 19 with two wrong in the earlier two-Gemini simulation. Gemma free-form text has not been benchmarked. Earlier Gemini prompt versions for that photo comparison were not recorded.
- Shared extraction/routing: `functions/api/import/_extract.ts`, `_text.ts`, `_shared.ts`, `_provider.ts`; draft projection and job submission: `functions/api/_services/importJob.ts`; streamed recognition: `workers/import/ImportJob.ts` and `scanner.ts`. These are investigation pointers, not an execution/ownership map.
- Existing evaluation seam: `scripts/evaluate-import.ts`. Existing behavioral suites include `functions/test/import-provider.test.ts`, `import-provider-gate.test.ts`, `import-scanner.test.ts`, `import-stream.test.ts`, `import-runtime.test.ts`, `import-drafts.test.ts`, plus client batch/reload tests.
- Governing contract: [ADR 0001 sections 6 and 9](../../docs/adr/0001-flight-lifecycle-and-import-drafts.md). Production binding availability was not verified in this work. Fresh runtime timing must distinguish the bound streaming path from the synchronous fallback.

### Material open questions (answered 2026-10-11; see Decisions below)

- **Q1 — Corpus and labels:** which independent free-form samples are available, and how will cancellation, ownership, ambiguity, corrections, long logs and cross-record evidence be labeled? The existing pipe-formatted travel log cannot be the only admission set.
- **Q2 — Admission criteria:** what accuracy/preselection regression tolerance, latency target, cost ceiling and repetition count determine whether a candidate is suitable? These were not settled.
- **Q3 — Model/checker policy:** which Gemini and Gemma variants/settings and which Clef variants/thresholds should the fresh text comparison include? Gemini with full checking is prior evidence; selective checking is an untested proposal.
- **Q4 — Failure behavior:** if a checker times out or fails, should otherwise eligible drafts remain unticked? This is the recommended conservative proposal, not an agreed production rule.
- **Q5 — Optimization choice:** does a compact response demonstrably help before chunking? If parallel sections are worthwhile, what safe boundary/context scheme and bounded concurrency preserve whole-document evidence within the existing one-processing-batch contract?
- **Q6 — Adoption:** after the comparison, which candidate and optimizations should actually change production ingest? The current request authorizes publishing this spec; it does not select or deploy a production replacement.

## Decisions (owner, 2026-10-11)

- **Q1 — Corpus: real + synthetic.** The owner supplies roughly 10–20 real free-form pastes (booking emails, airline confirmations, notes). The agent adds synthetic adversarial cases for cancellations, rebookings, other-passenger legs, corrections, duplicate legs and missing years. The agent labels everything and the owner spot-checks the labels. The travel-log slices remain regression evidence only. Real pastes stay private under `.scratch/` and never go into logs.
- **Q2 — Gates: safety only, everything else advisory.** The single hard gate is no added wrong-preselected rows compared with the Flash-Lite baseline on identical inputs. Field accuracy, latency (first row, total), tokens and cost are reported against baseline, and the owner judges them. Each input runs 3 times; p95 is reported only where the sample supports it.
- **Q3 — Configurations: core only.** (a) Gemini 3.5 Flash-Lite at default (minimal) thinking, (b) Flash-Lite + Clef full check using the `clef` variant, (c) Gemma 4 26B-A4B (`@cf/google/gemma-4-26b-a4b-it`) with thinking off. Selective checking, Gemma thinking-on and the other Clef variants are out of this round.
- **Q4 — Checker failure: keep the row, unticked.** When Clef times out or errors, otherwise-eligible rows remain as drafts, unselected and marked not verified. Checker failure is reported separately from extraction failure. This is the evaluation policy and the proposed production policy.
- **Q5 — Optimization: compact schema only.** Measure a smaller response schema against baseline (tokens, total time, first complete row) and prove it round-trips to identical normalized fields, review flags and draft metadata. Parallel sections are deferred: streaming already yields a ~1.7 s first row, and chunking risks the cross-record evidence that ING-02/ING-03 require.
- **Q6 — Adoption: a separate decision.** The evaluation ends with a published report and a recommendation. The owner chooses the production change in a follow-up, recorded as an ADR before any runtime work. Nothing is adopted automatically.

## Evaluation outcome (2026-10-11)

The owner supplied 15 real text inputs (11 trip groups) and four images, then explicitly authorized live provider calls. This superseded the initial offline-only restriction. The [private report](corpus/results/live-2026-10-11/report.md) compares the frozen 30-input set across Flash-Lite, paired full Clef checking, thinking-disabled Gemma and the compact-schema experiment. Labels remain provisional; no production behavior changed.

Clef passes the observed row-level safety gate and reduces wrong selections, while unticking additional correct rows. Gemma fails and is slower on this corpus. Compact's sole added wrong selection is calendar C01. The owner chose to keep C01–C03 uncertain, preserving their review labels and compact's primary gate failure. The confirmed-flight sensitivity result remains hypothetical. Keep Flash-Lite pending the remaining label spot-check and the owner's adoption decision. First reviewable rows were measured in memory; persisted application delivery was not measured.

Owner follow-up: spot-check [label-review.md](corpus/label-review.md), the synthetic judgments and I04's airport interpretation in [corpus/README.md](corpus/README.md). Calendar decision recorded: keep C01–C03 uncertain for now; no further clarification is required to score this run. Corrected labels should be rescored separately from the frozen primary run. Production implementation and its execution/ownership map follow a separate ADR decision.

## Production adoption and release (owner, 2026-10-11)

The owner requested the best evaluated ingest in production, superseding the evaluation-only scope above. ADR 0001 records the adopted Flash-Lite plus full Clef contract. PRs [55](https://github.com/indi256s/kuuki/pull/55), [56](https://github.com/indi256s/kuuki/pull/56) and [57](https://github.com/indi256s/kuuki/pull/57) are merged. Candidate `15528c0daa59c4cfe5a06cfcb0e0d3c2c06137b4` passed native build `d3e7973e-98bb-4265-aa50-9423c7bbaed4` before production deployment.

The [audit](audit-2026-10-11.md) records five repaired findings; the [release note](release-2026-10-11.md) records Worker versions, rollback targets and gates. Production recognition completed after the browser tab was closed for 50 seconds: 10 drafts, nine verified/selected and one disagreed/unchecked. Synthetic preview and production accounts were removed; no test flights were created. Private source pastes were not used in release checks or committed. Labels remain provisional and C01–C03 remain uncertain.
