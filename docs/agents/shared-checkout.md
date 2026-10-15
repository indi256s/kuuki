# Shared-checkout Git

Kuuki's root checkout normally stays on local `main` while several agent threads
edit it. Continue in the assigned checkout. Existing staged, unstaged and
untracked work belongs to its owner; changes appearing after your start do too.
Choose a worktree when the task needs isolation, keeping its branch separate
until local landing is authorized.

Editing may run in parallel. One orchestrator owns final Git operations for its
workers in a shared checkout; independent threads coordinate finalization through
the tool below. Workers return owned paths, their patch and check evidence. A
request to commit means a local commit of that task. Push, PR publication,
deployment and remote data writes retain their separate authorization boundaries.

## Prepare an owned candidate

1. Record the assigned checkout/branch, `HEAD`, and both staged and unstaged
   changes in relevant paths. Agree file or hunk ownership before editing shared
   files. Use explicit owned paths when formatting; keep foreign files intact.
2. Save a binary-capable Git patch outside the repository, relative to the current
   `HEAD`. `git diff --binary HEAD -- <paths>` is a starting point: it includes
   every owner's edits in those files and omits untracked files. Retain only your
   authorized hunks and include owned new files. An isolated private index may
   construct the patch; the shared index is not a scratch staging area.
3. Prepare it from the destination checkout:

   ```sh
   node scripts/agent-git.mjs prepare --patch /tmp/task.patch --base <current-sha>
   ```

   The result identifies an external manifest and a detached candidate checkout.
   Inspect its complete candidate diff; filenames alone do not prove ownership.
   Preparation rejects a stale base and leaves the destination index/files alone.

4. Install dependencies in that candidate when its checks need them. Kuuki uses
   `pnpm install --frozen-lockfile` in the candidate checkout. Use the checks
   required by `CODING_STANDARDS.md`, carrying the owner's explicit waivers.
   Keep browser/runtime ports distinct between checkouts. Share package-manager
   caches, not source-dependent `node_modules` links to a dirty checkout.

The agent decides ownership. The tool validates the prepared patch/tree, not who
wrote each line. Whole-file `git commit --only` also includes foreign unstaged
hunks in that file; ordinary `git commit` includes all existing staging. Neither
is a substitute for reviewing this candidate.

For an owned new file plus reviewed hunks from an existing file, construct the
patch through a disposable index. `owned-hunks.patch` must already contain only
your selected changes against HEAD; `owned-new-file` is exclusively owned:

```sh
candidate_index_dir=$(mktemp -d)
candidate_index="$candidate_index_dir/index"
GIT_INDEX_FILE="$candidate_index" git read-tree HEAD
GIT_INDEX_FILE="$candidate_index" git add -- owned-new-file
GIT_INDEX_FILE="$candidate_index" git apply --cached /tmp/owned-hunks.patch
GIT_INDEX_FILE="$candidate_index" git diff --cached --binary HEAD > /tmp/task.patch
```

Inspect `/tmp/task.patch`, then use `prepare`. This index never replaces the
shared index. Keep its directory until the patch is accepted or discarded.

## Commit locally

From the destination checkout, use the manifest returned by preparation:

```sh
node scripts/agent-git.mjs commit --snapshot /tmp/<snapshot>/manifest.json \
  --message 'Describe the task result' --check 'node --test scripts/example.test.mjs'
```

Choose a real task-specific check command; omit `--check` only when the existing
commit hook covers the change and no additional check is required. The command
runs in the candidate, and the normal commit hook runs there too. It checks the
actual candidate, including formatting of its staged content, instead of another
agent's unfinished live files. Hooks or checks changing tracked candidate content
invalidate it; prepare the corrected patch again instead of accepting a different
tree silently.

Finalization verifies that the destination still has the recorded branch/base and
that the candidate change remains present in its live files. It reconciles the
candidate with the current index through a three-way merge, preserving foreign
staging relative to the new HEAD. Conflicting or replaced hunks, or a foreign
staged rename redirecting an owned edit to another path, cause refusal.
Only affected index entries change; destination working files stay untouched.
Report the committed SHA and the actual checks, including material omissions.

The shared finalization lock coordinates tool callers. Commit publication also
holds Git's destination index lock. These locks do not freeze editors, independent
plumbing or agents bypassing this procedure. Coordinate overlapping edits through
completion; stale `HEAD` or candidate content means re-prepare against current
work, never reset another thread back to your earlier snapshot.

## Land a worktree

Commit and verify the feature in its owning worktree. Merge the latest local
`main` there first, preserving both tasks, and verify affected behavior after
resolving conflicts. Then, from the destination checkout:

```sh
node scripts/agent-git.mjs prepare --target <verified-feature-sha>
node scripts/agent-git.mjs land --snapshot /tmp/<snapshot>/manifest.json \
  --check '<checks for the combined target>'
```

The target must descend from the recorded destination HEAD. Checks run against
that target in the detached checkout. Reuse valid prior evidence where possible;
the landing check must still establish the target's required gates.

Before landing, coordinate a pause on incoming paths with their active owners;
unrelated editing can continue. The tool refuses intersections with destination
staged, unstaged, untracked or ignored files, including rename sources/deletions
and file/directory collisions. Under its cooperative lock it performs ordinary
fast-forward merge in the destination, letting Git manage its own index lock.
No branch switch, automatic stash or CAS-only movement of a checked-out branch is
part of landing. Preserve the destination's unrelated staging and file contents.

When incoming paths overlap, keep the target ready and coordinate integration
with the affected owners. Retain separate copies of their staged tree, working
files and untracked inputs. Resolve each layer against the old/new base in a
temporary checkout, review the resulting staged and unstaged deltas, then apply
the agreed integration while those paths remain paused. Resume writers only
after HEAD, index and files are coherent. This manual conflict path is not
automated by the tool; a shared-file collision does not authorize overwriting it.

## Recovery and cleanup

Custom commit publication of a branch ref and index is not one atomic Git
transaction. The tool retains recovery evidence before publication and blocks
further finalization while an unfinished commit publication exists. Ordinary
fast-forward landing uses Git's own failure/locking behavior; it does not create
the tool's custom recovery journal. Follow the emitted recovery command/path.
Run `node scripts/agent-git.mjs recover --snapshot <manifest>` from the destination.
Recovery compares recorded old/new refs, index contents and candidate-path state;
an intervening change requires inspection rather than blind restoration.
This recovery covers process interruption; it does not promise power-loss
durability. Checks and hooks are trusted local commands, not a security sandbox.

Keep the failed snapshot and logs until the cause is understood. Treat an existing
lock as owned work: verify its process and recovery state before removing one.
Never delete an unknown `index.lock`, infer staging ownership from an old blob
matching Git history, or restore a whole saved index over newer staging.

Use `node scripts/agent-git.mjs cleanup --snapshot <manifest>` only for completed
disposable snapshots.
Cleanup removes their untracked setup/check artifacts too; retain any evidence
needed by the task before requesting it.
Before removing any feature worktree, preserve its unique untracked inputs and
handoff evidence. Record snapshot/candidate identity, check waivers and any pending
landing or recovery in the task handoff.
