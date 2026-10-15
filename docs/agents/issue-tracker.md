# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Existing `PRD.md` files remain valid legacy inputs; create new specs as `spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file (see `triage-labels.md` for the role strings)
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` (the Notes / Decisions-so-far / Fog body).
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

## Plans and handoffs

Plans live in `docs/plans/`; specs live in `.scratch/<feature>/`.

For shared-checkout work, follow [Git finalization](shared-checkout.md). A handoff
records the candidate SHA or patch/snapshot identity, owned paths, requested check
waivers and any pending landing/recovery. A preserved working file alone does not
prove that its staged meaning survived a branch update.

- Resuming a plan: read its adjacent `*-handoff.md` first and locate the owning checkout with `git worktree list` before creating progress files.
- At a session handoff, update `docs/plans/<plan>-handoff.md` with the owning branch/checkout, scope, accepted progress, latest checks and next action or blocker; include it in the handoff commit. Detailed `.superpowers/sdd/<plan>/progress.md` ledgers stay local. Reconcile the note with current Git and review evidence before acting.

The adjacent handoff owns execution status; plans and specs describe intent and link to it for progress. Distinguish source implementation, local checks, release acceptance and deployment. On landing, record the containing commit and the remaining gate in the handoff, then remove conflicting status claims from the plan/spec.

### Inputs needed to resume

Include an input inventory in the handoff when work needs more than the checked-in source:

- **Committed:** relative path and the commit containing it; verify with `git ls-files --error-unmatch -- <path>` in the destination checkout.
- **Reproducible:** setup or generation instructions and any pinned dependency. Generated previews need their generator and inputs, not a saved HTML file.
- **Checkout-local:** exact source checkout, relative paths, and retrieval steps. Copy only the listed inputs into an isolated destination; keep private corpora and raw operational evidence out of Git and tool output.

Before resuming, verify required inputs in the destination checkout. If a local input is unavailable, report the missing input and its owner; preserve the recorded conclusions instead of substituting a new corpus or inferring acceptance. Commit non-private inputs needed by future checkouts with their handoff, or provide a reproducible source. Local-only evidence must be labeled as such.

Examples: [Concorde generation](../../scripts/concorde/README.md) uses tracked drivers and a pinned external kit; [ingest evaluation](../plans/2026-10-11-ingest-evaluation-handoff.md) separates source contracts from its private, checkout-local corpus.
