# Shared control lifecycle checks remain failing

Status: needs-triage

Observed in the shared `main` checkout during motion-reference verification on 2026-10-12. These failures are outside the pause implementation. The checkout already contains concurrent edits to the shared dialog, sheet and other controls; their cause has not been established, and those edits were preserved.

- `src/client/ui/dialog.test.tsx:90`: the dialog disappears before the expected closing-animation lifecycle completes.
- `src/client/ui/popover.test.tsx:106`: an outside press restores focus to the trigger instead of retaining outside focus.
- `src/client/ui/sheet.test.tsx:145`: the second outside press does not close the sheet after closing its menu.
- `tests/capture.test.ts:79`: Escape from delete confirmation does not restore focus to “Delete flight”; the button later becomes unavailable.

The three unit failures reproduced in an isolated run of those test files, whose imports do not involve the new auth pause path. The full Next unit run had 1119 passes and three failures. The full navigation run on `KUUKI_NEXT_PORT=8894` had 39 passes and the capture failure. The scoped auth/activation/recovery run passed all 22 tests.

Reproduce from the workspace root:

```sh
pnpm --filter @kuuki/next exec vitest run src/client/ui/dialog.test.tsx src/client/ui/popover.test.tsx src/client/ui/sheet.test.tsx
KUUKI_NEXT_PORT=8894 pnpm test:next:navigation
```

Inspect current concurrent control edits before proposing fixes. Do not revert them or infer a cause from the motion-reference audit. Logs from this run are `/tmp/kuuki-motion-unrelated-recheck.log` and `/tmp/kuuki-motion-navigation-port.log`.
