# Revalidation target is not a Window-and-Document intersection

Status: open — waiting for the user's plan-contract correction

Task 12 specifies `attachRevalidation(store, target: Window & Document)`.
The browser window owns focus events and its `.document` owns visibility
events. The prepared implementation uses those correct event owners, but the
declared intersection requires the window itself to have every Document field.

## Verified evidence

The focused store tests passed: 1 file / 10 tests, including actual window
focus and document visibility events, shared throttling and listener removal.
Calling the public helper with the actual browser window fails the Next
typecheck:

```text
src/client/overview/data-store.test.ts(81,44): error TS2345: Argument of type 'Window & typeof globalThis' is not assignable to parameter of type 'Window & Document'.
  Type 'Window & typeof globalThis' is missing the following properties from type 'Document': alinkColor, all, anchors, applets, and 153 more.
```

Command: `pnpm --filter @kuuki/next typecheck`.
Log: `/tmp/kuuki-overview-execution/r2-t12-next-types.log`.
API/client typechecks pass. Full API passes: 69 files / 768 tests.

## Decision needed

Recommended: change the plan and helper's target parameter to `Window`, using
`target.document` for visibility events. This accepts real browser windows and
the originally declared narrower intersection without a forced cast. Runtime
behavior stays the same; no component or styling change is needed.

Keep the actual-window test call as the compile-time contract check. Do not
mask the mismatch with an `unknown` or `never` cast.

Task 12 source/tests remain uncommitted and its plan boxes unchecked. The user
requires stopping when a plan step is wrong, so the signature/plan correction
is held pending approval. Task 13 implementation has not begun; package catalog
and documentation lookups were read-only. No UI, remote or GitHub actions.
