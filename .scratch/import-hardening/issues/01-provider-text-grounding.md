# Provider text grounding and partial-record recall

Status: open
Type: task

The strict local parser handles the supplied structured list. Unsupported prose still relies on one Gemini call. The completed full-list provider diagnostic recovered 90/95 reconstructible records, guessed four ambiguous airports, missed five partial/undated records, and preselected two incorrect flight numbers. Required JSON schema and self-reported confidence did not prevent these semantic failures.

Evidence: private `.scratch/import-eval/live-full-rescored.json` and `report.md`; aggregate results and reproduction commands in `docs/research/2026-10-07-import-recognition.md`. Do not publish original sources, passenger identifiers or credentials.

Next experiment: preserve record/heading context, request source spans for required facts, validate them against input, and compare contextual chunks on unsupported prose with the current single call. Keep deterministic supported-list parsing. Evaluate exact field errors among initially selected rows separately from candidate recall. Confirm on an untouched import before broad accuracy claims.

Acceptance: no unsupported date/airport/flight identity promoted to a selected row in the test set; uncertain and partial records remain correctable; provider timeouts preserve validated completed rows; source/privacy retention remains consistent with ADR 0001. A prompt-only improvement must demonstrate better measured outcomes rather than assume confidence is calibrated.
