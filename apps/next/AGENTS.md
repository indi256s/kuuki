<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Feature entry points

Use the [behavioral map](../../docs/README.md#behavioral-ownership) to find owning code and tests before changing a feature. The [DESIGN shell contract](../../DESIGN.md#shell-and-navigation) owns layout and interaction guidance; [nav.tsx](src/client/nav.tsx) and [ADD_ACTIONS](src/client/add-actions.tsx) own the current navigation and capture choices.

For generation or local evidence needed by another checkout, follow the [handoff input conventions](../../docs/agents/issue-tracker.md#inputs-needed-to-resume). Concorde setup and its tracked preview driver live in [scripts/concorde/README.md](../../scripts/concorde/README.md).
