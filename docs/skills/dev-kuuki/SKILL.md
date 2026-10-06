---
name: dev-kuuki
description: Launch, check and stop a local Kuuki dev server for browser or HTTP checks of a change. Covers the compiled Next preview and Next hot reload.
---

# Local dev server

Run commands from the workspace root. Each server is a long-lived process: start it in the background, wait for its ready line, check, then stop it. The command list and setup live in `README.md` § Development; this skill adds the agent procedure around them.

## Pick the server

| Check | Server | Ready line / URL |
| --- | --- | --- |
| Anything touching auth, API, D1, cookies or the Worker; the default | `pnpm next:preview` | `Next synthetic fixture ready: http://127.0.0.1:8800` |
| Pure layout or styling on pages that render without the API | `pnpm --filter @kuuki/next dev` | Next's `Local:` URL |

## Steps

1. **Port free.** `lsof -nP -iTCP:<port> -sTCP:LISTEN` returns nothing. A listener on 8800 is usually a forgotten preview or a running Playwright suite: stop your own stale preview; if the owner is unknown, report it rather than killing it, or move with `KUUKI_NEXT_PORT`.
2. **Build current.** For the compiled preview, `pnpm next:build` has run after the last source change and before any runtime fixture is running, since builds and fixtures share `.wrangler/next-build`. A fresh worktree always needs it.
3. **Ready.** Launch in the background and wait until the ready line appears in its output. Exit before the ready line is a failure: report the output and fix the cause before relaunching.
4. **Check.** Drive the URL with `curl` or the browser tool available for the task. Sign in with the fixture accounts the console prints. Data is synthetic: one JFK–BOS flight for `a@example.test` and one ranked leaderboard member.
5. **Stopped.** Send SIGINT to the preview launcher (`smoke-next-runtime.ts`), which discards the fixture, and confirm step 1's `lsof` is empty again before running builds, `pnpm next:smoke*` or `pnpm test:next:navigation`. Playwright starts its own preview on the same port with `reuseExistingServer: false`, so a leftover server fails the suite.

## Gotchas

- The preview denies all outbound requests, so provider-backed flows (Gemini import, mail) return errors there. That is the fixture, not your bug.
- Sign-in allows 20 attempts per 15 minutes per IP, counted in the fixture's D1. Restarting the preview discards the database and resets the count.
- `next dev` rewrites the managed block in `apps/next/AGENTS.md`; handle that diff as the file's own note says.
- A passing preview is local evidence only. It does not touch remote D1 or authorize a deploy.
