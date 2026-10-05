# An oversized single provider chunk drops the complete rows inside it

Status: ready-for-agent
Owner task: T11 follow-up / T15
Source: progress.md:182 and review-T11-findings.md Minor 12 (M12). Verified on wip/redesign-T11 @74f2eb4 (T11 is not merged into af92d26 yet)

## What is wrong
`workers/import/scanner.ts:19-21` adds the chunk's bytes and throws `OUTPUT_LIMIT` (cap `MAX_OUTPUT_BYTES` = 1 MiB, `importRuntime.ts:10`) before the chunk is scanned. If the chunk that crosses the cap also contains complete flight objects, those rows are never yielded and never persisted, although earlier chunks' rows are kept.

## Expected behaviour
Rows that complete inside the crossing chunk and fit within the cap are yielded first; the batch then ends `partial` with `OUTPUT_LIMIT`.

## Acceptance check
In `functions/test/import-scanner.test.ts`: push one chunk, larger than the remaining budget, that holds 3 complete flight objects. Expect the generator to yield them (or the first ones that fit) before throwing. Red now: it throws with zero rows.
