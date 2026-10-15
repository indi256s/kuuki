# Shared-checkout Git handoff

Status: implemented and locally verified, uncommitted. Owning checkout:
`/Users/indi256/Documents/kuuki/kuuki`, local `main` at `5385108a`.
No branch/index publication, push, deployment or application changes were made.

## Delivered

- `scripts/agent-git.mjs`: prepare owned patch/target snapshots; check and commit
  through the candidate's hooks; reconcile foreign staging under locks; ordinary
  fast-forward landing; guarded process-interruption recovery and cleanup.
- `scripts/agent-git.test.mjs`: 18 public CLI cases in disposable repositories.
  Wired into `scripts/verify-cloudflare.sh`.
- `docs/agents/shared-checkout.md`: canonical workflow and refusal/recovery rules.
  Navigation and verification guidance updated in project agent documentation.
- Local provider files `~/.codex/AGENTS.md` and `~/.claude/CLAUDE.md`: identical
  shared-checkout contract, retaining previous rules and animation guidance.
- Claude's `landing-main-cas.md` memory now points to the canonical workflow;
  its `MEMORY.md` pointer no longer prescribes CAS-only landing.

## Evidence

`node --test scripts/agent-git.test.mjs scripts/verify-cloudflare.test.mjs` passed
19/19. Independent review also ran the CLI suite, passing 18/18. All four
reproduced findings were fixed with regressions demonstrated red before repair:
foreign staged rename redirection, hint-flag-hidden candidate drift, interrupted
recovery's stale lock ownership, and configured hooks missing from the candidate.
No unresolved review blockers remain.

Targeted Oxlint, Oxfmt, shell syntax and whitespace checks passed. Source-only
tooling required no application build or browser checks.

Final preservation comparison confirmed unchanged root HEAD, original staged
mode/blob/stage entries, existing foreign file contents and pre-existing
`docs/README.md` edits. This establishes staging/content preservation, not byte
identity of Git's refreshable index metadata.

## Local inputs and limitations

Backups, baseline/preservation evidence and final validation log live in
`/tmp/kuuki-agent-git-setup/`. Independent review log:
`/tmp/agent-git-final-review-tests-v2.log`. These are checkout-local evidence,
not required runtime inputs; the tracked CLI and tests reproduce the behavior.

Locks coordinate cooperating tool callers; editors and independent plumbing are
not frozen. Overlapping landing paths require an agreed pause and integration.
Recovery covers process interruption rather than power loss. Hooks/checks are
trusted local code. Global provider edits are local configuration, outside Git.
