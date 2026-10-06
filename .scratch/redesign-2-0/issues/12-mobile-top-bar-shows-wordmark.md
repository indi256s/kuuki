# Mobile header shows the wordmark; brief wants a 48px top bar with page title

Status: resolved
Owner task: T18
Source: design-md-code-vs-brief.md item 2; brief docs/plans/2026-10-04-redesign-2.0-ux-ui.md:226; verified at af92d26

## What is wrong
`apps/next/src/client/shell.tsx:24-34` renders `<Wordmark />` and the queue slot in the header at every width. At 700px and below `app/shell.css:37-38` hides only the desktop nav and `.header-desktop-only`, so mobile shows the wordmark, not the page title. The brief (Mobile, "Top bar (48px)") specifies the page title plus at most one contextual action.

## Expected behaviour
At 700px and below the member header is a 48px bar with the current page title and at most one contextual action. Desktop is unchanged.

## Acceptance check
A shell test at a mobile viewport (`pnpm test:next:navigation`, behavioural, no screenshots) that navigates to Journal and expects a heading or banner text "Journal" in the header and no wordmark link. Red now. If the brief is wrong rather than the code, close this and fix the brief instead.

## Continuation disposition — 2026-10-05

39b4dc8 uses localized route titles in the member mobile header. The route-title component reuses canonical navigation labels; visual sizing proof is deferred.

Current integration and evidence: [redesign handoff](../../../docs/plans/2026-10-04-redesign-2.0-implementation-handoff.md). Visual/atlas and external release proof remain deferred under the explicit session constraints.
