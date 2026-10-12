# Ingest evaluation handoff

Updated: 2026-10-12. This handoff records the 11 October evaluation and release notes; hosted state has not been rechecked as part of the navigation repair.

## Recorded outcome and next action

The local evaluation notes record adoption of the existing Flash-Lite extractor plus full Clef source checking at candidate `15528c0daa59c4cfe5a06cfcb0e0d3c2c06137b4`. Failed, disagreed or unsupported checks leave drafts unchecked for member review. The adopted source contract is [ADR 0001, Source verification](../adr/0001-flight-lifecycle-and-import-drafts.md#source-verification-owner-11-october-2026).

Corpus labels remain provisional. The recorded next action is the owner's label spot-check; C01–C03 remain uncertain. Keep the frozen primary run distinct from any rescoring. This handoff supplies resume context, not authorization for provider calls, release changes or deployment.

## Source entry points

- [Evaluator](../../scripts/evaluate-import.ts): uses production extraction and normalization, draft projection and the structured-text parser. Its `--corpus` mode reads the private corpus below. Inspect the current CLI and configuration before rerunning it.
- [Source checker](../../functions/api/import/_verify.ts) and [draft conversion](../../functions/api/_services/importConversion.ts): server verification and save authorities.
- [Verification regressions](../../functions/test/import-verification.test.ts) and [question regressions](../../apps/next/src/client/import/questions.test.ts): checked-in behavior evidence.
- [Release procedure](../skills/deploy-kuuki/SKILL.md): current release and rollback authority. Historical release notes do not establish today's deployed versions.

## Resume input inventory

The source checkout for the local records is `/Users/indi256/Documents/kuuki/kuuki`. Locate it with `git worktree list`; local inputs are not supplied by checking out the release candidate.

| Input                                                          | Availability                               | Use                                                                                                                                 |
| -------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| ADR, evaluator, runtime and tests linked above                 | Repository source                          | Implement or inspect the adopted behavior without private benchmark inputs.                                                         |
| `.scratch/ingest-models-and-performance/spec.md`               | Checkout-local, outside the release commit | Evaluation decisions and subsequent adoption notes.                                                                                 |
| `.scratch/ingest-models-and-performance/audit-2026-10-11.md`   | Checkout-local, outside the release commit | Historical findings and their recorded repairs.                                                                                     |
| `.scratch/ingest-models-and-performance/release-2026-10-11.md` | Checkout-local, outside the release commit | Historical candidate, version and gate records.                                                                                     |
| `.scratch/ingest-models-and-performance/corpus/`               | Private and Git-ignored                    | Frozen inputs, labels, `label-review.md` and `results/live-2026-10-11/report.md`; required for benchmark reproduction or rescoring. |
| `~/.local/state/kuuki/releases/2026-10-11-verified-ingest/`    | Private, machine-local                     | Raw operational evidence for the recorded release; required to audit hosted gate claims.                                            |

For work requiring the local records, copy the three named Markdown files from that source checkout to the same repository-relative paths in the destination. Compare existing destination files before copying and preserve differing versions. For authorized benchmark reproduction, transfer the private corpus separately to the same relative directory; preserve its frozen labels and results and keep its contents out of Git and tool output. Raw release evidence requires separate retrieval from the recorded machine-local directory.

Check each required input in the destination before starting. If the source checkout or private evidence is unavailable, report that specific missing input; the durable source pointers and outcome above remain usable for code work, but cannot reproduce or establish the benchmark or hosted release gates. Follow the [handoff input conventions](../agents/issue-tracker.md#inputs-needed-to-resume) when saving new evidence.
