---
name: deploy-kuuki
description: Deploy the Kuuki Next app directly to production Cloudflare Workers, check for pending D1 migrations before a deploy, or roll back a bad release.
---

# Deploy Kuuki

Production is two Workers built from one Next build, both configured in `apps/next/wrangler.toml`:

| Worker             | wrangler env | Serves                                  | D1         |
| ------------------ | ------------ | --------------------------------------- | ---------- |
| `kuuki-next`       | top level    | `kuuki.marchstudio.uk/*` route          | `kuuki-db` |
| `kuuki-activation` | `activation` | `kuuki-activation.indi256s.workers.dev` | `kuuki-db` |

CI only verifies; every deploy is this procedure, run by hand. Run commands from the workspace root; `wrangler` below means `pnpm --filter @kuuki/next exec wrangler`, which runs inside `apps/next` and picks up that config.

A request to deploy Kuuki authorizes production deployment of that release. Proceed directly to production after the candidate, migration and build checks pass; do not deploy preview or ask for a second production confirmation. Remote D1 migrations remain a separate task with their own authorization.

The source tree no longer builds a Vite frontend. The 6 October release handoff records a separate, held Pages deployment at the canonical host behind the Workers route; source cleanup did not remove or refresh that hosted deployment. Check its live maintenance response and route before treating it as an emergency fallback.

## Steps

1. **Candidate.** `main` checked out at `origin/main`, `git status --short` empty, and the CI/CD run for that SHA succeeded: `gh-axi run list --workflow ci.yml --commit "$(git rev-parse HEAD)"`. CI skips commits that only touch `*.md`, `docs/` or `.scratch/`; for those, use the run of the last commit that touched code and confirm `git diff --name-only <that-sha> HEAD` lists only such paths.
2. **Migrations.** Both production Workers use `kuuki-db`. Read its ledger without writing:
   `wrangler d1 execute kuuki-db --remote --json --command "SELECT name FROM d1_migrations ORDER BY id"`
   Compare against `ls db/migrations/*.sql`. Done when every file is listed: nothing to migrate, continue. Any file missing from the ledger: stop and tell the user. Remote migrations follow `docs/runbooks/audit-remediation-release.md` (backup, writer hold, schema admission, explicit authorization), a separate task from this deploy.
   Overview releases require the `0008_flight_metrics.sql` and `0009_schedule_time_provenance.sql` ledger rows and the migration gates in [the runbook](../../runbooks/overview-release-1.md).
3. **Build.** `pnpm turbo run build --filter='./packages/*'`, then `pnpm next:build`. It exits 0 and prints its JSON summary line.
4. **Production.** First record the current version of each Worker from `wrangler deployments status --name kuuki-next` and `--name kuuki-activation`: these are the rollback targets. Deploy the same built candidate, top level first, then activation:
   `wrangler deploy --no-autoconfig --strict --tag "$(git rev-parse --short HEAD)" --message "$(git log -1 --format=%s)"`
   `wrangler deploy --no-autoconfig --strict --env activation --tag "$(git rev-parse --short HEAD)" --message "$(git log -1 --format=%s)"`
   Record both printed Version IDs.
5. **Verify.** `https://kuuki.marchstudio.uk/` returns 200 with HTML, `/api/auth/get-session` returns 200 with `null`, and `https://kuuki-activation.indi256s.workers.dev/activate` returns 200. Any failed check: roll back, then report. Do not tail or watch the Workers after the checks pass.

## Rollback

- **Code.** `wrangler rollback <previous-version-id> --name kuuki-next`, and the same for `kuuki-activation`. A rollback restores the Worker version only; D1 data and schema stay as they are.
- **Emergency.** If the separately hosted Pages fallback has been verified to serve maintenance at the canonical host, deleting the `kuuki.marchstudio.uk/*` Workers route exposes that hold and stops writes. Record the route first; the next top-level `wrangler deploy` re-attaches it. If the Pages fallback has changed or been removed, use the last healthy Worker version and the writer-hold procedure in [audit remediation release](../../runbooks/audit-remediation-release.md) instead of assuming route deletion is safe.

## Gotchas

- `--no-autoconfig` deploys the already-built `worker.ts` from this config. Wrangler 4.147 otherwise delegates to OpenNext, whose shell wrapper splits a deployment message containing spaces. Keep `--strict`; disabling auto-detection does not disable remote configuration checks.
- The config is the source of truth for routes and secrets names ([Cloudflare](https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth)). `routes` is PUT as the Worker's complete set, so a route added in the dashboard disappears on the next deploy: add it to `wrangler.toml` instead.
- `routes`, `workers_dev` and `preview_urls` inherit into environments; `vars`, `d1_databases` and `secrets` do not ([Cloudflare](https://developers.cloudflare.com/workers/wrangler/environments/)). Each `[env.*]` therefore sets all of them, and `[env.activation]` repeats the production values: change both blocks together.
- `--strict` makes a non-interactive deploy stop when the Worker was last changed in the dashboard, instead of overwriting those changes. If it stops, copy the wanted dashboard change into `wrangler.toml` and deploy again.
- `wrangler d1 migrations list --remote` writes: it runs `CREATE TABLE IF NOT EXISTS d1_migrations` first. Use the `SELECT` in step 2 for a read-only check.
- Secrets live on each Worker, outside the config; `[secrets] required` names them, and a deploy fails when one is missing. Rotating one is `wrangler secret put <NAME> --name <worker>` per Worker, and wrangler asks for confirmation before rolling back across a secret change.
- Rollback covers the 100 most recent versions and never touches D1 ([Cloudflare](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)). For a risky release, `wrangler versions upload` then `wrangler versions deploy <new>@0% <current>@100%` lets you test the new version on the real host with the `Cloudflare-Workers-Version-Overrides: kuuki-next="<id>"` header before shifting traffic ([gradual deployments](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/)).
- The Pages project `kuuki` held the frozen fallback at the 6 October cutover. This source tree does not deploy or rebuild that Pages frontend. Next deploys go to Workers only.
- `GEMINI_API_KEY` is required on `kuuki-next` for file recognition and aircraft enrichment. Provision it on that Worker before deployment; a local `.dev.vars` key does not configure hosted Workers. The activation Worker does not serve these APIs and does not need this key.
- Out of scope until separately decided: the maintenance cron Worker and the import Durable Object. Without an `IMPORT_JOBS` binding, the API uses synchronous recognition with its own `GEMINI_API_KEY`.
