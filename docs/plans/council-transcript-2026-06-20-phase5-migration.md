# LLM Council Transcript — Kuuki Phase 5 Migration Plan

**Date:** 2026-06-20
**Question:** Pressure-test the Phase 5 data-migration plan (Supabase → LOCAL Cloudflare D1) for correctness traps, sequencing bugs, and missing steps before execution.
**Verdict:** GO WITH CHANGES.

> Anonymization mapping (peer-review letters → advisor): A = Expansionist · B = Outsider · C = Contrarian · D = Executor · E = First Principles Thinker.

---

## Framed Question

(LOCKED DECISIONS: MCP read-only snapshot → gitignored JSON; badges + code words from live, aircraft/airports from packages/data; scope = data migration only; LOCAL D1 only — commit, do not deploy.)

The full plan (Steps A–F) and verified context (26 users / 343 flights / 37 country_claims / 15 ground_visits; ports match live PL/pgSQL; transform rules) were supplied to all advisors. Core question: what makes this migration *silently wrong* — passes validation but is subtly incorrect?

---

## Advisor Responses

### The Contrarian
Lands on Step D's regeneration replay. (1) Non-deterministic visit replay — `date ASC, id ASC` only saves you if live IDs are monotonic with intended chronology; back-dated/edited rows produce different cumulative stats that still pass row-count validation; "diff serj + others" leaves the 9 unchecked users as the hiding place for skew. (2) Timestamp truncation — live microseconds (`.581014`) collapse to ms (`.581`); distinct timestamps can compare equal. (3) Email lowercasing assumes `profiles.id == auth.users.id` — assert it (count == 26). (4) `sqlite_sequence` bump after import: RAW INSERTs aren't upserts, so a partial re-run has undefined idempotency — make C transactional or truncate-first. Missing: F trusts the 17 live rows as oracle but never diffs all 26.

### The First Principles Thinker
The real invariant is "the app reading local D1 reproduces what users saw," not "row counts match." Step F validates the wrong thing — diffing the TS port against live `user_stats` tests the port against itself (port == PL/pgSQL already proven). The silent vector is ordering: visits are cumulative/no-decrement, so replaying only surviving final-state rows is a *different event stream* than the live INSERT/edit/delete history — if any flight was ever edited or deleted live, replay diverges while counts pass. Also: `normalizeIso` on `+00` assumes UTC; one non-UTC offset shifts a flight across a date boundary and reorders replay — assert offset == `+00`. Decisive fix: **import the live derived tables too, regenerate into a scratch copy, and diff. If they match, ship imported. If not, you've found the bug before users do.**

### The Expansionist
Step D is a deterministic rebuild-from-raw engine — treat it as a permanent invariant checker, not a one-shot. Parameterize the DB handle so the same harness becomes a CI golden fixture (343 real flights), a reproducible dev DB, and a drift detector that fails the build when a TS port diverges from live. Two traps that pass F: (1) replay tie-order — live `update_visits_from_flight` fired in `flights.id` insertion order, not guaranteed equal to your re-sort; first-writer-wins on non-idempotent fields silently differs. (2) `RESET_REQUIRED` must fail `verifyPassword` *structurally* or you've created 26 accounts with a known shared password. Make F's diff cover ALL 26 users.

### The Outsider
Snapshot fidelity (Step A) is the first silent vector and nobody owns it. "Dump via MCP to JSON" — how? MCP results paginate / cap rows. If the snapshot returns 300 of 343 flights, F compares "vs snapshot" so 300==300 passes green while 43 flights vanish — assert against the VERIFIED numbers (343/26/37/15), not against itself. JSON serializing DECIMAL/bigint can silently round; re-derive `max(id)` from the dumped JSON, don't assume 509. `normalizeIso`/`hashPassword`/`syncVisitsFromFlight` are invoked but undefined here. "Start from empty visits/user_badges" — who guarantees empty? Truncate explicitly. Add a step that reads the JSON back and asserts counts + id-max against locked numbers before any D1 write.

### The Executor
Biggest trap: Step D replay ordering — if the live trigger fired on a different effective order (insertion order or `created_at`, not `date`), replay produces different `last_visit`/`visit_count` and F (which diffs only `user_stats` aggregates) may never surface a wrong `ground_visits` ordering. Diff `ground_visits` row-by-row. Timestamp precision: low risk *only if* `id` is provably the tiebreak in both live and replay. Ordering bug in F: the gate runs `tsc`/`build`/`vitest` — none touch D1 data; make the row-by-row diff a HARD gate. Missing: no transaction/atomicity — `getPlatformProxy()` D1 has no multi-statement txn; add `rm -rf .wrangler/state/v3/d1` + re-apply `0001_init.sql` as Step 0 rollback. Unverified "how": confirm `syncVisitsFromFlight` et al. import cleanly under `tsx`/Node before D.

---

## Peer Reviews

**Review 1:** Strongest = E (replay-from-final-state can't reconstruct the live event stream; fix: import live derived, regenerate to scratch, diff). Biggest blind spot = A (optimizes the verifier while trusting dirty input). All missed: nothing validates the seed/reference path (Step B) — E135 dedup, airports 525 vs 557, badge/code-word integrity, founding-badge double-award.

**Review 2:** Strongest = E (names the root invariant + UTC-offset fix). Biggest blind spot = B (guards the front door, misses the downstream replay leak). All missed: the seed/reference layer — dedup + count mismatches asserted but never diff-checked; founding-user badge idempotency on re-run.

**Review 3:** Strongest = E (validation oracle is circular). Biggest blind spot = A (accepts the validation framing E/B demolish). All missed: locked seed counts unverified against any source; founding-badge idempotency; raw `ground_visits` (15) vs regenerated `visits` conflict.

**Review 4:** Strongest = E (port==port proves nothing). Biggest blind spot = A (trusts snapshot + validation premises). All missed: E135 dedup can break a flight FK invisibly; full FK closure (`profiles.id ∈ auth.users.id`, `flights.user_id ∈ profiles.id`) never asserted; `country_claims`/`ground_visits` have no validation diff.

**Review 5:** Strongest = A (reframes D as a reusable invariant/golden-fixture harness; catches tie-order + sentinel). Biggest blind spot = D (downgrades the replay-order trap that A/C/E call fatal). All missed: import the live derived rows as oracle and ship them if replay is non-reconstructable; `evaluateBadges` is time-dependent (badges keyed on "now"=2026-06-20 differ from live award time); `country_claims`/`ground_visits` no diff.

---

## Chairman Verdict

### Where the Council Agrees
1. **Replay-from-final-state cannot reconstruct live cumulative visits (Step D) — UNANIMOUS.** If any of the 343 flights was ever edited/deleted live, regenerated visits diverge from live and row counts still pass green.
2. **Tie-order on replay is underspecified.** `date` is a calendar date; `id ASC` only saves you if live IDs are monotonic with the order the trigger fired.
3. **Validation oracle is circular (Step F).** Diffing regenerated `user_stats` against live tests the port against itself; the live derived rows ARE ground truth.
4. **Validation coverage too narrow.** Must diff all 26 users / all 5 columns / row-by-row as a hard gate.
5. **`RESET_REQUIRED` sentinel must be structurally unhashable.**
6. **No atomicity / no clean rollback.** Add `rm -rf .wrangler/state/v3/d1` + re-apply `0001_init.sql` as Step 0.

### Where the Council Clashes
- **Import vs. regenerate derived tables** (decisive): center of gravity is that regeneration is a *verification* tool, not the *source of truth* — import the live derived tables, regenerate to scratch, diff; ship imported rows if replay diverges.
- **Front-door (snapshot fidelity) vs. downstream (replay) risk** — both real, not mutually exclusive; validate snapshot against the VERIFIED locked numbers.
- **Timestamp-precision severity** — low risk only if `id` is the *provable* final tiebreak in both live and replay (unverified → assert).

### Blind Spots the Council Caught
- **Seed/reference layer (Step B)** — flagged by all 5 reviews, missed by all 5 advisors: count discrepancies (airports 557 vs 525, aircraft E135 dedup) asserted but never diff-checked; FK breakage from a wrong dedup is invisible; badge/code-word integrity gates downstream behavior.
- **`evaluateBadges` is time-dependent** — badges keyed on "now"=2026-06-20 differ from live award context.
- **Founding-user badge double-award** on partial re-run.
- **Raw FK/orphan integrity** never asserted (`profiles.id ∈ auth.users.id`, `flights.user_id ∈ profiles.id`).
- **`country_claims` (37) and `ground_visits` (15) have no validation diff at all**; raw-vs-regenerated `ground_visits` conflict unresolved.
- **Runtime import risk** — confirm Workers modules import under `tsx`/Node before D.

### The Recommendation — GO WITH CHANGES
Architecture (MCP snapshot + `getPlatformProxy()` regeneration against LOCAL D1) is sound. Required changes before execution:
1. Snapshot live derived tables too (`user_stats` 17, `user_badges`, `ground_visits` 15, `visits`) as the oracle.
2. Step D dual-path: import live derived AND regenerate to scratch, diff; ship regenerated only if it matches all 26 users/all columns, else ship imported (logged decision).
3. Freeze `evaluateBadges` clock (inject "now" = live award context, or import live `user_badges` and use regeneration as diff check only).
4. Assert snapshot counts against VERIFIED numbers (26/343/37/15; refs 60/50/50); re-derive `max(flights.id)` from JSON.
5. Diff ALL 26 users, ALL 5 stat columns, row-by-row — any mismatch blocks.
6. Add row-by-row diffs for `country_claims` (37) + `ground_visits` (15) post-transform; resolve raw-vs-regenerated `ground_visits`.
7. Validate seed layer: diff `aircraft_reference`/`airports_reference` vs `packages/data`; confirm E135 dedup dropped the intended row + no flight references the dropped key; diff badges/code-words vs live snapshot.
8. FK closure asserts (no orphans).
9. Timestamp invariants: assert every offset == `+00`; pin `id` as provable tiebreak; confirm no transform needs sub-ms precision.
10. Assert `RESET_REQUIRED` fails `verifyPassword` structurally.
11. Step 0 clean reset + assert empty counts before C; truncate `visits`/`user_badges` before D.
12. Smoke-test runtime imports under `tsx`/Node before D.

### The One Thing to Do First
Before writing any migration code, extend the Step A snapshot to dump the live derived tables (`user_stats` 17, `user_badges`, `ground_visits` 15, `visits`) — then prove whether replay can reconstruct them. Snapshot the oracle, or you are validating a copy against itself.
