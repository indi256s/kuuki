---
name: deploy-kuuki
description: Release Kuuki to Cloudflare Workers after native CI and D1 ledger checks, or roll back a failed release.
---

# Deploy Kuuki

Production is two Workers built from one Next build, both configured in `apps/next/wrangler.toml`:

| Worker             | wrangler env | Serves                                  | D1         |
| ------------------ | ------------ | --------------------------------------- | ---------- |
| `kuuki-next`       | top level    | `kuuki.marchstudio.uk/*` route          | `kuuki-db` |
| `kuuki-activation` | `activation` | `kuuki-activation.indi256s.workers.dev` | `kuuki-db` |

Cloudflare Workers Builds verifies and uploads preview candidates only to `kuuki-next-preview`; every production deploy is this procedure, run by hand. Native builds skip changes confined to `docs/skills/**`. Run commands from the workspace root; `wrangler` below means `pnpm --filter @kuuki/next exec wrangler`, which runs inside `apps/next` and picks up that config. Import Worker commands explicitly use root `pnpm exec wrangler` instead.

A request to deploy Kuuki authorizes production deployment of that release. Proceed through the release gates below without a second production confirmation. Preview testing is required when the import gate applies. Remote D1 migrations remain a separate task with their own authorization.

The source tree no longer builds a Vite frontend. The 6 October release handoff records a separate, held Pages deployment at the canonical host behind the Workers route; source cleanup did not remove or refresh that hosted deployment. Check its live maintenance response and route before treating it as an emergency fallback.

## Steps

1. **Candidate.** `main` checked out at `origin/main` and `git status --short` empty. Require a successful Cloudflare Workers Build for the exact candidate SHA: `cf builds list --external-script-id 5961020fff90472c9460a1697b10f587 --per-page 50` (the script tag for `kuuki-next-preview`). Require `build_trigger_metadata.commit_hash` to match the candidate, `status: stopped`, `build_outcome: success`, and logs confirming `pnpm --workspace-root verify:cloudflare` completed before preview upload. Record the build UUID and candidate SHA in release notes. If the Worker is recreated, resolve its new script tag before using this command. The native build is the release evidence gate; continue with the migration, import and production checks below.
   Inspect the result with `cf builds get <build-uuid>` and `cf builds logs get <build-uuid>`. If the exact SHA has no build because it changed only skill documentation, start one verification build for the release: resolve the main trigger with `cf builds triggers list --external-script-id 5961020fff90472c9460a1697b10f587`, then `cf builds create <main-trigger-uuid> --body '{"branch":"main","commit_hash":"<full-candidate-sha>"}'`. Require the same successful result before production; do not rerun unchanged failed source.
2. **Migrations.** Both production Workers use `kuuki-db`. Read its ledger without writing:
   `wrangler d1 execute kuuki-db --remote --json --command "SELECT name FROM d1_migrations ORDER BY id"`
   Compare against `ls db/migrations/*.sql`. Done when every file is listed: nothing to migrate, continue. Any file missing from the ledger: stop and tell the user. Remote migrations follow `docs/runbooks/audit-remediation-release.md` (backup, writer hold, schema admission, explicit authorization), a separate task from this deploy.
   Overview releases require the `0008_flight_metrics.sql` and `0009_schedule_time_provenance.sql` ledger rows and the migration gates in [the runbook](../../runbooks/overview-release-1.md).
   The onboarding morph requires `0010_onboarding_state.sql` (adds `profiles.onboarded_at` and marks every existing profile onboarded) before `kuuki-next` ships the `/welcome` card; without it the gate would send every member to onboarding.
3. **Build.** `pnpm turbo run build --filter='./packages/*'`, then `pnpm next:build`. It exits 0 and prints its JSON summary line.
4. **Import Worker.** Confirm the production binding target exists. For the first bound release or changes to import source or its key, complete the following preview and import deployment gate within the authorized scope. `kuuki-next` binds `IMPORT_JOBS` to the `ImportJob` Durable Object in `kuuki-import` (preview: `kuuki-import-preview`), configured in `workers/import/wrangler.toml`. The binding target must exist before `kuuki-next` deploys, so deploy the import Worker before the Next Worker:
   `pnpm exec wrangler deploy --config workers/import/wrangler.toml --env preview` then `wrangler deploy --no-autoconfig --strict --env preview`; verify on preview (submit a model-path reply, close the tab for more than 30 seconds, reopen: the batch finished; then `GEMINI_API_KEY=<preview key> pnpm verify:import:provider --real-provider`); then `pnpm exec wrangler deploy --config workers/import/wrangler.toml --env ''` before the production `kuuki-next`. Each import Worker needs `GEMINI_API_KEY` (`pnpm exec wrangler secret put GEMINI_API_KEY --config workers/import/wrangler.toml [--env preview]`). Record both results in the release notes. Prefer a gradual deployment for the first bound `kuuki-next` (see Gotchas).
5. **Production.** First record the current version of each Worker from `wrangler deployments status --name kuuki-next` and `--name kuuki-activation`: these are the rollback targets. Deploy the same built candidate, top level first, then activation:
   `wrangler deploy --no-autoconfig --strict --tag "$(git rev-parse --short HEAD)" --message "$(git log -1 --format=%s)"`
   `wrangler deploy --no-autoconfig --strict --env activation --tag "$(git rev-parse --short HEAD)" --message "$(git log -1 --format=%s)"`
   Record both printed Version IDs.
6. **Verify.** `https://kuuki.marchstudio.uk/` returns 200 with HTML, `/api/auth/get-session` returns 200 with `null`, and `https://kuuki-activation.indi256s.workers.dev/activate` returns 200. On the first release with `IMPORT_JOBS` (and any release that changes `kuuki-import` or its key), repeat the import gate on production: a model-path reply survives a closed tab for more than 30 seconds, and `GEMINI_API_KEY=<production key> pnpm verify:import:provider --real-provider` passes. Record both in the release notes. Any failed check: roll back, then report. Do not tail or watch the Workers after the checks pass.

## Rollback

- **Code.** `wrangler rollback <previous-version-id> --name kuuki-next`, and the same for `kuuki-activation`. A rollback restores the Worker version only; D1 data and schema stay as they are.
- **Import jobs.** Removing the `IMPORT_JOBS` binding from `apps/next/wrangler.toml` and redeploying `kuuki-next` (or rolling back to a version without it) returns to synchronous recognition with no code change. Leave `kuuki-import` deployed until in-flight batches settle: it writes D1 directly, the unbound events endpoint serves those batches as snapshots, and its 120-second alarm is what ends a stuck one.
- **Emergency.** If the separately hosted Pages fallback has been verified to serve maintenance at the canonical host, deleting the `kuuki.marchstudio.uk/*` Workers route exposes that hold and stops writes. Record the route first; the next top-level `wrangler deploy` re-attaches it. If the Pages fallback has changed or been removed, use the last healthy Worker version and the writer-hold procedure in [audit remediation release](../../runbooks/audit-remediation-release.md) instead of assuming route deletion is safe.

## Gotchas

- `--no-autoconfig` deploys the already-built `worker.ts` from this config. Wrangler 4.147 otherwise delegates to OpenNext, whose shell wrapper splits a deployment message containing spaces. Keep `--strict`; disabling auto-detection does not disable remote configuration checks.
- The config is the source of truth for routes and secrets names ([Cloudflare](https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth)). `routes` is PUT as the Worker's complete set, so a route added in the dashboard disappears on the next deploy: add it to `wrangler.toml` instead.
- `routes`, `workers_dev` and `preview_urls` inherit into environments; `vars`, `d1_databases` and `secrets` do not ([Cloudflare](https://developers.cloudflare.com/workers/wrangler/environments/)). Each `[env.*]` therefore sets all of them, and `[env.activation]` repeats the production values: change both blocks together.
- `--strict` makes a non-interactive deploy stop when the Worker was last changed in the dashboard, instead of overwriting those changes. If it stops, copy the wanted dashboard change into `wrangler.toml` and deploy again.
- `wrangler d1 migrations list --remote` writes: it runs `CREATE TABLE IF NOT EXISTS d1_migrations` first. Use the `SELECT` in step 2 for a read-only check.
- Secrets live on each Worker, outside the config; `[secrets] required` names them, and a deploy fails when one is missing. Rotating one is `wrangler secret put <NAME> --name <worker>` per Worker, and wrangler asks for confirmation before rolling back across a secret change.
- Rollback covers the 100 most recent versions and never touches D1 ([Cloudflare](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)). For a risky release, `wrangler versions upload` then `wrangler versions deploy <new>@0% <current>@100%` lets you test the new version on the real host with the `Cloudflare-Workers-Version-Overrides: kuuki-next="<id>"` header before shifting traffic ([gradual deployments](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/)).
- `GEMINI_API_KEY` is required on `kuuki-next` for file recognition and aircraft enrichment. Provision it on that Worker before deployment; a local `.dev.vars` key does not configure hosted Workers. The activation Worker does not serve these APIs and does not need this key.
- Out of scope until separately decided: the maintenance cron Worker. The import Durable Object is in scope (step 4); `[env.activation]` stays unbound because it serves no import routes. `kuuki-next` keeps its own `GEMINI_API_KEY` for the legacy `parse.ts` endpoint, aircraft enrichment and the unbound fallback.
- `kuuki-next` sets `enable_request_signal` and `request_signal_passthrough` so a closed import event stream unsubscribes. Neither flag needs a newer compatibility date ([Cloudflare](https://developers.cloudflare.com/workers/configuration/compatibility-flags/)); `2026-08-06` stays.
