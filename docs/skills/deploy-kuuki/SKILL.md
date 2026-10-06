---
name: deploy-kuuki
description: Deploy the Kuuki Next app to Cloudflare Workers (preview, then production), check for pending D1 migrations before a deploy, or roll back a bad release.
---

# Deploy Kuuki

Production is two Workers built from one Next build, both configured in `apps/next/wrangler.toml`:

| Worker | wrangler env | Serves | D1 |
| --- | --- | --- | --- |
| `kuuki-next` | top level | `kuuki.marchstudio.uk/*` zone route | `kuuki-db` |
| `kuuki-activation` | `activation` | `kuuki-activation.indi256s.workers.dev` | `kuuki-db` |
| `kuuki-next-preview` | `preview` | `kuuki-next-preview.indi256s.workers.dev` | `kuuki-preview` |

CI only verifies; every deploy is this procedure, run by hand. Run commands from the workspace root; `wrangler` below means `pnpm --filter @kuuki/next exec wrangler`, which runs inside `apps/next` and picks up that config.

## Steps

1. **Candidate.** `main` checked out at `origin/main`, `git status --short` empty, and the CI/CD run for that SHA succeeded: `gh-axi run list --workflow ci.yml --commit "$(git rev-parse HEAD)"`. CI skips commits that only touch `*.md`, `docs/` or `.scratch/`; for those, use the run of the last commit that touched code and confirm `git diff --name-only <that-sha> HEAD` lists only such paths.
2. **Migrations.** List the ledger of each target D1, read-only:
   `wrangler d1 execute kuuki-db --remote --json --command "SELECT name FROM d1_migrations ORDER BY id"`
   and the same with `kuuki-preview --env preview`. Compare against `ls db/migrations/*.sql`. Done when every file is listed in both ledgers: nothing to migrate, continue. Any file missing from a ledger: stop and tell the user. Remote migrations follow `docs/runbooks/audit-remediation-release.md` (backup, writer hold, schema admission, explicit authorization), a separate task from this deploy.
3. **Build.** `pnpm turbo run build --filter='./packages/*'`, then `pnpm next:build`. It exits 0 and prints its JSON summary line.
4. **Preview.** `wrangler deploy --env preview --tag "$(git rev-parse --short HEAD)" --message "$(git log -1 --format=%s)"`. Done when `https://kuuki-next-preview.indi256s.workers.dev/` returns 200 with HTML and `/api/auth/get-session` returns 200 with body `null` (that route reads D1, so it proves the binding).
5. **Go-ahead.** Report the SHA, the empty migration diff and the preview result, then wait for the user's explicit yes to deploy production. A yes for an earlier release does not carry over.
6. **Production.** First record the current version of each Worker from `wrangler deployments status --name kuuki-next` and `--name kuuki-activation`: these are the rollback targets. Then deploy with the same `--tag`/`--message` flags, top level first, then activation:
   `wrangler deploy --tag … --message …`
   `wrangler deploy --env activation --tag … --message …`
   Record both printed Version IDs.
7. **Verify.** `https://kuuki.marchstudio.uk/` returns 200 with HTML, `/api/auth/get-session` returns 200 with `null`, and `https://kuuki-activation.indi256s.workers.dev/activate` returns 200. Then watch `wrangler tail kuuki-next --status error` for five minutes. Any error or failed check: roll back, then report.

## Rollback

- **Code.** `wrangler rollback <previous-version-id> --name kuuki-next`, and the same for `kuuki-activation`. A rollback restores the Worker version only; D1 data and schema stay as they are.
- **Emergency.** Delete the `kuuki.marchstudio.uk/*` route in Cloudflare. The held Pages build behind that host then serves maintenance and writes stop. Restoring the route restores Next.

## Gotchas

- The config declares no `routes`: wrangler leaves the dashboard-managed route alone. A declared `routes` list is PUT as the Worker's complete set, replacing whatever else is attached.
- `wrangler d1 migrations list --remote` writes: it runs `CREATE TABLE IF NOT EXISTS d1_migrations` first. Use the `SELECT` in step 2 for a read-only check.
- `vars` and `d1_databases` do not inherit into wrangler environments, so `[env.activation]` repeats the production values. Change both blocks together.
- Secrets (`AUTH_SECRET`, `BETTER_AUTH_SECRET`, `ACTIVATION_MAIL_AUTH_TOKEN`) live on each Worker, outside the config; deploys keep them. Rotating one is `wrangler secret put <NAME> --name <worker>` per Worker, and wrangler asks for confirmation before rolling back across a secret change.
- The Pages project `kuuki` holds the frozen rollback build. Next deploys go to Workers only.
- Out of scope until separately decided: the maintenance cron Worker and the import provider (`GEMINI_API_KEY`, import Durable Object).
