# A known home outside flown endpoints is absent from the payload references

Status: resolved — user approved known-home references

Release 2 Task 2 requires airport reference keys to equal the flown endpoints.
Task 5 requires a known home override to win, even when it is not the most
departed airport. The pure engine can only look up airports in the payload.
An override outside those endpoints has no metadata, so the engine cannot
distinguish a known airport from an unknown code.

## Verified evidence

The isolated D1 integration test uses one logged TBS–IST flight and sets its
owner's home to JFK. It verifies that JFK exists in `airports_reference`, that
the payload's `homeOverride` is JFK and that its airport keys are IST and TBS.
The expected home is `{ iata: 'JFK', source: 'override' }`; the actual result
is `{ iata: 'TBS', source: 'most_departed' }`.

Command:
`pnpm test:api packages/shared/src/overview/figures.test.ts functions/test/overview-data.test.ts`
Output: `/tmp/kuuki-overview-execution/r2-t5-focused.log`.

```text
Test Files  1 failed | 1 passed (2)
     Tests  1 failed | 34 passed (35)
```

All nine pure-engine tests pass. API typecheck exits 0. No production or
remote resources were used. The owner builder is unchanged.

## Decision needed

Recommended: extend Task 2's airport subset to include the owner's home
override when it is known in D1, alongside flown endpoints. Keep one batch
and owner isolation, and update the plan's reference-subset rule and tests.
Do not add the full airport catalog. An unknown override still falls back.

The user's instruction requires approval before resolving a plan conflict
that changes behavior. Task 5 remains uncommitted, with no checked task boxes;
Tasks 6–17 have not begun. Full checks are held while this known failure awaits
the decision. Per-task reviews are omitted under the user's revised workflow;
the final whole-branch review remains required.

## Comments

The user approved the recommended change. The owner-scoped airport SELECT now
unions that owner's home with the flown endpoints, in the original batch. The
projection adds it only when D1 returned a known airport. Tests verify the
known JFK override outside endpoints, a single batch, an unknown ZZZ fallback
without added metadata and the existing owner-isolation subset. The plan's
Task 2 reference-subset rule is updated. Focused GREEN: 2 files / 36 tests.
