# H3: no bulk-aircraft outcome contract; T14 uses the existing aircraft-batch outcomes

Status: ready-for-human
Owner task: T15 / architecture
Source: progress.md:176; docs/plans/2026-10-04-redesign-2.0-implementation.md:141, :470; task-T14-brief.md:12; verified at af92d26

## What is wrong
The plan has T14 consume "H3's bounded bulk-aircraft outcome contract" with saved, failed and uncertain rows shown individually. H3 did not deliver it (plan line 739 marks H3 "Partial"). The only contract is `functions/api/flights/aircraft-batch.ts:10-12`: per item `accepted` or `error`, up to 20 items, one atomic D1 batch. There is no `uncertain` outcome (a timed-out or dropped response leaves the client not knowing which rows were written), and the client type `BatchResult` in `apps/next/src/client/capture/passport-manage.tsx:18` repeats the two-state shape. T14 builds its aircraft review on that, so it will be reworked when the contract lands.

## Open question (why triage)
Who owns the contract (architecture session or T15 shared-contracts review), and whether `uncertain` means a client-side reconcile read or a server idempotency key.

## Acceptance check
Once decided: a contract test on `aircraft-batch` for the new outcome (for example a replayed request with the same operation id returns the original per-item results), and a T14 UI test that renders saved, failed and uncertain rows separately. Neither exists today.

## Continuation disposition — 2026-10-05

The architecture-owned server bulk-aircraft outcome/idempotency contract is still required. Accepted UI repairs preserve failed/uncertain outcomes and reconcile canonical reads within the bounded existing endpoint; they do not establish a new server contract.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.
