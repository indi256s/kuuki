# The pending-delete notice is Journal-local, not the global toast

Status: resolved
Owner task: T13
Source: T13 fix round 1 concern; `apps/next/src/client/reads/delete-undo.tsx`, member shell

## What differs
The Undo notice is a fixed, always-mounted polite area inside Journal because `ToastProvider` is not mounted in the member shell. Leaving the Journal during the six seconds unmounts the host, so nothing is sent (the delete is dropped, by design) but also nothing tells the user.

## Decision needed
Mount `ToastProvider` in the member shell and move the notice there so it survives navigation, together with a rule for what happens to a scheduled delete when the user navigates away (commit, or cancel and say so).

## Acceptance check
A navigation test that starts a delete, leaves the Journal, and asserts the chosen outcome plus a visible, announced message.

## Continuation disposition — 2026-10-05

The current six-second delete is cancelled on Journal unmount, preserving data; its polite notice is route-local. A global cancellation message/host remains a separate interaction decision, not implemented or claimed accepted.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.

## Resolution — 2026-10-06

Controller ruling applied: leaving the Journal inside the six-second window still cancels the delete (nothing is sent), and the member shell now says so.

- `ShellNotices` (`apps/next/src/client/shell-notices.tsx`) mounts one owner-scoped `ToastProvider` inside `MemberShell` (keyed by owner via `AwaitingProvider`), so notices survive client navigation between member routes. A notice sent from an unmount cleanup is delivered after the commit, so it also reaches the shell that replaces another layout (`/journal` to `/leaderboard`); only a shell of the same owner shows it.
- `ToastSlot` (`apps/next/src/client/ui/toast.tsx`) places a caller-owned notice in the toast region. The Journal's Undo notice renders there; Undo, timing, focus and restored-selection behaviour are unchanged. Its status line now carries an explicit `aria-live="polite"`, so it stays exposed while a Radix modal closes (issue 03).
- `useDeferredDelete` reports a delete dropped by unmount inside the window; the Journal announces EN "Delete cancelled — you left the Journal. Nothing was removed." / RU «Удаление отменено — вы ушли из журнала. Ничего не удалено.» as a polite info toast. After `kuuki:identity-reset` (sign-out, owner switch) it stays silent; full document loads drop the delete as before.
- Commit: 7a2bb2e. Tests: unit (`toast.test.tsx`, `shell-notices.test.tsx`, `deferred-delete.test.tsx`, `journal.test.tsx`), navigation `read-journeys.test.ts` › "leaving the Journal during Undo cancels the delete, and the shell says so". `account.test.ts` now scopes its "Saved." status to `main` because the shell's live region is always mounted.
