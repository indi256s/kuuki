# The pending-delete notice is Journal-local, not the global toast

Status: needs-triage
Owner task: T13
Source: T13 fix round 1 concern; `apps/next/src/client/reads/delete-undo.tsx`, member shell

## What differs
The Undo notice is a fixed, always-mounted polite area inside Journal because `ToastProvider` is not mounted in the member shell. Leaving the Journal during the six seconds unmounts the host, so nothing is sent (the delete is dropped, by design) but also nothing tells the user.

## Decision needed
Mount `ToastProvider` in the member shell and move the notice there so it survives navigation, together with a rule for what happens to a scheduled delete when the user navigates away (commit, or cancel and say so).

## Acceptance check
A navigation test that starts a delete, leaves the Journal, and asserts the chosen outcome plus a visible, announced message.
