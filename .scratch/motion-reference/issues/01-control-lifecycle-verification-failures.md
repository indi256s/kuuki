# Shared control lifecycle checks remain failing

Status: verified in current tree (2026-10-12 modern-web remediation)

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


## Verification follow-up

The modern-web remediation repaired the three unit fixtures without changing production controls: Dialog now exposes live animation styles, Popover uses a stable focus ref, and Sheet sends the complete outside click. The full Next suite passes all 1,335 tests. The compiled navigation suite passes all 44 cases, including capture Escape restoring focus to Delete flight. Its earlier browser failure is no longer reproducible in the current dirty tree; no historical root cause is claimed.

Evidence: [modern-web follow-up](../../../docs/research/2026-10-12-modern-web-guidance-audit.md#remediation-follow-up--12-october-2026), `/tmp/kuuki-modern-web-fixes-tests.log` and `/tmp/kuuki-modern-web-fixes-navigation.log`. Earlier observations above remain historical evidence.
