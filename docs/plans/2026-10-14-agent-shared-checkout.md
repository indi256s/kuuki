# Shared-checkout Git finalization

Implement the owner's approved retrospective recommendations: parallel editing
in the existing checkout, local task-scoped commits, verified preservation of
foreign staging, and coherent worktree landing. No current application edits,
root index entries, branch refs, push or deployment belong to this implementation.

The canonical workflow will be `docs/agents/shared-checkout.md`. Both provider
instruction files point to project workflow; Kuuki owns the preference for local
`main`. Supersede the provider-local CAS landing recipe instead of duplicating it.

### Task 1: Scoped Git CLI and preservation tests

- [x] Add `scripts/agent-git.mjs` and `scripts/agent-git.test.mjs`, using Node built-ins
      and installed Git. Tests invoke the public CLI in disposable repositories.
- `prepare --patch <file> [--base <sha>]`: resolve repository/branch, retain the
  patch, base and candidate tree in an external manifest; create a detached
  candidate worktree. Apply the exact patch to its index and files. Return compact
  JSON with manifest and checkout paths. Neither root files nor root index change.
- `prepare --target <sha>`: require a descendant of current HEAD; create a detached
  verification checkout of the target and record the expected root branch/base.
- `commit --snapshot <manifest> --message <text> [--check <shell-command>]`: run
  requested checks and the existing commit hook in the candidate checkout. Require
  its tracked files, index and resulting commit tree to match the prepared tree.
  Finalize against the same root branch/base under a common cooperative lock and
  the root index lock. Combine candidate changes with current foreign staging by
  a three-way tree merge; update only affected index entries. Require the committed
  delta already to be present in the live root files; leave those bytes untouched.
  Reject stale HEAD, conflicts, active locks and unresolved indexes before moving
  the root ref. Preserve foreign staged and unstaged hunks in the same file.
- Persist recovery evidence before publishing the ref and index. If publication
  fails midway, retain both index versions and expected refs, report the exact
  recovery path, and prevent subsequent finalization from silently continuing.
  Recovery must compare recorded state rather than overwrite intervening work.
- `land --snapshot <manifest> --check <shell-command>`: verify target in the detached
  checkout; under the common lock require the expected branch/base, fast-forward
  ancestry and no incoming-path overlap with staged, unstaged or untracked work
  (including directory-prefix collisions). Use ordinary `git merge --ff-only` in
  the destination; reject overlap for coordinated manual integration.
- Keep snapshots/logs for inspection on failure. A cleanup command may remove only
  tool-owned temporary worktrees. Locks coordinate cooperating callers; direct
  plumbing and independent editors are outside that guarantee.
- Cover distinct failures: mixed staging/unstaged hunks, invalid candidate hidden
  by valid live files, hook failure, HEAD movement during checks, changed live
  candidate content, busy locks, clean fast-forward preservation, overlap refusal,
  and interruption/recovery where supported. Use real Git state assertions, not
  source-string assertions or production test-only switches.

### Task 2: Canonical workflow and provider instructions

- [x] Add the workflow with exact CLI usage, patch ownership, preservation criteria,
      isolated setup/checks, overlap integration, lock limitations and recovery.
- [x] Add a short pointer in `AGENTS.md`, reconcile `CODING_STANDARDS.md` hook and
      shared-output guidance, add navigation in `docs/README.md`, and connect handoffs
      in `docs/agents/issue-tracker.md`.
- [x] Add the same concise shared-checkout behavior to `~/.codex/AGENTS.md` and
      `~/.claude/CLAUDE.md`; retain all other rules. Replace `landing-main-cas.md` with
      a supersession pointer and reconcile its `MEMORY.md` entry. Retain backups.
- [x] Wire CLI integration tests into existing `verify:cloudflare` script checks.

### Task 3: Independent review and final evidence

- [x] Review every owned diff and run CLI integration tests, existing verification
      script test, targeted formatting and whitespace checks. No application/browser
      checks are required for this tooling-only change.
- [x] Obtain independent correctness/security review of Git publication, candidate
      admission, recovery and instruction consistency. Resolve actionable findings.
- [x] Confirm foreign root staging/files remain untouched by this work. Record
      exact validation and limitations in the adjacent handoff; leave changes local.
