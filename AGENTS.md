# Kuuki

Personal flight journal on Cloudflare.

Use `gh-axi` for GitHub and `chrome-devtools-axi` for browser automation. Downscale screenshots before reading them: `sips -Z 1200 <file>.png`.

## Where things live

- `apps/next` is the current app: Next App Router, built with OpenNext, running on Workers.
- `apps/next/activation` owns the activation page; `apps/next/transition` owns the old service-worker retirement responses.
- API handlers are in `functions/api`. `apps/next/worker.ts` dispatches them through direct handlers and the compiled Pages Worker.
- The root `wrangler.toml` supplies Pages Functions compiler/D1 settings; its local asset path is `apps/next/.open-next/assets`. It does not deploy a Pages frontend.

## Read first

- **UI work:** read `DESIGN.md`.
- **Domain work:** read `GLOSSARY.md`, then only the sections of `docs/adr/` that your task touches.
- **Writing or reviewing code:** read `CODING_STANDARDS.md`.
- **Plans, specs or handoffs:** read `docs/agents/issue-tracker.md`.
- **Deploying:** CI only verifies; deploys are manual through the `deploy-kuuki` skill.
- **Runtime or release work:** read `docs/skills/deploy-kuuki/SKILL.md`; for D1 migration/cutover gates, read `docs/runbooks/audit-remediation-release.md`. The 4 October Next candidate runbook is historical evidence.

## Guardrails

Run commands from the workspace root containing `pnpm-workspace.yaml`. Legacy Vite/Supabase descriptions are historical context. Local preflight is read-only and does not authorize remote D1 writes; those require the runbook's explicit target, writer hold, backup/restore proof, schema admission and separate authorization.
