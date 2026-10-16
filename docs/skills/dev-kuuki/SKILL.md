---
name: dev-kuuki
description: Launch, check and stop a local Kuuki dev server for browser or HTTP checks of a change. Covers the compiled Next preview and Next hot reload.
---

# Local dev server

Run commands from the workspace root. Each server is a long-lived process owned by the background Bash task that started it: the task is the handle, so stop the server by stopping that task. The command list and setup live in `README.md` § Development; this skill adds the agent procedure around them.

## Pick the server

| Check                                                               | Server                          | Ready line / URL                      |
| ------------------------------------------------------------------- | ------------------------------- | ------------------------------------- |
| Anything touching auth, API, D1, cookies or the Worker; the default | `pnpm next:preview`             | `Next synthetic fixture ready: <url>` |
| Pure layout or styling on pages that render without the API         | `pnpm --filter @kuuki/next dev` | Next's `Local:` URL                   |

## Steps

1. **Build current.** For the compiled preview, `pnpm next:build` has run after the last source change and before any runtime fixture is running, since builds and fixtures share `.wrangler/next-build`. A fresh worktree always needs it.
2. **Ready.** Launch as a background Bash task and read the URL from its ready line. Leave `KUUKI_NEXT_PORT` unset: the preview takes 8800 when free and another free port otherwise, so other checkouts' servers never block you. Exit before the ready line is a failure: report the output and fix the cause before relaunching.
3. **Check.** Use `curl` for HTTP checks. When the requested check needs browser interaction, follow the repository browser policy: load the installed `agent-browser` skill and its core workflow. Sign in with the fixture accounts the console prints. Data is synthetic: `a@example.test` has 27 flights from 2024 to 2026 across eight countries, and there is one ranked leaderboard member. `KUUKI_NEXT_FIXTURE=minimal` restores the single JFK–BOS flight that the Playwright suites assume. For realistic data, sign in as `me@example.test`: a full copy of the owner's production account (flights, ground journeys, badges, import drafts), present whenever the private snapshot `~/.kuuki/fixtures/real-account.json` exists. The console's account line says whether it loaded and the snapshot date. `pnpm fixture:snapshot` refreshes it with read-only SELECTs on production D1 and needs a Wrangler login; credentials, sessions and the Gemini key are never copied. Never commit or paste snapshot contents.
4. **Stopped.** Stop your background task before running builds in this checkout, since builds and fixtures share `.wrangler/next-build`. The preview discards its fixture and exits on any stop signal or when its launcher dies. Playwright suites and `pnpm next:smoke*` pick their own free port, so they run beside any server.

## Gotchas

- The preview denies all outbound requests, so provider-backed flows (Gemini import, mail) return errors there. That is the fixture, not your bug.
- Sign-in allows 20 attempts per 15 minutes per IP, counted in the fixture's D1. Restarting the preview discards the database and resets the count.
- `next dev` rewrites the managed block in `apps/next/AGENTS.md`; handle that diff as the file's own note says.
- A passing preview is local evidence only. It does not touch remote D1 or authorize a deploy.
