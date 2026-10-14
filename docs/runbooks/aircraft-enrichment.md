# Aircraft enrichment

The authenticated `/api/enrich/aircraft` endpoint uses Gemini by default. Set `ENRICH_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` on the API Worker to select Haiku. `ANTHROPIC_ENRICH_MODEL` defaults to `claude-haiku-5-5`; `ANTHROPIC_WORKSPACE_ID` is optional. Local `.dev.vars` does not configure a deployed Worker. See the [API research](../research/2026-10-13-haiku-enrichment-api.md).

Both providers return suggestions. Haiku discovers cited sources, then extracts structured candidates in a second request. The adapter checks literal citation text, occurrence identity, aircraft type and scheduled/actual basis. It does not admit a source record or write journal data. Optional `source_hints` are discovery URLs, never evidence on their own.

## Operator evaluation

Run from the workspace root. Keep input and output beneath `.scratch/import-eval/`; artifacts contain private flight data. Inventory uses `cf` against an explicitly named account and database and issues only SELECT statements.

```sh
pnpm exec tsx scripts/inventory-aircraft.ts --account-id ACCOUNT_ID --database-id DATABASE_ID --output .scratch/import-eval/inventory.json
pnpm exec tsx scripts/evaluate-aircraft.ts --input .scratch/import-eval/evaluation-input.json --output .scratch/import-eval/haiku-results.json --provider anthropic --real-provider --batch-size 1 --max-requests 20
```

Select at most 50 unique occurrences from the inventory into a separate `evaluation-input.json` with a `flights` array before evaluation. The full inventory can exceed that per-run limit.

Evaluation contacts the paid provider but does not write D1. It groups repeated journal occurrences while retaining their input IDs, reserves two requests per Haiku batch, persists progress and does not retry. The request limit is not a hard dollar budget. An interrupted batch can leave usage unknown. Outputs refuse overwrites and remain `candidate_only`; conservative usage estimates use the higher token price tier. [ADR 0003](../adr/0003-automatic-missing-flight-details.md) governs the separate automatic-write boundary. This adapter offers suggestions for review and does not implement source-record admission or journal writes.

## 13 October 2026 verification

Live Haiku evaluation covered nine unique flights through discovery and three with source hints. All twelve completed without provider errors; none yielded a supported aircraft candidate. The estimated aggregate cost was about $0.26 using the reported per-batch short-context tier, or $0.44 at the runner's conservative higher tier; these are estimates, not billing reconciliation. This result does not establish useful production coverage.

Independent research supplied seven dated occurrences covering eight missing journal records. After explicit user approval of those values and a waiver of the general writer hold, a guarded `cf` batch filled eight `aircraft_icao` fields across five users. A local backup restore rehearsal checked the target rows, integrity, drift rejection and preservation of intentional clears on replay. The inspected schema differed only in advanced-stats column order, and the user approved proceeding after that comparison. Remote verification confirmed all eight target rows matched their snapshots except for the intended aircraft field; the canonical derived-state service then repaired all five users successfully.

Private source reports, snapshots, backup, SQL batch, authorization and verification receipts are under `.scratch/import-eval/prod-2026-10-13/`. No automatic writer, schedule or production provider deployment was added by this operation. Future production writes still require their own scoped authorization and applicable release gates.
