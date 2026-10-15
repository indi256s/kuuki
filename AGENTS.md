# Kuuki

Personal flight journal on Cloudflare.

The root checkout's local `main` is normally shared by several agent threads.
Continue in the assigned checkout; dirty files and staging are expected. Before
committing, landing a worktree or repairing staging, read
[shared-checkout Git](docs/agents/shared-checkout.md).

Use `gh-axi` for GitHub. Browser work follows the global `agent-browser` policy. When screenshots are needed, downscale before reading: `sips -Z 1200 <file>.png`.

Resolve named skills from the catalog's advertised path. Before reporting one unavailable, search for its exact `SKILL.md` in the configured skill roots; resolve supporting files relative to that skill.

## Where things live

- `apps/next` is the current app: Next App Router, built with OpenNext, running on Workers.
- `apps/next/activation` owns the activation page; `apps/next/transition` owns the old service-worker retirement responses.
- API handlers are in `functions/api`. `apps/next/worker.ts` dispatches them through direct handlers and the compiled Pages Worker.
- The root `wrangler.toml` supplies Pages Functions compiler/D1 settings; its local asset path is `apps/next/.open-next/assets`. It does not deploy a Pages frontend.

## Read first

- **Feature changes:** use the behavioral entry points in `docs/README.md` to locate the owning code and tests.
- **UI work:** read `DESIGN.md`.
- **Domain work:** read `GLOSSARY.md`, then only the sections of `docs/adr/` that your task touches.
- **Writing or reviewing code:** read `CODING_STANDARDS.md`.
- **Plans, specs or handoffs:** read `docs/agents/issue-tracker.md`.
- **Deploying:** Cloudflare Workers Builds runs `pnpm verify:cloudflare` and uploads only preview candidates; production deploys are manual through the `deploy-kuuki` skill. GitHub Actions is a manual verification fallback.
- **Runtime or release work:** read `docs/skills/deploy-kuuki/SKILL.md`; for D1 migration/cutover gates, read `docs/runbooks/audit-remediation-release.md`. The 4 October Next candidate runbook is historical evidence.

## Guardrails

Run commands from the workspace root containing `pnpm-workspace.yaml`. Legacy Vite/Supabase descriptions are historical context. Local preflight is read-only and does not authorize remote D1 writes; those require the runbook's explicit target, writer hold, backup/restore proof, schema admission and separate authorization.
