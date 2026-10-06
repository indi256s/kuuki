# Kuuki

Personal flight journal on Cloudflare.

Use `gh-axi` for GitHub and `chrome-devtools-axi` for browser automation. Downscale screenshots before reading them: `sips -Z 1200 <file>.png`.

## Where things live

- `apps/next` is the current app: Next App Router, built with OpenNext, running on Workers.
- `apps/web` is the legacy Vite rollback surface.
- API handlers are in `functions/api`. `apps/next/worker.ts` dispatches them through direct handlers and the compiled Pages Worker.

## Read first

- **UI work:** read `DESIGN.md`.
- **Domain work:** read `GLOSSARY.md`, then only the sections of `docs/adr/` that your task touches.
- **Writing or reviewing code:** read `CODING_STANDARDS.md`.
- **Plans, specs or handoffs:** read `docs/agents/issue-tracker.md`.
- **Deploying:** CI only verifies; deploys are manual through the `deploy-kuuki` skill.
- **Runtime or release work:** read `docs/runbooks/2026-10-04-next-release-candidate.md`; for D1 migration/cutover gates, read `docs/runbooks/audit-remediation-release.md`.

## Guardrails

Run commands from the workspace root containing `pnpm-workspace.yaml`. Legacy Vite/Supabase descriptions are historical context. Local preflight is read-only and does not authorize remote D1 writes; those require the runbook's explicit target, writer hold, backup/restore proof, schema admission and separate authorization.
