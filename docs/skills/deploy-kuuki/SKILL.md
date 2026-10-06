---
name: deploy-kuuki
description: Deploy the Kuuki Next app to Cloudflare Workers (preview, then production), check for pending D1 migrations before a deploy, or roll back a bad release.
---

# Deploy Kuuki

Production is two Workers built from one Next build, both configured in `apps/next/wrangler.toml`:

| Worker | wrangler env | Serves | D1 |
| --- | --- | --- | --- |
| `kuuki-next` | top level | `kuuki.marchstudio.uk/*` route | `kuuki-db` |
| `kuuki-activation` | `activation` | `kuuki-activation.indi256s.workers.dev` | `kuuki-db` |
| `kuuki-next-preview` | `preview` | `kuuki-next-preview.indi256s.workers.dev` | `kuuki-preview` |

CI only verifies; every deploy is this procedure, run by hand. Run commands from the workspace root; `wrangler` below means `pnpm --filter @kuuki/next exec wrangler`, which runs inside `apps/next` and picks up that config.

## Steps

1. **Candidate.** `main` checked out at `origin/main`, `git status --short` empty, and the CI/CD run for that SHA succeeded: `gh-axi run list --workflow ci.yml --commit "$(git rev-parse HEAD)"`. CI skips commits that only touch `*.md`, `docs/` or `.scratch/`; for those, use the run of the last commit that touched code and confirm `git diff --name-only <that-sha> HEAD` lists only such paths.
2. **Migrations.** List the ledger of each target D1, read-only:
   `wrangler d1 execute kuuki-db --remote --json --command "SELECT name FROM d1_migrations ORDER BY id"`
   and the same with `kuuki-preview --env preview`. Compare against `ls db/migrations/*.sql`. Done when every file is listed in both ledgers: nothing to migrate, continue. Any file missing from a ledger: stop and tell the user. Remote migrations follow `docs/runbooks/audit-remediation-release.md` (backup, writer hold, schema admission, explicit authorization), a separate task from this deploy.
3. **Build.** `pnpm turbo run build --filter='./packages/*'`, then `pnpm next:build`. It exits 0 and prints its JSON summary line.
4. **Preview.** `wrangler deploy --strict --env preview --tag "$(git rev-parse --short HEAD)" --message "$(git log -1 --format=%s)"`. Done when `https://kuuki-next-preview.indi256s.workers.dev/` returns 200 with HTML and `/api/auth/get-session` returns 200 with body `null` (that route reads D1, so it proves the binding).
5. **Go-ahead.** Report the SHA, the empty migration diff and the preview result, then wait for the user's explicit yes to deploy production. A yes for an earlier release does not carry over.
6. **Production.** First record the current version of each Worker from `wrangler deployments status --name kuuki-next` and `--name kuuki-activation`: these are the rollback targets. Then deploy with the same `--strict --tag … --message …` flags, top level first, then activation:
   `wrangler deploy --strict --tag … --message …`
   `wrangler deploy --strict --env activation --tag … --message …`
   Record both printed Version IDs.
7. **Verify.** `https://kuuki.marchstudio.uk/` returns 200 with HTML, `/api/auth/get-session` returns 200 with `null`, and `https://kuuki-activation.indi256s.workers.dev/activate` returns 200. Then watch `wrangler tail kuuki-next --status error` for five minutes. Any error or failed check: roll back, then report.

## Rollback

- **Code.** `wrangler rollback <previous-version-id> --name kuuki-next`, and the same for `kuuki-activation`. A rollback restores the Worker version only; D1 data and schema stay as they are.
- **Emergency.** Delete the `kuuki.marchstudio.uk/*` route in Cloudflare. The held Pages build behind that host then serves maintenance and writes stop. The next top-level `wrangler deploy` re-attaches the route, so hold production deploys until Next should serve again.

## Gotchas

- The config is the source of truth for routes and secrets names ([Cloudflare](https://developers.cloudflare.com/workers/wrangler/configuration/#source-of-truth)). `routes` is PUT as the Worker's complete set, so a route added in the dashboard disappears on the next deploy: add it to `wrangler.toml` instead.
- `routes`, `workers_dev` and `preview_urls` inherit into environments; `vars`, `d1_databases` and `secrets` do not ([Cloudflare](https://developers.cloudflare.com/workers/wrangler/environments/)). Each `[env.*]` therefore sets all of them, and `[env.activation]` repeats the production values: change both blocks together.
- `--strict` makes a non-interactive deploy stop when the Worker was last changed in the dashboard, instead of overwriting those changes. If it stops, copy the wanted dashboard change into `wrangler.toml` and deploy again.
- `wrangler d1 migrations list --remote` writes: it runs `CREATE TABLE IF NOT EXISTS d1_migrations` first. Use the `SELECT` in step 2 for a read-only check.
- Secrets live on each Worker, outside the config; `[secrets] required` names them, and a deploy fails when one is missing. Rotating one is `wrangler secret put <NAME> --name <worker>` per Worker, and wrangler asks for confirmation before rolling back across a secret change.
- Rollback covers the 100 most recent versions and never touches D1 ([Cloudflare](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)). For a risky release, `wrangler versions upload` then `wrangler versions deploy <new>@0% <current>@100%` lets you test the new version on the real host with the `Cloudflare-Workers-Version-Overrides: kuuki-next="<id>"` header before shifting traffic ([gradual deployments](https://developers.cloudflare.com/workers/versions-and-deployments/gradual-deployments/)).
- The Pages project `kuuki` holds the frozen rollback build. Next deploys go to Workers only.
- Out of scope until separately decided: the maintenance cron Worker and the import provider (`GEMINI_API_KEY`, import Durable Object).
