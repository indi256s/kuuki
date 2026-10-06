# Toast live region may be aria-hidden while a Radix modal is open

Status: resolved
Owner task: T13/T15
Source: progress.md:81 (T03 deferred minor), :172 (carried into T13); unverified

## What is wrong (suspected)
`apps/next/src/client/ui/toast.tsx:55-62` renders both live regions inline in the provider tree, not in a portal. Radix modals hide everything outside their portal with `aria-hidden`, so a toast fired from a Dialog or Sheet may not be announced. Not reproduced: no test opens a modal with a toast, and `ToastProvider` is mounted only in `app/dev/gallery/gallery.tsx`, not in the layout, so there is no real caller yet.

## Expected behaviour
A toast shown while a Dialog or Sheet is open is announced (its `status`/`alert` region is not inside an `aria-hidden` subtree).

## Acceptance check
In `toast.test.tsx`, render `ToastProvider` around an open modal `Dialog` that calls `show()`, then `getByRole('status')` / `getByRole('alert')`. Testing Library skips inaccessible nodes, so the query throws if the region is hidden. Triage first: if it passes, close this issue and keep the test.

## Continuation disposition — 2026-10-05

The retained ToastProvider modal-sheet regression queries an exposed status region and verifies no aria-hidden ancestor. The suspected announcement loss is not reproduced. Toast remains a gallery-only primitive; this does not add global Journal Undo.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.
