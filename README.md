# Kuuki (くうき)

A flight journal with route maps, a digital passport, statistics, opt-in rankings, and ticket import with review before saving.

The current app is `apps/next`: Next.js App Router and React, built with OpenNext for Cloudflare Workers. A composed Worker serves Next pages, shared API handlers and the retained Vite app under `/legacy/`. D1 stores application data; Better Auth handles credentials and sessions; Google Gemini parses tickets behind the server API. A scheduled Worker repairs pending statistics and refreshes rankings.

The Next app uses TypeScript, Tailwind CSS, Radix controls, TanStack Query, React Hook Form and Zod. Route maps use MapLibre with local assets. UI tokens and conventions live in [DESIGN.md](DESIGN.md) and [styles.css](apps/next/src/app/styles.css). Dependency ranges are in [the app manifest](apps/next/package.json); resolved versions are in [pnpm-lock.yaml](pnpm-lock.yaml).

`apps/web` remains the legacy rollback surface. Supabase files are retained migration history. The checked-in [CI workflow](.github/workflows/ci.yml) only verifies; production runs Next on Workers and is deployed by hand with the [deploy-kuuki skill](docs/skills/deploy-kuuki/SKILL.md).

## Development

Use the Node.js version declared in [CI](.github/workflows/ci.yml) and pnpm declared by [`packageManager`](package.json). Run commands from this directory, which contains `pnpm-workspace.yaml`.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm next:build
pnpm next:preview
```

Open `http://127.0.0.1:8800`. The preview runs the compiled composed Worker in local workerd with disposable D1 data and synthetic accounts. It supplies synthetic secrets and blocks outbound requests; it does not require live credentials. The console prints fixture credentials. Ctrl-C discards the fixture. Set `KUUKI_NEXT_PORT` to use another port.

For Next hot reload, use `pnpm --filter @kuuki/next dev`; this does not wire the composed Worker's API or D1 bindings. Use the compiled preview for authenticated pages and cookie, API, D1 and Worker integration checks. Rebuild with `pnpm next:build` after source changes before checking compiled behavior. Run builds and browser/runtime fixtures serially because they share build output and a port.

The legacy fixture remains available through `pnpm --filter @kuuki/web build`, `pnpm build:api`, then `pnpm dev:fixture` at `http://localhost:8799`. Root `pnpm dev` starts workspace dev tasks; `pnpm dev:pages` is the legacy Pages/Vite path.

## Configuration

Bindings and non-secret variables belong to the relevant configuration: [Next Worker](apps/next/wrangler.toml), [legacy Pages](wrangler.toml), [maintenance](workers/maintenance/wrangler.toml) and [local import Worker](workers/import/wrangler.local.toml). Use isolated resources and credentials for each environment. Checked-in IDs alone do not prove hosted isolation.

Configure server secrets in Cloudflare or a gitignored local `.dev.vars` for the corresponding Wrangler project. Keep secrets out of browser-exposed variables such as `NEXT_PUBLIC_*` and legacy `VITE_*`. The synthetic fixtures supply their own settings.

| Setting | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET` | Independent Better Auth signing/encryption secret; generate with `openssl rand -base64 32` |
| `AUTH_SECRET` | Password pepper; preserve the existing production value |
| `PAGES_ORIGIN` | Exact canonical origin for auth and CSRF, including the Next Worker |
| `GEMINI_API_KEY` | Server-side ticket parsing and aircraft enrichment |
| `MAINTENANCE_MODE` | Request hold before private database access |
| `ACTIVATION_ORIGIN` | Separate HTTPS origin for legacy account activation |
| `ACTIVATION_MAIL_ACCOUNT_ID` | Cloudflare account with Email Sending enabled |
| `ACTIVATION_MAIL_FROM` | Verified Email Sending sender address |
| `ACTIVATION_MAIL_AUTH_TOKEN` | Server secret with Cloudflare Email Sending permission |

Better Auth uses the same origin as the app. The application supports migrated-account activation and password recovery; social login is not configured. Preserve user IDs, password pepper, signing secrets and compatible sessions during migration or frontend rollback. Follow the release runbooks for schema admission and additive migrations rather than applying SQL from setup instructions.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm typecheck:api
pnpm typecheck:scripts
pnpm typecheck:maintenance
pnpm test
```

`pnpm test` runs API integration tests and Next/legacy unit tests. It excludes the separate composed-Worker smoke and browser suites. For Next UI and runtime changes, run the relevant checks serially against current build output:

```bash
pnpm next:build
pnpm --filter @kuuki/next typecheck:worker
pnpm next:smoke
pnpm next:smoke:boundary
pnpm --filter @kuuki/next exec playwright install chromium
pnpm test:next:navigation
```

The full navigation suite is required for UI changes. After changing API paths or exported HTTP methods, regenerate and include `apps/next/api-routes.generated.ts` with `node scripts/build-next.mjs --inventory-only`; edit the handlers or generator rather than generated output.

See [docs/agents/checks.md](docs/agents/checks.md) for checks by change type and [CI](.github/workflows/ci.yml) for the verification pipeline. `pnpm smoke:runtime` and `scripts/rehearse-next-rollback.ts` remain runnable locally for legacy rollback checks. `pnpm next:build` builds the API, legacy compatibility assets and OpenNext output; it does not deploy. The preview/smoke scripts and `pnpm build:maintenance` use Wrangler dry-run builds.

## Structure

```text
apps/next/           Current Next app, composed Worker and browser tests
apps/web/            Legacy Vite app and rollback assets
packages/client/     Browser API, flight, passport, geography and export helpers
packages/shared/     DTOs, validation, translations
packages/data/       Static airport, aircraft, airline and country references
functions/api/       Shared API/domain handlers and retained Pages wrappers
functions/test/      API and runtime regression tests
db/migrations/       D1 schema migrations
db/_snapshot/        Gitignored legacy export, for rehearsal only
scripts/             Builds, migration admission, local fixtures and rollback
workers/maintenance/ Scheduled recovery and rankings
workers/import/      Import job Worker and local configuration
supabase/            Historical schema and migrations
```

## Migration and release

Start with [the Next release candidate runbook](docs/runbooks/2026-10-04-next-release-candidate.md) for runtime, artifact, rollback and hosted acceptance gates. Use [the remediation release runbook](docs/runbooks/audit-remediation-release.md) and [execution status](docs/runbooks/audit-remediation-status.md) for source migration and preservation requirements.

Local preflight and dry-run builds do not authorize remote writes or cutover. Remote D1 operations require an explicit approved target, writer hold, backup/restore proof and schema admission. Production migration, cloud configuration, delivery and paid provider evaluation require their approved release change set. A frontend rollback does not roll back D1.

Deployment gates are defined in the workflow and runbooks, including preview isolation, Pages Git deployment shutdown, an exact approved production SHA and maintenance readiness. The existence of configuration is not evidence that those gates have passed.

See [the documentation index](docs/README.md) for product docs and [GLOSSARY.md](GLOSSARY.md) for domain terms. [TECH_STACK.md](docs/TECH_STACK.md) describes the retained legacy app.

MIT © [Indi256](https://github.com/indi256)
