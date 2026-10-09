# 19 Mutation safety review fixes

Status: done
Type: task
Owner: Sol 6.1, orchestrator integration
Spec: Inline edits and Undo; protected aircraft filling; deferred deletion

## What

Independent checkpoint review found stale-client Undo and aircraft filling could overwrite newer values. Enforce preconditions on the server. Undo must restore transit decisions and confirmation provenance as well as the edited value. Reconcile uncertain DELETE outcomes before showing cached rows as restored, and pass the abort signal as transport options.

## Done

- API regressions reject stale Undo and protect an aircraft filled in another tab.
- Undo preserves affected lifecycle, provenance and transit metadata.
- Delete transport aborts; lost responses and refresh failure keep honest feedback.
- Focused checks, full API and client suites, typecheck, lint and final build pass.

## Verification

Server regressions run against local D1: stale Undo returns STATE_CONFLICT, missing-only aircraft assignment preserves a concurrent value, and route/date Undo restores full transit/confirmation/metrics state. Lost DELETE responses, 404 reconciliation, aborted transport, failed/offline/cancelled reconciliation and owner resets have client regressions. Undo accepts the authoritative prior server value when the original cache was stale.

Independent Sol 6.1 high reviews: rounds 1 and 2 identified these failures; round 3 closed the remaining two findings by source review. Final checks: 631 API tests and 898 client tests passed; typecheck, API typecheck, lint, build, worker typecheck and composed Worker smoke passed. Browser acceptance is recorded in ticket 18.
