# Kuuki (くうき)

A flight journal with route maps, a digital passport, statistics, opt-in rankings, and ticket import with review before saving.

The application uses React 19, TypeScript, Vite, Tailwind CSS and shadcn/ui. Cloudflare Pages serves the web app; Pages Functions use D1, cookie sessions and Google Gemini. A scheduled Worker repairs pending statistics and refreshes rankings. Supabase files remain as migration history.

## Development

Use Node.js 24 and pnpm 9.15.0.

```bash
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm install --frozen-lockfile
pnpm build
pnpm build:api
pnpm dev:fixture
```

The fixture serves the compiled app at `http://localhost:8799` with two synthetic accounts and an isolated, disposable D1 database. All provider requests are faked or denied. It reads neither `.dev.vars` nor the legacy snapshot. The console prints the fixture credentials; Ctrl-C discards its data.

`pnpm dev` starts Vite for frontend development. Use the compiled fixture for cookie, API and database integration. The existing `pnpm dev:pages` command uses local Wrangler configuration; configure its local D1 and secrets explicitly before use.

## Configuration

Configure server secrets in Cloudflare or a gitignored local `.dev.vars`; never put them in `VITE_*` variables.

| Setting | Purpose |
| --- | --- |
| `AUTH_SECRET` | Password pepper; preserve the existing production value |
| `PAGES_ORIGIN` | Exact canonical origin for auth and CSRF |
| `GEMINI_API_KEY` | Server-side ticket parsing and aircraft enrichment |
| `MAINTENANCE_MODE` | API write hold during cutover |
| `ACTIVATION_ORIGIN` | Separate HTTPS origin for legacy account activation |
| `ACTIVATION_MAIL_ACCOUNT_ID` | Cloudflare account with Email Sending enabled; non-secret 32-character account ID |
| `ACTIVATION_MAIL_FROM` | `accounts@marchstudio.uk` once Email Sending domain verification is complete |
| `ACTIVATION_MAIL_AUTH_TOKEN` | Server secret with Cloudflare Email Sending: Edit permission |

Each environment needs separate D1, import KV and credentials. The configured preview D1 and KV are isolated from production; deployment admission verifies their identities. Legacy account activation applies only to migrated accounts awaiting their first working password.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm typecheck:api
pnpm typecheck:scripts
pnpm typecheck:maintenance
pnpm --filter @kuuki/web test:run
pnpm test:api
pnpm build
pnpm build:api
pnpm build:maintenance
pnpm smoke:runtime
```

CI requires these checks before deployment. Worker builds are dry runs. Deployments require verified preview isolation and disabling the separate Pages Git deployment path. Production additionally requires `PRODUCTION_RELEASE_SHA` to match the commit being deployed; set it only after accepting the release gates in the runbook. Maintenance deployment has an additional readiness gate and initially holds writes.

## Structure

```text
apps/web/             React application
packages/shared/      DTOs, validation, translations
packages/data/        Static airport, aircraft, airline and country references
functions/            Pages Functions API and regression tests
db/migrations/        D1 schema migrations
db/_snapshot/         Gitignored legacy export, for rehearsal only
scripts/              Explicit-target migration, validation and local fixtures
workers/maintenance/  Scheduled recovery and rankings
supabase/             Historical schema and migrations
```

## Migration and release

Follow [the remediation release runbook](docs/runbooks/audit-remediation-release.md) and [execution status](docs/runbooks/audit-remediation-status.md). Import scripts require an explicit isolated target and validate source records and conflicts. Freshness of the legacy source must be verified before production; snapshot file dates alone are insufficient. Production migration, cloud configuration, delivery and paid OCR evaluation require the approved release change set.

See [TECH_STACK](docs/TECH_STACK.md) for runtime contracts and [the documentation index](docs/README.md) for product documentation.

MIT © [Indi256](https://github.com/indi256)
