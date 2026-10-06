# Kuuki

Personal flight journal on Cloudflare.

Use `gh-axi` for GitHub and `chrome-devtools-axi` for browser automation. Downscale screenshots before reading them: `sips -Z 1200 <file>.png`.

## Where things live

- `apps/next` is the current app: Next App Router, built with OpenNext, running on Workers.
- `apps/web` is the Vite app, kept as the legacy rollback surface. Change it only to keep rollback working.
- API handlers are in `functions/api`. `apps/next/worker.ts` dispatches them through direct handlers and the compiled Pages Worker.

## Read first

- **UI work:** read `DESIGN.md`. Tokens live only in `apps/next/src/app/styles.css`.
- **Domain work:** read `GLOSSARY.md`, then only the sections of `docs/adr/` that your task touches.
- **Changing code:** pick checks from `docs/agents/checks.md` before reporting done.
- **Plans, specs or handoffs:** read `docs/agents/issue-tracker.md`.
- **Reviewing a diff:** apply `CODING_STANDARDS.md`.
- **Deploying:** CI only verifies; deploys are manual through the `deploy-kuuki` skill.
- **Runtime or release work:** read `docs/runbooks/2026-10-04-next-release-candidate.md`; for D1 migration/cutover gates, read `docs/runbooks/audit-remediation-release.md`.

## Sources of truth

Run commands from the workspace root containing `pnpm-workspace.yaml`. Legacy Vite/Supabase descriptions are historical context. Report conflicts with the intended ADR/runbook contract; configuration alone does not establish deployment or release acceptance. Local preflight is read-only and does not authorize remote D1 writes; those require the runbook's explicit target, writer hold, backup/restore proof, schema admission and separate authorization.
