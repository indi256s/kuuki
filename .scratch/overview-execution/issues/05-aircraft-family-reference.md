# Aircraft family test references an absent aircraft

Status: open

Release 2 Task 1 adds families to the existing 215 aircraft entries, but its
required example `findAircraft('AT76').family` references an absent entry.
The current dataset contains AT72 (model `72`).

## Evidence

`pnpm test:api packages/data` exits 1 with `Test Files 1 failed (1)` and
`Tests 7 failed (7)`. Six failures cover the unimplemented family field/helper;
the AT76 assertion fails because `findAircraft('AT76')` is undefined.
The independent read-only lookup probe prints:

```json
{"entries":215,"at76Present":false,"at72Model":"72"}
```

Logs: `/tmp/kuuki-overview-execution/r2-t1-red.log` and
`/tmp/kuuki-overview-execution/r2-t1-reference-probe.log`.

## Decision needed

Recommended: replace the AT76 example with existing AT72, preserving all 215
entries and testing the required ATR family. Alternative: authorize adding an
AT76 reference entry, changing dataset scope. Neither correction is implemented.
The user's instruction requires stopping when a plan conflict changes behavior.

## Comments

Task 1 is paused before implementation. Its failing test and Vitest discovery
configuration are prepared; no task checkbox is checked and no later task began.
