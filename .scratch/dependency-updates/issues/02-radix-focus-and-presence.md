# Admit newer Radix dialog and popover after regression checks pass

Status: open

Both dialog/popover 1.2.0 and their newest 1.1 releases (1.1.23) fail existing tests for dialog closing-animation retention and outside-click popover focus. The same tests pass at 1.1.15 under upgraded React 19.3.0, Vitest 5.0.3 and jsdom 30.1.2.

Retain dialog/popover 1.1.15. Investigate changed presence/focus behavior before upgrading; preserve intended animation and outside-focus behavior rather than weakening assertions.

Check: `pnpm --filter @kuuki/next exec vitest run src/client/ui/dialog.test.tsx src/client/ui/popover.test.tsx`.
